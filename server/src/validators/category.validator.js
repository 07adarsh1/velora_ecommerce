const z = require('zod');
const { mongoId } = require('./common');

const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    parent: mongoId.nullable().default(null),
  }),
});

const updateCategorySchema = z.object({
  body: z.object({ name: z.string().trim().min(2).max(100) }),
});

const idParam = z.object({ params: z.object({ id: mongoId }) });

module.exports = { createCategorySchema, updateCategorySchema, idParam };
