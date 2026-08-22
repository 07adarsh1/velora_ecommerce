const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES, ORDER_STATUS, ORDER_TRANSITIONS, CANCELLABLE_STATUSES, INVENTORY_REASONS } = require('../config/constants');
const env = require('../config/env');
const { generateOrderNumber } = require('../utils/helpers');
const cartService = require('./cartService');
const addressService = require('./addressService');
const pricingService = require('./pricingService');
const couponService = require('./couponService');
const inventoryService = require('./inventoryService');
const logger = require('../utils/logger');

// ─── State machine (PRD §10.3) ───────────────────────────────────────────────

/**
 * The ONLY function permitted to change order.status. Every caller composes
 * its side effects (stock restore, refund, …) around this inside a DB
 * transaction so the status write and its side effects commit atomically.
 */
async function transition(order, toStatus, { note, session = null } = {}) {
  const allowed = ORDER_TRANSITIONS[order.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new ApiError(
      409,
      ERROR_CODES.CONFLICT,
      `Illegal order status transition: ${order.status} → ${toStatus}`
    );
  }
  order.status = toStatus;
  order.timeline.push({ status: toStatus, note: note || null, at: new Date() });
  await order.save({ session });
  return order;
}

// ─── Creation (PRD §4.4 step 2-3, §12.8 POST /orders) ────────────────────────

/**
 * Creates a PENDING_PAYMENT order. All pricing is recomputed server-side from
 * the current cart — nothing about money is trusted from the client.
 */
async function createOrder(userId, { addressId, couponCode = undefined }) {
  const view = await cartService.getCartView(userId);
  const items = view.cart.items;

  if (items.length === 0) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Cart is empty');
  const unavailable = items.filter((i) => i.unavailable);
  if (unavailable.length > 0) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'Some items in your cart are no longer available — review your cart');
  }
  // Soft stock validation; the hard atomic check happens at payment
  // confirmation (PRD §11.4).
  for (const item of items) {
    if (item.quantity > item.stock) {
      throw new ApiError(409, ERROR_CODES.CONFLICT, `Insufficient stock for ${item.product.name}`);
    }
  }

  // Coupon: explicit couponCode param wins; otherwise the cart's applied coupon.
  let couponSnapshot = null;
  const code = couponCode !== undefined ? couponCode : view.cart.appliedCoupon?.code;
  if (code) {
    const pricingItems = items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity }));
    const subtotal = pricingItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const coupon = await couponService.validateForCode(code, { userId, subtotal });
    couponSnapshot = { _id: coupon._id, code: coupon.code, type: coupon.type, value: coupon.value };
  }

  const address = await addressService.getOwned(userId, addressId);
  const pricing = pricingService.computePricing(
    items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity })),
    couponSnapshot
  );

  // Product snapshots for an immutable historical record (PRD §7.7).
  const products = await Product.find({ _id: { $in: items.map((i) => i.product._id) } });
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  const order = new Order({
    orderNumber: generateOrderNumber(),
    user: userId,
    items: items.map((i) => ({
      product: i.product._id,
      variantSku: i.variantSku,
      name: i.product.name,
      image: i.product.image,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
    })),
    shippingAddress: {
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    },
    pricing: {
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      shipping: pricing.shipping,
      tax: pricing.tax,
      total: pricing.total,
    },
    coupon: couponSnapshot ? { code: couponSnapshot.code, discountApplied: pricing.discount } : undefined,
    status: ORDER_STATUS.PENDING_PAYMENT,
    timeline: [{ status: ORDER_STATUS.PENDING_PAYMENT, note: 'Order created, awaiting payment', at: new Date() }],
  });
  await order.save();
  return order;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

async function listForUser(userId, { status, page, limit }) {
  const filter = { user: userId };
  if (status) filter.status = status;
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  return { orders, total, page, limit };
}

async function getOrderForUser(orderId, user) {
  const order = await Order.findById(orderId).populate('user', 'name email');
  if (!order) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Order not found');
  // Object-level authorization: owner or admin only (PRD §12.8).
  if (order.user._id.toString() !== user.id.toString() && user.role !== 'admin') {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'You do not have access to this order');
  }
  return order;
}

async function listAll({ status, search, from, to, page, limit }) {
  const filter = {};
  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { orderNumber: new RegExp(safe, 'i') },
      { 'shippingAddress.fullName': new RegExp(safe, 'i') },
    ];
  }
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('user', 'name email').lean(),
    Order.countDocuments(filter),
  ]);
  return { orders, total, page, limit };
}

// ─── Customer actions ────────────────────────────────────────────────────────

