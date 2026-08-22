const couponService = require('../services/couponService');
const { sendSuccess, buildPagination } = require('../utils/ApiResponse');

async function list(req, res) {
  const { page, limit } = req.query;
  const { coupons, total } = await couponService.listCoupons({ page, limit });
  return sendSuccess(res, { data: coupons, pagination: buildPagination({ page, limit, total }) });
}

async function create(req, res) {
  return sendSuccess(res, { status: 201, data: await couponService.createCoupon(req.body), message: 'Coupon created' });
}

async function update(req, res) {
  return sendSuccess(res, { data: await couponService.updateCoupon(req.params.id, req.body), message: 'Coupon updated' });
}

async function remove(req, res) {
  await couponService.deleteCoupon(req.params.id);
  return sendSuccess(res, { message: 'Coupon deleted' });
}

module.exports = { list, create, update, remove };
