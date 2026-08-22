const z = require('zod');
const { mongoId } = require('./common');

const addItemSchema = z.object({
  body: z.object({
    productId: mongoId,
    variantSku: z.string().trim().max(64).nullable().default(null),
    quantity: z.number().int().min(1).max(999).default(1),
  }),
});

const updateItemSchema = z.object({
  params: z.object({ productId: mongoId }),
  body: z.object({
    variantSku: z.string().trim().max(64).nullable().default(null),
    quantity: z.number().int().min(1).max(999),
  }),
});

const productIdParam = z.object({ params: z.object({ productId: mongoId }) });

const mergeSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          productId: mongoId,
          variantSku: z.string().trim().max(64).nullable().default(null),
          quantity: z.number().int().min(1).max(999),
        })
      )
      .max(100),
  }),
});

const couponSchema = z.object({
  body: z.object({ code: z.string().trim().min(2).max(64) }),
});

const moveToCartSchema = z.object({
  params: z.object({ productId: mongoId }),
  body: z.object({ quantity: z.number().int().min(1).max(999).default(1) }).default({}),
});

module.exports = { addItemSchema, updateItemSchema, productIdParam, mergeSchema, couponSchema, moveToCartSchema };
