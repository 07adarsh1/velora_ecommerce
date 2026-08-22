const categoryService = require('../services/categoryService');
const { sendSuccess } = require('../utils/ApiResponse');

async function list(_req, res) {
  return sendSuccess(res, { data: await categoryService.list() });
}

async function create(req, res) {
  return sendSuccess(res, { status: 201, data: await categoryService.create(req.body), message: 'Category created' });
}

async function update(req, res) {
  return sendSuccess(res, { data: await categoryService.update(req.params.id, req.body), message: 'Category updated' });
}

async function remove(req, res) {
  await categoryService.remove(req.params.id);
  return sendSuccess(res, { message: 'Category deleted' });
}

module.exports = { list, create, update, remove };
