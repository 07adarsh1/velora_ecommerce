const orderService = require('../services/orderService');
const { sendSuccess, buildPagination } = require('../utils/ApiResponse');

async function create(req, res) {
  const order = await orderService.createOrder(req.user.id, req.body);
  return sendSuccess(res, {
    status: 201,
    data: order,
    message: 'Order created — complete payment to confirm it',
  });
}

async function listMine(req, res) {
  const { status, page, limit } = req.query;
  const { orders, total } = await orderService.listForUser(req.user.id, { status, page, limit });
  return sendSuccess(res, { data: orders, pagination: buildPagination({ page, limit, total }) });
}

async function getOne(req, res) {
  return sendSuccess(res, { data: await orderService.getOrderForUser(req.params.id, req.user) });
}

async function cancel(req, res) {
  const order = await orderService.cancelOrder(req.params.id, { reason: req.body.reason, actor: req.user });
  return sendSuccess(res, { data: order, message: 'Order cancelled' });
}

async function requestReturn(req, res) {
  const order = await orderService.requestReturn(req.params.id, req.user.id, req.body.reason);
  return sendSuccess(res, { data: order, message: 'Return requested' });
}

// ── Admin ────────────────────────────────────────────────────────────────────

async function adminList(req, res) {
  const { orders, total } = await orderService.listAll(req.query);
  const { page, limit } = req.query;
  return sendSuccess(res, { data: orders, pagination: buildPagination({ page, limit, total }) });
}

async function adminUpdateStatus(req, res) {
  const order = await orderService.adminUpdateStatus(req.params.id, req.body.status, req.body.note);
  return sendSuccess(res, { data: order, message: `Order status: ${order.status}` });
}

async function adminUpdateShipment(req, res) {
  const order = await orderService.updateShipment(req.params.id, req.body);
  return sendSuccess(res, { data: order, message: 'Shipment recorded' });
}

async function adminApproveReturn(req, res) {
  const order = await orderService.approveReturn(req.params.id);
  return sendSuccess(res, { data: order, message: 'Return approved and refunded' });
}

async function adminRejectReturn(req, res) {
  const order = await orderService.rejectReturn(req.params.id, req.body.note);
  return sendSuccess(res, { data: order, message: 'Return rejected' });
}

module.exports = {
  create,
  listMine,
  getOne,
  cancel,
  requestReturn,
  adminList,
  adminUpdateStatus,
  adminUpdateShipment,
  adminApproveReturn,
  adminRejectReturn,
};
