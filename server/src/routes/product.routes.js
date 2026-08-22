const express = require('express');
const multer = require('multer');

const productController = require('../controllers/product.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const optionalAuth = require('../middleware/optionalAuth');
const authorize = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');
const {
  createProductSchema,
  updateProductSchema,
  listProductsQuery,
  adjustStockSchema,
  idParam,
  slugParam,
} = require('../validators/product.validator');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 8 } });

const reviewController = require('../controllers/review.controller');
const {
  createReviewSchema,
  listReviewsQuery,
} = require('../validators/review.validator');

const router = express.Router();

router.get('/', validate(listProductsQuery), asyncHandler(productController.list));
router.get('/:slug', optionalAuth, validate(slugParam), asyncHandler(productController.getBySlug));
router.get('/:id/related', validate(idParam), asyncHandler(productController.getRelated));
router.get('/:id/reviews', validate(listReviewsQuery), asyncHandler(reviewController.listForProduct));
router.post(
  '/:id/reviews',
  authenticate,
  validate(createReviewSchema),
  asyncHandler(reviewController.create)
);

router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate(createProductSchema),
  asyncHandler(productController.create)
);
router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(idParam),
  validate(updateProductSchema),
  asyncHandler(productController.update)
);
router.delete('/:id', authenticate, authorize('admin'), validate(idParam), asyncHandler(productController.remove));
router.post(
  '/:id/images',
  authenticate,
  authorize('admin'),
  validate(idParam),
  upload.array('images', 8),
  asyncHandler(productController.uploadImages)
);
router.patch(
  '/:id/stock',
  authenticate,
  authorize('admin'),
  validate(idParam),
  validate(adjustStockSchema),
  asyncHandler(productController.adjustStock)
);

module.exports = router;
