const express = require('express');
const orderController = require('../controllers/order.controller');
const productController = require('../controllers/product.controller');
const paymentController = require('../controllers/payment.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');
const {
  adminListOrdersQuery,
  adminUpdateStatusSchema,
  shipmentSchema,
  rejectReturnSchema,
  idParam,
} = require('../validators/order.validator');
const { mongoId, paginationQuery, booleanQuery } = require('../validators/common');
const z = require('zod');

const router = express.Router();

// Every route here requires an admin role — authorization is enforced
// server-side regardless of what the frontend shows (PRD §3).
router.use(authenticate, authorize('admin'));

// ── Orders (§12.8) ───────────────────────────────────────────────────────────

router.get('/orders', validate(adminListOrdersQuery), asyncHandler(orderController.adminList));
router.patch('/orders/:id/status', validate(adminUpdateStatusSchema), asyncHandler(orderController.adminUpdateStatus));
router.patch('/orders/:id/shipment', validate(shipmentSchema), asyncHandler(orderController.adminUpdateShipment));
router.post('/orders/:id/return/approve', validate(idParam), asyncHandler(orderController.adminApproveReturn));
router.post('/orders/:id/return/reject', validate(rejectReturnSchema), asyncHandler(orderController.adminRejectReturn));

// ── Payments (§12.9) ─────────────────────────────────────────────────────────
router.post('/payments/:id/refund', validate(idParam), asyncHandler(paymentController.refund));

// ── Inventory (§12.12) ───────────────────────────────────────────────────────
const inventoryListQuery = z.object({
  query: paginationQuery.extend({
    lowStock: booleanQuery.optional(),
    outOfStock: booleanQuery.optional(),
  }),
});
const productHistoryParams = z.object({ params: z.object({ productId: mongoId }) });

router.get('/inventory', validate(inventoryListQuery), asyncHandler(productController.listInventory));
router.get('/inventory/:productId/history', validate(productHistoryParams), asyncHandler(productController.inventoryHistory));

// ── Coupons (§12.11) ─────────────────────────────────────────────────────────
const couponController = require('../controllers/coupon.controller');
const {
  createCouponSchema,
  updateCouponSchema,
  listCouponsQuery,
  idParam: couponIdParam,
} = require('../validators/coupon.validator');

router.get('/coupons', validate(listCouponsQuery), asyncHandler(couponController.list));
router.post('/coupons', validate(createCouponSchema), asyncHandler(couponController.create));
router.patch('/coupons/:id', validate(couponIdParam), validate(updateCouponSchema), asyncHandler(couponController.update));
router.delete('/coupons/:id', validate(couponIdParam), asyncHandler(couponController.remove));

module.exports = router;
