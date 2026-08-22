const express = require('express');
const cartController = require('../controllers/cart.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const {
  addItemSchema,
  updateItemSchema,
  productIdParam,
  mergeSchema,
  couponSchema,
} = require('../validators/cart.validator');

const router = express.Router();

router.use(authenticate);

router.get('/', asyncHandler(cartController.getCart));
router.post('/items', validate(addItemSchema), asyncHandler(cartController.addItem));
router.patch('/items/:productId', validate(updateItemSchema), asyncHandler(cartController.updateItem));
router.delete('/items/:productId', validate(productIdParam), asyncHandler(cartController.removeItem));
router.post('/merge', validate(mergeSchema), asyncHandler(cartController.merge));
router.post('/coupon', validate(couponSchema), asyncHandler(cartController.applyCoupon));
router.delete('/coupon', asyncHandler(cartController.removeCoupon));

module.exports = router;
