const express = require('express');
const reviewController = require('../controllers/review.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const {
  createReviewSchema,
  reviewIdParam,
  updateReviewSchema,
  listReviewsQuery,
} = require('../validators/review.validator');

const router = express.Router();

// Mounted at /api/reviews — see product.routes.js for /:id/reviews nesting.
router.patch('/:id', authenticate, validate(reviewIdParam), validate(updateReviewSchema), asyncHandler(reviewController.update));
router.delete('/:id', authenticate, validate(reviewIdParam), asyncHandler(reviewController.remove));

module.exports = router;
