const env = require('../config/env');
const { round2 } = require('../utils/helpers');

/**
 * The single server-side price computation (PRD §4.3): the cart-preview
 * endpoint AND order creation both call this function, so the number the
 * customer sees is guaranteed to match what they are charged.
 *
 * Breakdown order: subtotal → discount → shipping → tax → total.
 * Tax is applied to the post-discount amount; shipping is not taxed.
 * (Flat-rate shipping + flat tax percentage are the stated MVP simplifications.)
 *
 * @param {Array<{unitPrice:number, quantity:number}>} items
 * @param {{type:'percentage'|'fixed', value:number, code?:string}|null} coupon
 */
function computePricing(items, coupon = null) {
  const subtotal = round2(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));

  let discount = 0;
  if (coupon) {
    if (coupon.type === 'percentage') {
      discount = round2((subtotal * coupon.value) / 100);
    } else {
      discount = round2(Math.min(coupon.value, subtotal));
    }
  }

  const shipping = subtotal > 0 ? round2(env.SHIPPING_FLAT_RATE) : 0;
  const taxable = round2(subtotal - discount);
  const tax = round2((taxable * env.TAX_RATE_PERCENT) / 100);
  const total = round2(taxable + shipping + tax);

  return {
    subtotal,
    discount,
    shipping,
    tax,
    total,
    ...(coupon ? { coupon: { code: coupon.code, discountApplied: discount } } : { coupon: null }),
  };
}

module.exports = { computePricing };
