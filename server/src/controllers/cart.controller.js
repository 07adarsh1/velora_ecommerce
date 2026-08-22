const cartService = require('../services/cartService');
const { sendSuccess } = require('../utils/ApiResponse');

async function getCart(req, res) {
  return sendSuccess(res, { data: await cartService.getCartView(req.user.id) });
}

async function addItem(req, res) {
  return sendSuccess(res, { status: 201, data: await cartService.addItem(req.user.id, req.body), message: 'Added to cart' });
}

async function updateItem(req, res) {
  const data = await cartService.updateItem(req.user.id, req.params.productId, {
    variantSku: req.body.variantSku,
    quantity: req.body.quantity,
  });
  return sendSuccess(res, { data });
}

async function removeItem(req, res) {
  const data = await cartService.removeItem(req.user.id, req.params.productId, {
    variantSku: req.query.variantSku === 'null' ? null : req.query.variantSku,
  });
  return sendSuccess(res, { data });
}

async function merge(req, res) {
  return sendSuccess(res, { data: await cartService.mergeGuestCart(req.user.id, req.body.items) });
}

async function applyCoupon(req, res) {
  return sendSuccess(res, { data: await cartService.applyCoupon(req.user.id, req.body.code), message: 'Coupon applied' });
}

async function removeCoupon(req, res) {
  return sendSuccess(res, { data: await cartService.removeCoupon(req.user.id), message: 'Coupon removed' });
}

module.exports = { getCart, addItem, updateItem, removeItem, merge, applyCoupon, removeCoupon };
