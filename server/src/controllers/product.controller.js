const productService = require('../services/productService');
const inventoryService = require('../services/inventoryService');
const { sendSuccess, buildPagination } = require('../utils/ApiResponse');

async function list(req, res) {
  const { products, total, page, limit } = await productService.listProducts(req.query);
  return sendSuccess(res, { data: products, pagination: buildPagination({ page, limit, total }) });
}

async function getBySlug(req, res) {
  // Admins may preview unpublished products from the admin editor.
  const allowUnpublished = req.user?.role === 'admin';
  const product = await productService.getBySlug(req.params.slug, { allowUnpublished });
  return sendSuccess(res, { data: product });
}

async function getRelated(req, res) {
  const products = await productService.getRelated(req.params.id);
  return sendSuccess(res, { data: products });
}

async function create(req, res) {
  const product = await productService.createProduct(req.body);
  return sendSuccess(res, { status: 201, data: product, message: 'Product created' });
}

async function update(req, res) {
  const product = await productService.updateProduct(req.params.id, req.body);
  return sendSuccess(res, { data: product, message: 'Product updated' });
}

async function remove(req, res) {
  const product = await productService.deleteProduct(req.params.id);
  return sendSuccess(res, { data: product, message: 'Product unpublished (soft-deleted)' });
}

async function uploadImages(req, res) {
  // multer puts multipart file buffers on req.files; URL strings on req.body.urls
  const urls = [];
  if (Array.isArray(req.body?.urls)) urls.push(...req.body.urls);

  if (req.files?.length) {
    const imageStorage = require('../services/imageStorage');
    const uploaded = await Promise.all(req.files.map((f) => imageStorage.upload(f.buffer, f.originalname)));
    urls.push(...uploaded);
  }
  if (urls.length === 0) {
    const ApiError = require('../utils/ApiError');
    const { ERROR_CODES } = require('../config/constants');
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'No images provided');
  }
  const product = await productService.addImages(req.params.id, urls);
  return sendSuccess(res, { data: product, message: `${urls.length} image(s) added` });
}

async function adjustStock(req, res) {
  const product = await inventoryService.manualAdjust(req.params.id, req.body, req.user.id);
  return sendSuccess(res, { data: product, message: 'Stock adjusted' });
}

async function listInventory(req, res) {
  const { page, limit } = req.query;
  const { items, total, threshold } = await inventoryService.listInventory({ ...req.query, page, limit });
  return sendSuccess(res, {
    data: items,
    pagination: buildPagination({ page, limit, total }),
    message: `low-stock threshold: ${threshold}`,
  });
}

async function inventoryHistory(req, res) {
  const { page, limit } = req.query;
  const { entries, total } = await inventoryService.historyForProduct(req.params.productId, { page, limit });
  return sendSuccess(res, { data: entries, pagination: buildPagination({ page, limit, total }) });
}

module.exports = {
  list,
  getBySlug,
  getRelated,
  create,
  update,
  remove,
  uploadImages,
  adjustStock,
  listInventory,
  inventoryHistory,
};
