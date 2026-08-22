const express = require('express');
const analyticsController = require('../controllers/analytics.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const z = require('zod');

const router = express.Router();

const querySchema = z.object({
  query: z.object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    interval: z.enum(['day', 'week']).default('day'),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

// All analytics are computed from real aggregation queries — nothing hardcoded (PRD §5.1).
router.get('/summary', authenticate, authorize('admin'), asyncHandler(analyticsController.summary));
router.get('/sales-trend', authenticate, authorize('admin'), validate(querySchema), asyncHandler(analyticsController.salesTrend));
router.get('/top-products', authenticate, authorize('admin'), validate(querySchema), asyncHandler(analyticsController.topProducts));
router.get('/revenue-by-category', authenticate, authorize('admin'), validate(querySchema), asyncHandler(analyticsController.revenueByCategory));

module.exports = router;
