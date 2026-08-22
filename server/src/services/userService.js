const User = require('../models/User');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES, ROLES } = require('../config/constants');
const authService = require('./authService');

async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'User not found');
  return user;
}

async function updateProfile(userId, { name }) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'User not found');
  if (name !== undefined) user.name = name;
  await user.save();
  return user;
}

async function listCustomers({ search, page = 1, limit = 20 }) {
  const filter = {};
  if (search) {
    // Escaped, anchored regex over a Mongoose-bound field — no raw query
    // interpolation (PRD §17 NoSQL-injection row).
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: new RegExp(safe, 'i') }, { email: new RegExp(safe, 'i') }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return { users, total, page, limit };
}

async function getCustomerWithOrderSummary(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'User not found');

  const [totalOrders, deliveredOrders, totalSpent] = await Promise.all([
    Order.countDocuments({ user: userId }),
    Order.countDocuments({ user: userId, status: 'DELIVERED' }),
    Order.aggregate([
      { $match: { user: user._id, paymentStatus: 'PAID' } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } },
    ]),
  ]);

  return {
    user,
    orderSummary: {
      totalOrders,
      deliveredOrders,
      totalSpent: totalSpent[0]?.total ?? 0,
    },
  };
}

async function setStatus(userId, isActive, actingAdminId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'User not found');
  if (user._id.toString() === actingAdminId && isActive === false) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'You cannot disable your own account');
  }
  user.isActive = isActive;
  await user.save();
  if (!isActive) await authService.logoutAll(user._id); // kick disabled user's sessions
  return user;
}

async function setRole(userId, role, actingAdminId) {
  if (userId.toString() === actingAdminId.toString()) {
    // MVP guard: an admin demoting themselves could leave zero admins (PRD §5.5).
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'You cannot change your own role');
  }
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'User not found');
  if (!Object.values(ROLES).includes(role)) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Invalid role');
  }
  user.role = role;
  await user.save();
  return user;
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword: authService.changePassword,
  listCustomers,
  getCustomerWithOrderSummary,
  setStatus,
  setRole,
};
