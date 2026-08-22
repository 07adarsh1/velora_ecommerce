const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const productRoutes = require('./routes/product.routes');
const categoryRoutes = require('./routes/category.routes');
const cartRoutes = require('./routes/cart.routes');
const wishlistRoutes = require('./routes/wishlist.routes');
const addressRoutes = require('./routes/address.routes');
const orderRoutes = require('./routes/order.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminRoutes = require('./routes/admin.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const reviewRoutes = require('./routes/review.routes');
const healthRoutes = require('./routes/health.routes');

const app = express();

// Behind Render/Railway proxies the client IP lives in X-Forwarded-For.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    // Explicit allow-list from env — never '*' with credentials (PRD §6.2/§17).
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(morgan(env.isProd ? 'combined' : 'dev'));

// The webhook route needs the raw body for HMAC verification, so it is mounted
// with its own raw parser BEFORE the global JSON middleware (PRD §9.3).
app.use(
  '/api/payments/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
  (req, _res, next) => {
    req.rawBody = req.body;
    // Mark as already-parsed so the global json parser skips this route.
    req._body = true;
    req.body = {};
    next();
  }
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(generalLimiter);

app.get('/', (_req, res) => res.json({ success: true, data: { name: 'ShelfLife API', version: '1.0.0' } }));
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/analytics', analyticsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
