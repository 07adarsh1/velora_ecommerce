const z = require('zod');
const { mongoId, booleanQuery } = require('./common');

const variantSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  attributes: z.object({ size: z.string().trim().max(50).optional(), color: z.string().trim().max(50).optional() }).default({}),
  price: z.number().min(0).optional(),
  stock: z.number().int().min(0).default(0),
});

const productBody = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().max(220).optional(),
  description: z.string().trim().min(10).max(5000),
  brand: z.string().trim().max(100).optional(),
  category: mongoId,
  images: z.array(z.string().url()).max(8).default([]),
  basePrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).default(0),
  variants: z.array(variantSchema).max(50).default([]),
  stock: z.number().int().min(0).default(0),
  isPublished: z.boolean().default(true),
});

const createProductSchema = z.object({ body: productBody });

const updateProductSchema = z.object({
  body: productBody.partial(),
});

const listProductsQuery = z.object({
  query: z.object({
    search: z.string().trim().max(200).optional(),
    category: z.string().trim().max(220).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    rating: z.coerce.number().min(0).max(5).optional(),
    inStock: booleanQuery.optional(),
    sort: z.enum(['newest', 'price', '-price', 'rating', 'popularity']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

const adjustStockSchema = z.object({
  body: z.object({
    variantSku: z.string().trim().max(64).nullable().default(null),
    change: z.number().int().refine((v) => v !== 0, 'Change must be non-zero'),
    reason: z.string().trim().min(3).max(200),
  }),
});

const idParam = z.object({ params: z.object({ id: mongoId }) });

const slugParam = z.object({ params: z.object({ slug: z.string().trim().min(1).max(220) }) });

module.exports = {
  createProductSchema,
  updateProductSchema,
  listProductsQuery,
  adjustStockSchema,
  idParam,
  slugParam,
};