async function cancelOrder(orderId, { reason, actor }) {
  const order = await getOrderForUser(orderId, actor);
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, `Order cannot be cancelled from status ${order.status}`);
  }

  // PENDING_PAYMENT never decremented stock, so nothing to restore (PRD §10.2).
  if (order.status === ORDER_STATUS.PENDING_PAYMENT) {
    order.cancelReason = reason || null;
    return transition(order, ORDER_STATUS.CANCELLED, { note: reason ? `Cancelled: ${reason}` : 'Cancelled' });
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      order.cancelReason = reason || null;
      await inventoryService.restoreForOrder(order, session, INVENTORY_REASONS.CANCELLATION);
      result = await transition(order, ORDER_STATUS.CANCELLED, { note: reason ? `Cancelled: ${reason}` : 'Cancelled', session });
    });
    return result;
  } finally {
    session.endSession();
  }
}

async function requestReturn(orderId, userId, reason) {
  const order = await getOrderForUser(orderId, { id: userId });
  if (order.status !== ORDER_STATUS.DELIVERED) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'Returns can only be requested after delivery');
  }
  const deliveredAt = order.shipment?.deliveredAt || order.updatedAt;
  const windowMs = env.RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() - deliveredAt.getTime() > windowMs) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, `The ${env.RETURN_WINDOW_DAYS}-day return window has closed`);
  }
  order.returnRequest = { reason, requestedAt: new Date(), status: 'PENDING' };
  return transition(order, ORDER_STATUS.RETURN_REQUESTED, { note: `Return requested: ${reason}` });
}

// ─── Admin actions ───────────────────────────────────────────────────────────

