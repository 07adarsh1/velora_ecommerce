const z = require('zod');
const { ROLES } = require('../config/constants');

const listUsersQuery = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const userIdParam = z.object({ params: z.object({ id: mongoId }) });

const updateStatusSchema = z.object({
  body: z.object({ isActive: z.boolean() }),
});

const updateRoleSchema = z.object({
  body: z.object({ role: z.enum([ROLES.CUSTOMER, ROLES.ADMIN]) }),
});

module.exports = { listUsersQuery, userIdParam, updateStatusSchema, updateRoleSchema, mongoId };
