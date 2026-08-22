const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');

/** Recomputes Product.averageRating / numReviews after any review change (PRD §4.5). */
async function recalcDenormalized(productId) {
  // Cast to ObjectId — aggregation $match does not auto-cast strings.
  const [agg] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        averageRating: agg ? Math.round(agg.avg * 10) / 10 : 0,
        numReviews: agg ? agg.count : 0,
      },
    }
  );
}

async function listForProduct(productId, { page, limit }) {
  const [reviews, total] = await Promise.all([
    Review.find({ product: productId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name')
      .lean(),
    Review.countDocuments({ product: productId }),
  ]);
  return { reviews, total, page, limit };
}

async function create(userId, productId, { rating, comment }) {
  const product = await Product.findById(productId);
  if (!product || !product.isPublished) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Product not found');

  const existing = await Review.findOne({ product: productId, user: userId });
  if (existing) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'You have already reviewed this product');
  }

  // Verified purchase is computed server-side: a DELIVERED order of this user
  // containing this product (PRD §4.5). Never client-supplied.
  const verified = await Order.exists({
    user: userId,
    status: 'DELIVERED',
    'items.product': productId,
  });

  const review = await Review.create({
    product: productId,
    user: userId,
    rating,
    comment,
    verifiedPurchase: Boolean(verified),
  });
  await recalcDenormalized(productId);
  return review;
}

async function update(reviewId, userId, { rating, comment }) {
  const review = await Review.findById(reviewId);
  if (!review) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Review not found');
  // Ownership check, not just auth (PRD §4.5).
  if (review.user.toString() !== userId.toString()) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'You can only edit your own review');
  }
  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment;
  await review.save();
  await recalcDenormalized(review.product);
  return review;
}

async function remove(reviewId, user) {
  const review = await Review.findById(reviewId);
  if (!review) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Review not found');
  const isOwner = review.user.toString() === user.id.toString();
  if (!isOwner && user.role !== 'admin') {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'You can only delete your own review');
  }
  await review.deleteOne();
  await recalcDenormalized(review.product);
}

module.exports = { listForProduct, create, update, remove, recalcDenormalized };
