const analyticsService = require('../services/analyticsService');
const { sendSuccess } = require('../utils/ApiResponse');

async function summary(_req, res) {
  return sendSuccess(res, { data: await analyticsService.summary() });
}

async function salesTrend(req, res) {
  return sendSuccess(res, { data: await analyticsService.salesTrend(req.query) });
}

async function topProducts(req, res) {
  return sendSuccess(res, { data: await analyticsService.topProducts(req.query) });
}

async function revenueByCategory(req, res) {
  return sendSuccess(res, { data: await analyticsService.revenueByCategory(req.query) });
}

module.exports = { summary, salesTrend, topProducts, revenueByCategory };
