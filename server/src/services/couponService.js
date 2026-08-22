const Coupon = require('../models/Coupon');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');

/**
 * Full apply-time validation (PRD §5.6): active, unexpired, above minimum
 * order value, under total usage limit, and under the per-user limit — every
 * time the coupon is applied, never cached client-side.
 */
function checkValid(coupon, { userId, subtotal }) {
  if (!coupon) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Coupon not found');
  if (!coupon.isActive) throw new ApiError(409, ERROR_CODES.CONFLICT, 'This coupon is not active');
  if (coupon.expiresAt <= new Date()) throw new ApiError(409, ERROR_CODES.CONFLICT, 'This coupon has expired');
  if (coupon.usageLimit !== null && coupon.timesUsed >= coupon.usageLimit) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'This coupon has reached its usage limit');
  }
  if (subtotal < coupon.minOrderValue) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, `This coupon requires a minimum order of ${coupon.minOrderValue}`);
  }
  const usage = coupon.usedBy.find((u) => u.user?.toString() === userId?.toString());
  if (usage && usage.count >= coupon.usageLimitPerUser) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'You have already used this coupon the maximum number of times');
  }
  return coupon;
}

async function findByCode(code) {
  return Coupon.findOne({ code: String(code).toUpperCase().trim() });
}

/** Usage recorded once per confirmed payment (PRD §9.4 step 4). */
async function recordUsage(couponId, userId, session = null) {
  const res = await Coupon.updateOne(
    { _id: couponId, 'usedBy.user': userId },
    { $inc: { timesUsed: 1, 'usedBy.$.count': 1 } },
    { session }
  );
  if (res.matchedCount === 0) {
    await Coupon.updateOne(
      { _id: couponId },
      { $inc: { timesUsed: 1 }, $push: { usedBy: { user: userId, count: 1 } } },
      { session }
    );
  }
}

async function validateForCode(code, { userId, subtotal }) {
  const coupon = await findByCode(code);
  return checkValid(coupon, { userId, subtotal });
}

// ─── Admin CRUD (PRD §5.6, §12.11) ──────────────────────────────────────────

async function listCoupons({ page, limit }) {
  const [coupons, total] = await Promise.all([
    Coupon.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Coupon.countDocuments(),
  ]);
  return { coupons, total, page, limit };
}

async function createCoupon(body) {
  const exists = await Coupon.findOne({ code: body.code.toUpperCase() });
  if (exists) throw new ApiError(409, ERROR_CODES.CONFLICT, 'A coupon with this code already exists');
  if (body.type === 'percentage' && body.value > 100) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Percentage discount cannot exceed 100');
  }
  return Coupon.create({ ...body, code: body.code.toUpperCase() });
}

async function updateCoupon(id, body) {
  const coupon = await Coupon.findById(id);
  if (!coupon) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Coupon not found');
  const updatable = ['type', 'value', 'minOrderValue', 'expiresAt', 'usageLimit', 'usageLimitPerUser', 'isActive'];
  for (const field of updatable) {
    if (body[field] !== undefined) coupon[field] = body[field];
  }
  await coupon.save();
  return coupon;
}

async function deleteCoupon(id) {
  const coupon = await Coupon.findByIdAndDelete(id);
  if (!coupon) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Coupon not found');
}

module.exports = { findByCode, checkValid, validateForCode, recordUsage, listCoupons, createCoupon, updateCoupon, deleteCoupon };
