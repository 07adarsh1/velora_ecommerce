const express = require('express');
const orderController = require('../controllers/order.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const {
  createOrderSchema,
  listOrdersQuery,
  idParam,
  cancelSchema,
  returnSchema,
} = require('../validators/order.validator');

const router = express.Router();

router.use(authenticate);

router.post('/', validate(createOrderSchema), asyncHandler(orderController.create));
router.get('/', validate(listOrdersQuery), asyncHandler(orderController.listMine));
router.get('/:id', validate(idParam), asyncHandler(orderController.getOne));
router.post('/:id/cancel', validate(cancelSchema), asyncHandler(orderController.cancel));
router.post('/:id/return', validate(returnSchema), asyncHandler(orderController.requestReturn));

module.exports = router;