async function adminUpdateStatus(orderId, toStatus, note) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Order not found');

  switch (toStatus) {
    case ORDER_STATUS.PROCESSING:
    case ORDER_STATUS.SHIPPED: // via dedicated shipment endpoint preferentially
    case ORDER_STATUS.DELIVERED:
    case ORDER_STATUS.CANCELLED: {
      if (toStatus === ORDER_STATUS.SHIPPED) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Use the shipment endpoint to ship an order');
      }
      if (toStatus === ORDER_STATUS.DELIVERED && order.shipment) {
        order.shipment.deliveredAt = new Date();
      }
      if (toStatus === ORDER_STATUS.CANCELLED) {
        return cancelOrder(orderId, { reason: note || 'Cancelled by admin', actor: { id: order.user._id ?? order.user, role: 'admin' } });
      }
      return transition(order, toStatus, { note });
    }
    default:
      throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Status ${toStatus} cannot be set manually`);
  }
}

async function updateShipment(orderId, { carrier, trackingNumber }) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Order not found');
  if (order.status !== ORDER_STATUS.PROCESSING) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'Shipment info can only be added to a PROCESSING order');
  }
  order.shipment = { ...(order.shipment || {}), carrier, trackingNumber, shippedAt: new Date() };
  return transition(order, ORDER_STATUS.SHIPPED, { note: `Shipped via ${carrier} (${trackingNumber})` });
}

async function rejectReturn(orderId, note) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Order not found');
  if (order.status !== ORDER_STATUS.RETURN_REQUESTED) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'No pending return request on this order');
  }
  if (order.returnRequest) order.returnRequest.status = 'REJECTED';
  return transition(order, ORDER_STATUS.DELIVERED, { note: note ? `Return rejected: ${note}` : 'Return rejected' });
}

async function approveReturn(orderId) {
  const paymentService = require('./paymentService');
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Order not found');
  if (order.status !== ORDER_STATUS.RETURN_REQUESTED) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'No pending return request on this order');
  }
  if (order.paymentStatus !== 'PAID') {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'Order was not paid — nothing to refund');
  }

  // Gateway refund first (external call must not sit inside the DB
  // transaction); DB state commits only once the gateway accepted it.
  await paymentService.refundForOrder(order);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (order.returnRequest) order.returnRequest.status = 'APPROVED';
      await inventoryService.restoreForOrder(order, session, INVENTORY_REASONS.RETURN);
      await transition(order, ORDER_STATUS.REFUNDED, { note: 'Return approved — refunded', session });
    });
    // refundForOrder mutated the DB outside this doc instance — reload so the
    // caller sees the committed paymentStatus too.
    return await Order.findById(orderId);
  } finally {
    session.endSession();
  }
}

// ─── Payment confirmation — the idempotent core (PRD §9.4) ──────────────────

/**
 * withTransaction retries errors labeled transient by the server, but a
 * WriteConflict can occasionally escape unlabeled under heavy contention
 * (many concurrent confirms on the same product document). A bounded retry
 * of the whole transaction absorbs those; the atomic stock guard inside the
 * callback keeps every attempt individually safe.
 */
async function runWithRetry(session, fn, attempts = 3) {
  for (let i = 0; ; i++) {
    try {
      await session.withTransaction(fn);
      return;
    } catch (err) {
      const transient =
        (err.errorLabels && err.errorLabels.length > 0) ||
        err.codeName === 'WriteConflict' ||
        /write conflict|transaction/i.test(err.message || '');
      if (transient && i < attempts) {
        logger.warn({ attempt: i + 1 }, 'Transient transaction error — retrying');
        continue;
      }
      throw err;
    }
  }
}

/**
 * The single code path that transitions an order to paid. Both the sync
 * /payments/verify controller and the webhook handler call this function, so
 * duplicate delivery and the verify/webhook race collapse into no-ops.
 */
async function confirmPayment(orderId, { gatewayPaymentId = null, gatewayEventId = null } = {}) {
  const Payment = require('../models/Payment');
  const session = await mongoose.startSession();
  try {
    let order;
    await runWithRetry(session, async () => {
      order = await Order.findById(orderId).session(session);
      if (!order) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Order not found');

      const payment = await Payment.findOne({ order: order._id })
        .sort({ createdAt: -1 })
        .select('+webhookEventsProcessed')
        .session(session);
      if (!payment) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Payment record not found');

      // Idempotency: already captured (duplicate webhook or verify/webhook race).
      if (payment.status === 'CAPTURED') return;
      if (gatewayEventId && payment.webhookEventsProcessed.includes(gatewayEventId)) return;

      if (order.status === ORDER_STATUS.CANCELLED) {
        // Payment landed after the customer cancelled — money captured for a
        // dead order; flag for admin-initiated refund instead of fulfilling.
        logger.error({ orderId: order._id.toString() }, 'Payment captured on CANCELLED order — needs manual refund');
        payment.status = 'CAPTURED';
        if (gatewayPaymentId) payment.gatewayPaymentId = gatewayPaymentId;
        if (gatewayEventId) payment.webhookEventsProcessed.push(gatewayEventId);
        await payment.save({ session });
        return;
      }
      if (order.status !== ORDER_STATUS.PENDING_PAYMENT) return; // e.g. already confirmed

      payment.status = 'CAPTURED';
      if (gatewayPaymentId) payment.gatewayPaymentId = gatewayPaymentId;
      if (gatewayEventId) payment.webhookEventsProcessed.push(gatewayEventId);
      await payment.save({ session });

      order.paymentStatus = 'PAID';
      order.payment = payment._id;

      // Hard, atomic stock decrement — throws 409 inside the transaction if
      // the product oversold between checkout and confirmation (PRD §11.2).
      await inventoryService.decrementForOrder(order, session);
      await cartService.clearCart(order.user, session);
      if (order.coupon?.code) {
        const coupon = await Coupon.findOne({ code: order.coupon.code }).session(session);
        if (coupon) await couponService.recordUsage(coupon._id, order.user, session);
      }

      await transition(order, ORDER_STATUS.PAYMENT_CONFIRMED, { note: 'Payment confirmed', session });
    });

    return await Order.findById(orderId);
  } finally {
    session.endSession();
  }
}

async function failPayment(orderId, { gatewayEventId = null, reason = null } = {}) {
  const Payment = require('../models/Payment');
  const session = await mongoose.startSession();
  try {
    await runWithRetry(session, async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order || order.status !== ORDER_STATUS.PENDING_PAYMENT) return;

      const payment = await Payment.findOne({ order: order._id })
        .sort({ createdAt: -1 })
        .select('+webhookEventsProcessed')
        .session(session);
      if (!payment || payment.status === 'CAPTURED') return;
      if (gatewayEventId && payment.webhookEventsProcessed.includes(gatewayEventId)) return;

      payment.status = 'FAILED';
      payment.failureReason = reason;
      if (gatewayEventId) payment.webhookEventsProcessed.push(gatewayEventId);
      await payment.save({ session });

      order.paymentStatus = 'FAILED';
      await transition(order, ORDER_STATUS.PAYMENT_FAILED, { note: reason ? `Payment failed: ${reason}` : 'Payment failed', session });
    });
    return await Order.findById(orderId);
  } finally {
    session.endSession();
  }
}

/** Re-opens a failed order for a new payment attempt (PRD §9.5 retry). */
async function reopenForRetry(order) {
  if (order.status !== ORDER_STATUS.PAYMENT_FAILED) return order;
  return transition(order, ORDER_STATUS.PENDING_PAYMENT, { note: 'Payment retry started' });
}

module.exports = {
  transition,
  createOrder,
  listForUser,
  getOrderForUser,
  listAll,
  cancelOrder,
  requestReturn,
  adminUpdateStatus,
  updateShipment,
  rejectReturn,
  approveReturn,
  confirmPayment,
  failPayment,
  reopenForRetry,
};
