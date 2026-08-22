const mongoose = require('mongoose');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../config/constants');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku: { type: String, default: null },
    // Snapshots — an order is an immutable record of what was agreed at a
    // point in time; later product edits must never rewrite history (PRD §7.7).
    name: { type: String, required: true },
    image: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], validate: [(v) => v.length > 0, 'Order must contain at least one item'] },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    pricing: {
      subtotal: { type: Number, required: true, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      shipping: { type: Number, default: 0, min: 0 },
      tax: { type: Number, default: 0, min: 0 },
      total: { type: Number, required: true, min: 0 },
    },
    coupon: {
      code: String,
      discountApplied: Number,
    },
    status: { type: String, enum: Object.values(ORDER_STATUS), required: true, default: ORDER_STATUS.PENDING_PAYMENT },
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), required: true, default: PAYMENT_STATUS.PENDING },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    shipment: {
      carrier: String,
      trackingNumber: String,
      shippedAt: Date,
      deliveredAt: Date,
    },
    // Append-only audit trail powering the order-tracker UI (PRD §4.5).
    timeline: [{ _id: false, status: String, note: String, at: { type: Date, default: Date.now } }],
    cancelReason: { type: String, default: null },
    returnRequest: {
      reason: String,
      requestedAt: Date,
      status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'] },
    },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', orderSchema);
