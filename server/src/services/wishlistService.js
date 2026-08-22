const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');

async function findOrCreate(userId) {
  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) wishlist = await Wishlist.create({ user: userId, products: [] });
  return wishlist;
}

async function getWishlist(userId) {
  const wishlist = await findOrCreate(userId);
  await wishlist.populate({
    path: 'products',
    select: 'name slug basePrice discountPercent images averageRating numReviews stock variants isPublished brand',
  });
  // Unpublished products drop out of the wishlist view but stay in the list of
  // ids; simpler than eager cleanup and harmless.
  return { products: wishlist.products.filter((p) => p && p.isPublished) };
}

async function addItem(userId, productId) {
  const product = await Product.findById(productId);
  if (!product || !product.isPublished) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Product not found');

  const wishlist = await findOrCreate(userId);
  if (!wishlist.products.some((id) => id.toString() === productId.toString())) {
    wishlist.products.push(productId);
    await wishlist.save();
  }
  return getWishlist(userId);
}

async function removeItem(userId, productId) {
  const wishlist = await findOrCreate(userId);
  wishlist.products = wishlist.products.filter((id) => id.toString() !== productId.toString());
  await wishlist.save();
  return getWishlist(userId);
}

/**
 * One action, one API call (PRD §4.3): removes from the wishlist and adds to
 * the cart; a stock failure leaves the wishlist untouched.
 */
async function moveToCart(userId, productId, { quantity = 1 } = {}) {
  const cartService = require('./cartService');
  const updatedCart = await cartService.addItem(userId, { productId, quantity });

  await Wishlist.updateOne({ user: userId }, { $pull: { products: productId } });
  return { wishlist: await getWishlist(userId), cart: updatedCart };
}

module.exports = { getWishlist, addItem, removeItem, moveToCart };
