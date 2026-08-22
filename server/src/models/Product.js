const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, sparse: true, uppercase: true, trim: true },
    attributes: {
      size: { type: String, trim: true },
      color: { type: String, trim: true },
    },
    price: { type: Number, min: 0 }, // overrides basePrice when set
    stock: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    brand: { type: String, trim: true, maxlength: 100 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    images: { type: [String], default: [] },
    basePrice: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    variants: { type: [variantSchema], default: [] },
    // Top-level stock for products without variants; authoritative while
    // variants.length === 0 (PRD §7.2).
    stock: { type: Number, required: true, min: 0, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0, min: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// MVP text search over name + description (PRD §4.2).
productSchema.index({ name: 'text', description: 'text' });
// Supports the price-range filter and price sorts on the PLP.
productSchema.index({ basePrice: 1 });
productSchema.index({ category: 1, isPublished: 1 });
productSchema.index({ createdAt: -1 });

/** Effective unit price for a (product, variant) pair, discounts included. */
productSchema.methods.effectiveUnitPrice = function effectiveUnitPrice(variantSku = null) {
  const base = this.basePrice;
  if (!variantSku) return round2(base * (1 - this.discountPercent / 100));
  const variant = this.variants.find((v) => v.sku === variantSku);
  if (!variant) return null;
  const unit = variant.price ?? base;
  return round2(unit * (1 - this.discountPercent / 100));
};

/** Authoritative stock for a variant, or top-level stock when no variant. */
productSchema.methods.stockFor = function stockFor(variantSku = null) {
  if (!variantSku) return this.stock;
  const variant = this.variants.find((v) => v.sku === variantSku);
  return variant ? variant.stock : 0;
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = mongoose.model('Product', productSchema);
