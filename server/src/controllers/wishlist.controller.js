const wishlistService = require('../services/wishlistService');
const { sendSuccess } = require('../utils/ApiResponse');

async function getWishlist(req, res) {
  return sendSuccess(res, { data: await wishlistService.getWishlist(req.user.id) });
}

async function addItem(req, res) {
  return sendSuccess(res, { status: 201, data: await wishlistService.addItem(req.user.id, req.body.productId) });
}

async function removeItem(req, res) {
  return sendSuccess(res, { data: await wishlistService.removeItem(req.user.id, req.params.productId) });
}

async function moveToCart(req, res) {
  const data = await wishlistService.moveToCart(req.user.id, req.params.productId, {
    quantity: req.body?.quantity ?? 1,
  });
  return sendSuccess(res, { data, message: 'Moved to cart' });
}

module.exports = { getWishlist, addItem, removeItem, moveToCart };
