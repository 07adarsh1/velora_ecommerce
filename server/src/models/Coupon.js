const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
    usageLimit: { type: Number, default: null, min: 1 }, // null = unlimited
    usageLimitPerUser: { type: Number, default: 1, min: 1 },
    timesUsed: { type: Number, default: 0, min: 0 },
    usedBy: [{ _id: false, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, count: { type: Number, default: 0 } }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Coupon', couponSchema);
