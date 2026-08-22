const paymentService = require('../services/paymentService');
const { sendSuccess } = require('../utils/ApiResponse');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');

async function createOrder(req, res) {
  const data = await paymentService.createGatewayPayment(req.user.id, req.body.orderId);
  return sendSuccess(res, { data });
}

async function verify(req, res) {
  const order = await paymentService.verifyPayment(req.user.id, req.body);
  return sendSuccess(res, { data: order, message: 'Payment verified' });
}

/**
 * Mock hosted-checkout stand-in (MOCK_PAYMENTS=true only): "completes" a
 * gateway order and returns the signed payload the frontend would otherwise
 * receive from Razorpay's popup, keeping the verify flow identical.
 */
async function mockPay(req, res) {
  const data = await paymentService.mockPay(req.body);
  return sendSuccess(res, { data });
}

/**
 * Gateway webhook — NO auth middleware; trust comes exclusively from the
 * HMAC signature over the raw body (PRD §9.3).
 */
async function webhook(req, res) {
  const handled = await paymentService.handleWebhook(req.rawBody, req.headers['x-razorpay-signature']);
  if (!handled) {
    // Signature mismatch / undecodable body: reject so the gateway retries
    // with a intact payload; never process untrusted input.
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Invalid webhook signature');
  }
  // Fast 200 so the gateway stops retrying (PRD §9.3 step 6).
  return res.status(200).json({ success: true });
}

async function refund(req, res) {
  // :id is the Payment id (PRD §12.9); the refund resolves through its order.
  const Payment = require('../models/Payment');
  const orderService = require('../services/orderService');
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Payment not found');

  const order = await require('../models/Order').findById(payment.order);
  if (!['RETURN_REQUESTED', 'DELIVERED'].includes(order.status)) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'Refund requires a DELIVERED or RETURN_REQUESTED order');
  }
  const updated = await orderService.approveReturn(order._id);
  return sendSuccess(res, { data: updated, message: 'Refund processed' });
}

module.exports = { createOrder, verify, mockPay, webhook, refund };
