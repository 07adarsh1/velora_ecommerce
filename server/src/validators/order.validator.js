const z = require('zod');
const { mongoId, paginationQuery } = require('./common');
const { ORDER_STATUS } = require('../config/constants');

const createOrderSchema = z.object({
  body: z.object({
    addressId: mongoId,
    couponCode: z.string().trim().min(2).max(64).optional(),
  }),
});

const listOrdersQuery = z.object({
  query: paginationQuery.extend({
    status: z.enum(Object.values(ORDER_STATUS)).optional(),
  }),
});

const idParam = z.object({ params: z.object({ id: mongoId }) });

const cancelSchema = z.object({
  params: z.object({ id: mongoId }),
  body: z.object({ reason: z.string().trim().max(500).optional() }).default({}),
});

const returnSchema = z.object({
  params: z.object({ id: mongoId }),
  body: z.object({ reason: z.string().trim().min(3).max(500) }),
});

const adminListOrdersQuery = paginationQuery.extend({
  status: z.enum(Object.values(ORDER_STATUS)).optional(),
  search: z.string().trim().max(100).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

const adminUpdateStatusSchema = z.object({
  params: z.object({ id: mongoId }),
  body: z.object({
    status: z.enum(Object.values(ORDER_STATUS)),
    note: z.string().trim().max(500).optional(),
  }),
});

const shipmentSchema = z.object({
  params: z.object({ id: mongoId }),
  body: z.object({
    carrier: z.string().trim().min(2).max(100),
    trackingNumber: z.string().trim().min(2).max(100),
  }),
});

const rejectReturnSchema = z.object({
  params: z.object({ id: mongoId }),
  body: z.object({ note: z.string().trim().max(500).optional() }).default({}),
});

module.exports = {
  createOrderSchema,
  listOrdersQuery,
  idParam,
  cancelSchema,
  returnSchema,
  adminListOrdersQuery,
  adminUpdateStatusSchema,
  shipmentSchema,
  rejectReturnSchema,
};
