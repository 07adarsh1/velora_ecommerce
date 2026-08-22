const z = require('zod');
const { mongoId, paginationQuery } = require('./common');

const couponBody = z.object({
  code: z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9_-]+$/, 'Code may contain letters, numbers, - and _'),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0),
  minOrderValue: z.number().min(0).default(0),
  expiresAt: z.coerce.date(),
  usageLimit: z.number().int().min(1).nullable().default(null),
  usageLimitPerUser: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
});

const createCouponSchema = z.object({ body: couponBody });
const updateCouponSchema = z.object({
  body: couponBody.omit({ code: true }).partial(),
});
const listCouponsQuery = z.object({ query: paginationQuery });
const idParam = z.object({ params: z.object({ id: mongoId }) });

module.exports = { createCouponSchema, updateCouponSchema, listCouponsQuery, idParam };
