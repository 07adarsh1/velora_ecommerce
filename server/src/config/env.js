const z = require('zod');
require('dotenv').config();

const commaSeparatedOrigins = z
  .string()
  .default('http://localhost:3000')
  .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    ACCESS_TOKEN_SECRET: z.string().min(32, 'ACCESS_TOKEN_SECRET must be at least 32 chars'),
    REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 chars'),
    ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    PASSWORD_RESET_EXPIRY_MINUTES: z.coerce.number().int().positive().default(30),
    CLIENT_ORIGIN: commaSeparatedOrigins,
    TAX_RATE_PERCENT: z.coerce.number().min(0).max(100).default(18),
    SHIPPING_FLAT_RATE: z.coerce.number().min(0).default(49),
    LOW_STOCK_THRESHOLD: z.coerce.number().int().positive().default(5),
    RETURN_WINDOW_DAYS: z.coerce.number().int().positive().default(7),
    RAZORPAY_KEY_ID: z.string().default(''),
    RAZORPAY_KEY_SECRET: z.string().default(''),
    RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
    CLOUDINARY_CLOUD_NAME: z.string().default(''),
    CLOUDINARY_API_KEY: z.string().default(''),
    CLOUDINARY_API_SECRET: z.string().default(''),
    MOCK_PAYMENTS: z
      .union([z.boolean(), z.literal('true'), z.literal('false')])
      .default(false)
      .transform((v) => v === true || v === 'true'),
    ADMIN_NAME: z.string().default('Admin'),
    ADMIN_EMAIL: z.string().email().default('admin@velora.dev'),
    ADMIN_PASSWORD: z.string().min(8).default('ChangeMe123!'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.MOCK_PAYMENTS) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'MOCK_PAYMENTS must be false in production' });
      }
      for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']) {
        if (!env[key]) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${key} is required in production` });
        }
      }
    }
    if (!env.MOCK_PAYMENTS && env.NODE_ENV !== 'test') {
      for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']) {
        if (!env[key]) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${key} is required when MOCK_PAYMENTS is not true` });
        }
      }
    }
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
  // Fail loudly at startup rather than mysteriously later (PRD §6.2).
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const env = parsed.data;
env.isProd = env.NODE_ENV === 'production';
env.isDev = env.NODE_ENV === 'development';

module.exports = env;
