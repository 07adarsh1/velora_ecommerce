const reviewService = require('../services/reviewService');
const { sendSuccess, buildPagination } = require('../utils/ApiResponse');

async function listForProduct(req, res) {
  const { page, limit } = req.query;
  const { reviews, total } = await reviewService.listForProduct(req.params.id, { page, limit });
  return sendSuccess(res, { data: reviews, pagination: buildPagination({ page, limit, total }) });
}

async function create(req, res) {
  const review = await reviewService.create(req.user.id, req.params.id, req.body);
  return sendSuccess(res, { status: 201, data: review, message: 'Review posted' });
}

async function update(req, res) {
  const review = await reviewService.update(req.params.id, req.user.id, req.body);
  return sendSuccess(res, { data: review, message: 'Review updated' });
}

async function remove(req, res) {
  await reviewService.remove(req.params.id, req.user);
  return sendSuccess(res, { message: 'Review deleted' });
}

module.exports = { listForProduct, create, update, remove };
