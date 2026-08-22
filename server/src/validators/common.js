const z = require('zod');

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

// z.coerce.boolean() would treat the string "false" as true, so query-string
// booleans get an explicit parser.
const booleanQuery = z.preprocess((v) => v === 'true' || v === true, z.boolean());

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { mongoId, booleanQuery, paginationQuery };
