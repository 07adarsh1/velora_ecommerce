const mongoose = require('mongoose');
const { INVENTORY_REASONS } = require('../config/constants');

// Append-only audit log. Product.stock remains the single source of truth for
// "current stock" — never derive it by summing history (PRD §7.11).
const inventoryHistorySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    variantSku: { type: String, default: null },
    change: { type: Number, required: true }, // + restock, − decrement
    reason: { type: String, enum: Object.values(INVENTORY_REASONS), required: true },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    adminUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    stockAfter: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

inventoryHistorySchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model('InventoryHistory', inventoryHistorySchema);
