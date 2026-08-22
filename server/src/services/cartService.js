const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');
const pricingService = require('./pricingService');
const couponService = require('./couponService');

async function findOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

/**
 * Builds the enriched cart view: live product data + authoritative
 * server-computed price breakdown. `priceAtAdd` is only a UI hint for "price
 * changed since you added this" — the effective price is always recalculated.
 */
async function getCartView(userId) {
  const cart = await findOrCreateCart(userId);
  const products = await Product.find({ _id: { $in: cart.items.map((i) => i.product) } });
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  const items = [];
  for (const item of cart.items) {
    const product = byId.get(item.product.toString());
    if (!product) {
      items.push({
        product: item.product,
        variantSku: item.variantSku,
        quantity: item.quantity,
        unavailable: true,
      });
      continue;
    }
    if (item.variantSku && !product.variants.some((v) => v.sku === item.variantSku)) {
      items.push({ product: item.product, variantSku: item.variantSku, quantity: item.quantity, unavailable: true });
      continue;
    }
    const unitPrice = product.effectiveUnitPrice(item.variantSku);
    const stock = product.stockFor(item.variantSku);
    items.push({
      product: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images[0] || null,
        brand: product.brand,
      },
      variantSku: item.variantSku,
      quantity: item.quantity,
      unitPrice,
      priceAtAdd: item.priceAtAdd,
      stock,
      inStock: stock >= item.quantity,
      unavailable: false,
    });
  }

  // Coupon validity is re-checked against the CURRENT subtotal every time the
  // cart is read or mutated (PRD §4.3) — never trusted from a previous apply.
  let couponSnapshot = null;
  let pricingItems = items.filter((i) => !i.unavailable).map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity }));
  if (cart.appliedCoupon) {
    const coupon = await Coupon.findById(cart.appliedCoupon);
    try {
      couponService.checkValid(coupon, {
        userId,
        subtotal: pricingItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
      });
      couponSnapshot = { _id: coupon._id, code: coupon.code, type: coupon.type, value: coupon.value };
    } catch {
      couponSnapshot = null; // silently dropped from the view; client sees no discount
    }
  }

  const pricing = pricingService.computePricing(pricingItems, couponSnapshot);
  return { cart: { _id: cart._id, items, appliedCoupon: couponSnapshot }, pricing };
}

async function addItem(userId, { productId, variantSku = null, quantity }) {
  const product = await Product.findById(productId);
  if (!product || !product.isPublished) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Product not found');
  if (variantSku) {
    if (!product.variants.some((v) => v.sku === variantSku)) {
      throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Variant not found');
    }
  } else if (product.variants.length > 0) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Product requires a variant selection');
  }

  // Soft stock check on every mutation — the hard, atomic check happens at
  // payment confirmation (PRD §12.5, §11.4).
  const stock = product.stockFor(variantSku);
  if (quantity > stock) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, stock === 0 ? 'Out of stock' : `Only ${stock} left in stock`);
  }

  const cart = await findOrCreateCart(userId);
  const existing = cart.items.find(
    (i) => i.product.toString() === productId.toString() && i.variantSku === variantSku
  );
  if (existing) {
    const newQty = existing.quantity + quantity;
    if (newQty > stock) throw new ApiError(409, ERROR_CODES.CONFLICT, `Only ${stock} left in stock`);
    existing.quantity = newQty;
    existing.priceAtAdd = product.effectiveUnitPrice(variantSku);
  } else {
    cart.items.push({
      product: productId,
      variantSku,
      quantity,
      priceAtAdd: product.effectiveUnitPrice(variantSku),
    });
  }
  await cart.save();
  return getCartView(userId);
}

async function updateItem(userId, productId, { variantSku = null, quantity }) {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Cart item not found');

  const item = cart.items.find((i) => i.product.toString() === productId.toString() && i.variantSku === variantSku);
  if (!item) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Cart item not found');

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Product not found');

  if (quantity > product.stockFor(variantSku)) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, `Only ${product.stockFor(variantSku)} left in stock`);
  }
  item.quantity = quantity;
  await cart.save();
  return getCartView(userId);
}

async function removeItem(userId, productId, { variantSku = null } = {}) {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) return getCartView(userId);
  cart.items = cart.items.filter(
    (i) => !(i.product.toString() === productId.toString() && i.variantSku === variantSku)
  );
  await cart.save();
  return getCartView(userId);
}

/** Merges a guest (localStorage) cart into the server cart at login (PRD §4.3). */
async function mergeGuestCart(userId, guestItems) {
  const cart = await findOrCreateCart(userId);

  // Combine guest quantities per (product, variant) first.
  const wanted = new Map();
  for (const gi of guestItems) {
    const key = `${gi.productId}|${gi.variantSku || ''}`;
    wanted.set(key, (wanted.get(key) || 0) + gi.quantity);
  }

  const products = await Product.find({ _id: { $in: [...new Set(guestItems.map((g) => g.productId))] } });
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  for (const [key, quantity] of wanted) {
    const [productId, variantSku] = key.split('|');
    const product = byId.get(productId);
    if (!product || !product.isPublished) continue;
    if (variantSku && !product.variants.some((v) => v.sku === variantSku)) continue;

    const stock = product.stockFor(variantSku || null);
    if (stock === 0) continue;

    const existing = cart.items.find(
      (i) => i.product.toString() === productId && i.variantSku === (variantSku || null)
    );
    const mergedQty = Math.min((existing ? existing.quantity : 0) + quantity, stock);
    if (existing) {
      existing.quantity = mergedQty;
    } else {
      cart.items.push({
        product: productId,
        variantSku: variantSku || null,
        quantity: mergedQty,
        priceAtAdd: product.effectiveUnitPrice(variantSku || null),
      });
    }
  }
  await cart.save();
  return getCartView(userId);
}

async function applyCoupon(userId, code) {
  const cart = await findOrCreateCart(userId);
  const view = await getCartView(userId);
  const coupon = await couponService.validateForCode(code, { userId, subtotal: view.pricing.subtotal });
  cart.appliedCoupon = coupon._id;
  await cart.save();
  return getCartView(userId);
}

async function removeCoupon(userId) {
  const cart = await findOrCreateCart(userId);
  cart.appliedCoupon = null;
  await cart.save();
  return getCartView(userId);
}

/** Called only from the payment-confirmation transaction (PRD §9.4 step 4). */
async function clearCart(userId, session = null) {
  await Cart.updateOne({ user: userId }, { $set: { items: [], appliedCoupon: null } }, { session });
}

module.exports = {
  getCartView,
  addItem,
  updateItem,
  removeItem,
  mergeGuestCart,
  applyCoupon,
  removeCoupon,
  clearCart,
};
