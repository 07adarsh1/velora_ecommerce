const z = require('zod');
const { mongoId } = require('./common');

const addressBody = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^[+0-9 ()-]{7,20}$/, 'Invalid phone number'),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().regex(/^[A-Za-z0-9 -]{3,12}$/, 'Invalid postal code'),
  country: z.string().trim().min(2).max(100),
  isDefault: z.boolean().default(false),
});

const createAddressSchema = z.object({ body: addressBody });

const updateAddressSchema = z.object({
  params: z.object({ id: mongoId }),
  body: addressBody.partial(),
});

const idParam = z.object({ params: z.object({ id: mongoId }) });

module.exports = { createAddressSchema, updateAddressSchema, idParam };
