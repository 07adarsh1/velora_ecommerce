const mongoose = require('mongoose');
const { GATEWAYS, PAYMENT_ENTITY_STATUS } = require('../config/constants');

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    gateway: { type: String, enum: Object.values(GATEWAYS), required: true },
    gatewayOrderId: { type: String, required: true },
    gatewayPaymentId: { type: String, index: true, sparse: true },
    // Smallest currency unit (paise for INR) — what the gateway actually charges.
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'INR' },
    status: { type: String, enum: Object.values(PAYMENT_ENTITY_STATUS), required: true, default: PAYMENT_ENTITY_STATUS.CREATED },
    // Gateway event IDs already handled — the idempotency key for webhook
    // redelivery (PRD §9.4).
    webhookEventsProcessed: { type: [String], default: [], select: false },
    failureReason: { type: String, default: null },
    refund: {
      amount: Number,
      refundId: String,
      refundedAt: Date,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ gatewayOrderId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
