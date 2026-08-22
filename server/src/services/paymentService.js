const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES, GATEWAYS } = require('../config/constants');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const orderService = require('./orderService');
const logger = require('../utils/logger');

// In mock mode the "gateway secret" is this deterministic value so the HMAC
// sign/verify path is exercised identically to production, just locally.
const MOCK_KEY_SECRET = 'mock-gateway-key-secret-for-dev-only';

const usingMock = () => env.MOCK_PAYMENTS;
const keySecret = () => (usingMock() ? MOCK_KEY_SECRET : env.RAZORPAY_KEY_SECRET);

let razorpayClient = null;
function razorpay() {
  if (!razorpayClient) {
    const Razorpay = require('razorpay');
    razorpayClient = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return razorpayClient;
}

function hmacSha256(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/** Constant-time comparison — never `===` on signatures (PRD §9.2). */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ─── Payment creation (PRD §9.1) ─────────────────────────────────────────────

/**
 * Creates a gateway order + local Payment record for a PENDING_PAYMENT
 * (or PAYMENT_FAILED → reopened) order. Reuses an existing CREATED payment so
 * double-clicking "pay" doesn't create duplicate gateway orders.
 */
async function createGatewayPayment(userId, orderId) {
  let order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Order not found');
  if (order.user.toString() !== userId.toString()) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'You do not have access to this order');
  }
  if (order.status === 'PAYMENT_FAILED') {
    order = await orderService.reopenForRetry(order);
  }
  if (order.status !== 'PENDING_PAYMENT') {
    throw new ApiError(409, ERROR_CODES.CONFLICT, `Order is not awaiting payment (status: ${order.status})`);
  }

  const existing = await Payment.findOne({ order: order._id, status: 'CREATED' });
  if (existing) {
    return paymentForClient(existing, order);
  }

  const amountPaise = Math.round(order.pricing.total * 100);
  const gateway = usingMock() ? GATEWAYS.MOCK : GATEWAYS.RAZORPAY;

  let gatewayOrderId;
  if (usingMock()) {
    gatewayOrderId = `mock_order_${crypto.randomBytes(8).toString('hex')}`;
  } else {
    const gatewayOrder = await razorpay().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { orderId: order._id.toString() },
    });
    gatewayOrderId = gatewayOrder.id;
  }

  const payment = await Payment.create({
    order: order._id,
    gateway,
    gatewayOrderId,
    amount: amountPaise,
    currency: 'INR',
  });
  return paymentForClient(payment, order);
}

function paymentForClient(payment, order) {
  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    amount: payment.amount,
    currency: payment.currency,
    gatewayOrderId: payment.gatewayOrderId,
    gateway: payment.gateway,
    // Only the PUBLIC key ever reaches the client (PRD §17).
    keyId: usingMock() ? 'mock_key_id' : env.RAZORPAY_KEY_ID,
  };
}

// ─── Client-triggered verification (PRD §9.2) ───────────────────────────────

/**
 * Verifies the gateway signature with the standard Razorpay formula
 * HMAC_SHA256(`${gatewayOrderId}|${gatewayPaymentId}`, key_secret).
 */
async function verifyPayment(userId, { orderId, gatewayOrderId, gatewayPaymentId, signature }) {
  const payment = await Payment.findOne({ gatewayOrderId });
  if (!payment) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Payment not found');
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Order not found');
  if (order.user.toString() !== userId.toString()) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'You do not have access to this order');
  }
  if (order.payment && String(order.payment) !== String(payment._id) && order.paymentStatus === 'PAID') {
    // An earlier payment attempt already captured this order.
    return order;
  }

  const expected = hmacSha256(`${gatewayOrderId}|${gatewayPaymentId}`, keySecret());
  if (!safeEqual(expected, signature)) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Payment signature verification failed');
  }

  // The same idempotent function the webhook calls.
  return orderService.confirmPayment(orderId, { gatewayPaymentId });
}

// ─── Mock gateway (dev only) ─────────────────────────────────────────────────

/**
 * Simulates the gateway's hosted checkout in MOCK_PAYMENTS mode: "pays" a
 * gateway order and returns the signed payload the real gateway would hand
 * back to the frontend, which then calls /payments/verify unchanged.
 */
async function mockPay({ gatewayOrderId, succeed = true }) {
  if (!usingMock()) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'Mock payments are disabled');
  }
  const payment = await Payment.findOne({ gatewayOrderId });
  if (!payment) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Payment not found');

  if (!succeed) {
    await orderService.failPayment(payment.order, { reason: 'Simulated failure (mock gateway)' });
    return { success: false };
  }

  const gatewayPaymentId = `mock_pay_${crypto.randomBytes(8).toString('hex')}`;
  const signature = hmacSha256(`${gatewayOrderId}|${gatewayPaymentId}`, keySecret());
  return { success: true, gatewayPaymentId, signature };
}

// ─── Webhook (PRD §9.3) ──────────────────────────────────────────────────────

/**
 * Verifies the webhook signature against the RAW request body and dispatches
 * the event. Returns true when the event was handled (caller answers 200).
 */
async function handleWebhook(rawBody, signatureHeader) {
  if (!rawBody || !signatureHeader) return false;

  const secret = usingMock() ? 'mock-webhook-secret' : env.RAZORPAY_WEBHOOK_SECRET;
  const expected = hmacSha256(rawBody.toString('utf8'), secret);
  if (!safeEqual(expected, signatureHeader)) {
    logger.warn('Webhook signature mismatch — rejecting');
    return false;
  }

  const event = JSON.parse(rawBody.toString('utf8'));
  const entity = event.payload?.payment?.entity || {};
  const orderId = entity.notes?.orderId;
  const gatewayEventId = event.id || `${event.event}:${entity.id}`;

  switch (event.event) {
    case 'payment.captured': {
      if (!orderId) return true; // not ours
      await orderService.confirmPayment(orderId, {
        gatewayPaymentId: entity.id,
        gatewayEventId,
      });
      return true;
    }
    case 'payment.failed': {
      if (!orderId) return true;
      await orderService.failPayment(orderId, {
        gatewayEventId,
        reason: entity.error_description || 'Payment failed at gateway',
      });
      return true;
    }
    case 'refund.processed': {
      const payment = await Payment.findOne({ gatewayPaymentId: entity.id });
      if (payment) {
        await Payment.updateOne(
          { _id: payment._id },
          { $set: { status: 'REFUNDED', 'refund.refundedAt': new Date() } }
        );
      }
      return true;
    }
    default:
      logger.info({ event: event.event }, 'Ignored webhook event type');
      return true;
  }
}

// ─── Refunds (PRD §9.6) ──────────────────────────────────────────────────────

async function refundForOrder(order) {
  const payment = await Payment.findOne({ _id: order.payment }).sort({ createdAt: -1 });
  if (!payment) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Payment record not found');
  if (payment.status !== 'CAPTURED') {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'Only a captured payment can be refunded');
  }

  let refundId;
  if (usingMock()) {
    refundId = `mock_rfnd_${crypto.randomBytes(8).toString('hex')}`;
  } else {
    const refund = await razorpay().payments.refund(payment.gatewayPaymentId, { amount: payment.amount });
    refundId = refund.id;
  }

  await Payment.updateOne(
    { _id: payment._id },
    {
      $set: {
        status: 'REFUNDED',
        refund: { amount: payment.amount, refundId, refundedAt: new Date() },
      },
    }
  );
  await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'REFUNDED' } });
}

module.exports = {
  createGatewayPayment,
  verifyPayment,
  mockPay,
  handleWebhook,
  refundForOrder,
  usingMock,
};
