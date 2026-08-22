const mongoose = require('mongoose');
const Product = require('../models/Product');
const InventoryHistory = require('../models/InventoryHistory');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES, INVENTORY_REASONS } = require('../config/constants');

/**
 * Decrements stock for every item of an order. Each decrement is a single
 * atomic findOneAndUpdate with the sufficiency check embedded in the filter —
 * there is no read-then-write window for a concurrent checkout to exploit
 * (PRD §11.2). Callers run this inside the payment-confirmation transaction,
 * so a failure on any item rolls back every decrement (PRD §11.3).
 */
async function decrementForOrder(order, session) {
  for (const item of order.items) {
    const filter = item.variantSku
      ? { _id: item.product, 'variants.sku': item.variantSku, 'variants.$.stock': { $gte: item.quantity } }
      : { _id: item.product, stock: { $gte: item.quantity } };
    const update = item.variantSku
      ? { $inc: { 'variants.$.stock': -item.quantity } }
      : { $inc: { stock: -item.quantity } };

    const updated = await Product.findOneAndUpdate(filter, update, { new: true, session });
    if (!updated) {
      throw new ApiError(409, ERROR_CODES.CONFLICT, `Insufficient stock for ${item.name}`);
    }
    const stockAfter = updated.stockFor(item.variantSku);
    await InventoryHistory.create(
      [
        {
          product: item.product,
          variantSku: item.variantSku || null,
          change: -item.quantity,
          reason: INVENTORY_REASONS.ORDER,
          relatedOrder: order._id,
          stockAfter,
        },
      ],
      { session }
    );
  }
}

/** Mirror-image restore for cancellations and approved returns (PRD §11.5). */
async function restoreForOrder(order, session, reason) {
  for (const item of order.items) {
    const filter = item.variantSku
      ? { _id: item.product, 'variants.sku': item.variantSku }
      : { _id: item.product };
    const update = item.variantSku
      ? { $inc: { 'variants.$.stock': item.quantity } }
      : { $inc: { stock: item.quantity } };

    const updated = await Product.findOneAndUpdate(filter, update, { new: true, session });
    if (!updated) continue; // product hard-removed; nothing to restore into

    const stockAfter = updated.stockFor(item.variantSku);
    await InventoryHistory.create(
      [
        {
          product: item.product,
          variantSku: item.variantSku || null,
          change: item.quantity,
          reason,
          relatedOrder: order._id,
          stockAfter,
        },
      ],
      { session }
    );
  }
}

/**
 * Manual stock adjustment from the admin inventory screen. Same atomic-guard
 * pattern for decrements; every adjustment writes an InventoryHistory entry
 * with the admin's identity (PRD §5.3).
 */
async function manualAdjust(productId, { variantSku = null, change, reason }, adminUser) {
  if (change === 0) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Change must be non-zero');

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Product not found');
  if (variantSku && !product.variants.some((v) => v.sku === variantSku)) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Variant not found');
  }
  if (!variantSku && product.variants.length > 0) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Product has variants — specify a variantSku');
  }

  const filter = { _id: productId };
  let update;
  if (variantSku) {
    filter['variants.sku'] = variantSku;
    update = { $inc: { 'variants.$.stock': change } };
    if (change < 0) filter['variants.$.stock'] = { $gte: -change };
  } else {
    update = { $inc: { stock: change } };
    if (change < 0) filter.stock = { $gte: -change };
  }

  const updated = await Product.findOneAndUpdate(filter, update, { new: true });
  if (!updated) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'Insufficient stock for this adjustment');
  }

  const stockAfter = updated.stockFor(variantSku);
  await InventoryHistory.create({
    product: productId,
    variantSku: variantSku || null,
    change,
    reason: INVENTORY_REASONS.MANUAL_ADJUSTMENT,
    adminUser,
    stockAfter,
  });
  return updated;
}

/**
 * Lists products with inventory flags for the admin inventory screen.
 * Low-stock = in stock but below LOW_STOCK_THRESHOLD on every sellable unit.
 */
async function listInventory({ lowStock, outOfStock, page, limit }) {
  const env = require('../config/env');
  const threshold = env.LOW_STOCK_THRESHOLD;
  const skip = (page - 1) * limit;

  const basePipeline = [
    { $addFields: { effectiveStock: { $cond: [{ $gt: [{ $size: { $ifNull: ['$variants', []] } }, 0] }, { $max: '$variants.stock' }, '$stock'] } } },
  ];

  let match = {};
  if (outOfStock === true || outOfStock === 'true') {
    match = { effectiveStock: { $eq: 0 } };
  } else if (lowStock === true || lowStock === 'true') {
    match = { effectiveStock: { $gt: 0, $lte: threshold } };
  }

  const [items, total] = await Promise.all([
    Product.aggregate([...basePipeline, { $match: match }, { $sort: { effectiveStock: 1, updatedAt: -1 } }, { $skip: skip }, { $limit: limit }]),
    Product.aggregate([...basePipeline, { $match: match }, { $count: 'total' }]),
  ]);
  return { items, total: total[0]?.total ?? 0, threshold };
}

async function historyForProduct(productId, { page, limit }) {
  const skip = (page - 1) * limit;
  const [entries, total] = await Promise.all([
    InventoryHistory.find({ product: productId }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('adminUser', 'name email'),
    InventoryHistory.countDocuments({ product: productId }),
  ]);
  return { entries, total };
}

module.exports = { decrementForOrder, restoreForOrder, manualAdjust, listInventory, historyForProduct };
