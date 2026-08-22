const Address = require('../models/Address');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');

async function listForUser(userId) {
  return Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 }).lean();
}

async function create(userId, body) {
  if (body.isDefault) {
    // Only one default address per user.
    await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
  }
  const address = new Address({ ...body, user: userId });
  await address.save();
  return address;
}

async function update(userId, addressId, body) {
  const address = await Address.findById(addressId);
  if (!address || address.user.toString() !== userId.toString()) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Address not found');
  }
  const updatable = ['fullName', 'phone', 'line1', 'line2', 'city', 'state', 'postalCode', 'country', 'isDefault'];
  for (const field of updatable) {
    if (body[field] !== undefined) address[field] = body[field];
  }
  if (body.isDefault === true) {
    await Address.updateMany({ user: userId, _id: { $ne: addressId } }, { $set: { isDefault: false } });
  }
  await address.save();
  return address;
}

async function remove(userId, addressId) {
  const address = await Address.findById(addressId);
  if (!address || address.user.toString() !== userId.toString()) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Address not found');
  }
  await address.deleteOne();
}

/** Ownership-checked fetch used by order creation. */
async function getOwned(userId, addressId) {
  const address = await Address.findById(addressId);
  if (!address || address.user.toString() !== userId.toString()) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Address not found');
  }
  return address;
}

module.exports = { listForUser, create, update, remove, getOwned };
