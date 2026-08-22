const express = require('express');
const paymentController = require('../controllers/payment.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const { createGatewayPaymentSchema, verifyPaymentSchema, mockPaySchema } = require('../validators/payment.validator');
const env = require('../config/env');

const router = express.Router();

// The webhook is signature-verified instead of authenticated (PRD §9.3);
// app.js captures its raw body before the global JSON parser.
router.post('/webhook', asyncHandler(paymentController.webhook));

router.post('/create-order', authenticate, validate(createGatewayPaymentSchema), asyncHandler(paymentController.createOrder));
router.post('/verify', authenticate, validate(verifyPaymentSchema), asyncHandler(paymentController.verify));

if (env.MOCK_PAYMENTS) {
  router.post('/mock-pay', authenticate, validate(mockPaySchema), asyncHandler(paymentController.mockPay));
}

module.exports = router;
