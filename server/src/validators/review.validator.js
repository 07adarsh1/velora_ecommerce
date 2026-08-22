const z = require('zod');
const { mongoId, paginationQuery } = require('./common');

const createReviewSchema = z.object({
  params: z.object({ id: mongoId }),
  body: z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
  }),
});

const reviewIdParam = z.object({ params: z.object({ id: mongoId }) });

const updateReviewSchema = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().trim().max(2000).optional(),
  }),
});

const listReviewsQuery = z.object({ query: paginationQuery });

module.exports = { createReviewSchema, reviewIdParam, updateReviewSchema, listReviewsQuery };
