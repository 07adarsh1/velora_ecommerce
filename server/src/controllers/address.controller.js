const addressService = require('../services/addressService');
const { sendSuccess } = require('../utils/ApiResponse');

async function list(req, res) {
  return sendSuccess(res, { data: await addressService.listForUser(req.user.id) });
}

async function create(req, res) {
  return sendSuccess(res, { status: 201, data: await addressService.create(req.user.id, req.body), message: 'Address saved' });
}

async function update(req, res) {
  return sendSuccess(res, { data: await addressService.update(req.user.id, req.params.id, req.body), message: 'Address updated' });
}

async function remove(req, res) {
  await addressService.remove(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Address deleted' });
}

module.exports = { list, create, update, remove };
