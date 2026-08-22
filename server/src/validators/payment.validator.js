const z = require('zod');
const { mongoId } = require('./common');

const createGatewayPaymentSchema = z.object({
  body: z.object({ orderId: mongoId }),
});

const verifyPaymentSchema = z.object({
  body: z.object({
    orderId: mongoId,
    gatewayOrderId: z.string().trim().min(3).max(100),
    gatewayPaymentId: z.string().trim().min(3).max(100),
    signature: z.string().trim().min(16).max(256),
  }),
});

const mockPaySchema = z.object({
  body: z.object({
    gatewayOrderId: z.string().trim().min(3).max(100),
    succeed: z.boolean().default(true),
  }),
});

const idParam = z.object({ params: z.object({ id: mongoId }) });

module.exports = { createGatewayPaymentSchema, verifyPaymentSchema, mockPaySchema, idParam };
