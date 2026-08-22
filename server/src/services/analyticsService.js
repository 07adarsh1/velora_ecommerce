const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const env = require('../config/env');

// Orders that count toward revenue: paid and not refunded (PRD §5.1).
const REVENUE_MATCH = { paymentStatus: 'PAID', status: { $ne: 'REFUNDED' } };

function dateRange({ from, to } = {}) {
  const now = new Date();
  const start = from ? new Date(from) : new Date(now.getTime() - 30 * 86400000);
  const end = to ? new Date(`${to}T23:59:59.999Z`) : now;
  return { $gte: start, $lte: end };
}

async function summary() {
  const [revenueAgg, totals, statusCounts, lowStock, failedPayments] = await Promise.all([
    Order.aggregate([
      { $match: REVENUE_MATCH },
      { $group: { _id: null, revenue: { $sum: '$pricing.total' }, orderCount: { $sum: 1 } } },
    ]),
    Promise.all([Order.estimatedDocumentCount(), User.countDocuments({ role: 'customer' }), Product.estimatedDocumentCount()]),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Product.countDocuments({
      $or: [
        { variants: { $elemMatch: { stock: { $gt: 0, $lte: env.LOW_STOCK_THRESHOLD } } } },
        { $and: [{ variants: { $size: 0 } }, { stock: { $gt: 0, $lte: env.LOW_STOCK_THRESHOLD } }] },
      ],
    }),
    Order.countDocuments({ status: 'PAYMENT_FAILED' }),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
  return {
    totalRevenue: Math.round(revenueAgg[0]?.revenue ?? 0),
    paidOrders: revenueAgg[0]?.orderCount ?? 0,
    totalOrders: totals[0],
    totalCustomers: totals[1],
    totalProducts: totals[2],
    lowStockCount: lowStock,
    pendingOrders: byStatus.PENDING_PAYMENT ?? 0,
    processingOrders: (byStatus.PAYMENT_CONFIRMED ?? 0) + (byStatus.PROCESSING ?? 0),
    completedOrders: byStatus.DELIVERED ?? 0,
    cancelledOrders: byStatus.CANCELLED ?? 0,
    failedPayments,
    lowStockThreshold: env.LOW_STOCK_THRESHOLD,
  };
}

async function salesTrend({ from, to, interval = 'day' } = {}) {
  const unit = interval === 'week' ? 'week' : 'day';
  return Order.aggregate([
    { $match: { ...REVENUE_MATCH, createdAt: dateRange({ from, to }) } },
    {
      $group: {
        _id: { $dateTrunc: { date: '$createdAt', unit } },
        revenue: { $sum: '$pricing.total' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', revenue: { $round: ['$revenue', 2] }, orders: 1 } },
  ]);
}

async function topProducts({ from, to, limit = 10 } = {}) {
  return Order.aggregate([
    { $match: { ...REVENUE_MATCH, createdAt: dateRange({ from, to }) } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.name' },
        unitsSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
      },
    },
    { $sort: { unitsSold: -1 } },
    { $limit: limit },
    { $project: { _id: 1, name: 1, unitsSold: 1, revenue: { $round: ['$revenue', 2] } } },
  ]);
}

async function revenueByCategory({ from, to } = {}) {
  return Order.aggregate([
    { $match: { ...REVENUE_MATCH, createdAt: dateRange({ from, to }) } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$product.category',
        revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
        unitsSold: { $sum: '$items.quantity' },
      },
    },
    {
      $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' },
    },
    {
      $project: {
        _id: 0,
        categoryId: '$_id',
        category: { $first: '$category.name' },
        revenue: { $round: ['$revenue', 2] },
        unitsSold: 1,
      },
    },
    { $sort: { revenue: -1 } },
  ]);
}

module.exports = { summary, salesTrend, topProducts, revenueByCategory };
