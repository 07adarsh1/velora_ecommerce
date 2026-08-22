const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../src/app');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Address = require('../src/models/Address');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
});

const MODELS = ['users', 'products', 'categories', 'carts', 'wishlists', 'addresses', 'orders', 'payments', 'coupons', 'reviews', 'inventoryhistories'];

beforeEach(async () => {
  await Promise.all(
    MODELS.map((name) => mongoose.connection.collection(name).deleteMany({}))
  );
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

async function createVerifiedUser({ email = 'user@test.dev', password = 'Password123', role = 'customer', name = 'Test User' } = {}) {
  const user = new User({ name, email, passwordHash: password, role, isEmailVerified: true });
  await user.save();
  return user;
}

async function registerAndLogin({ email = 'user@test.dev', password = 'Password123', name = 'Test User' } = {}) {
  await request(app).post('/api/auth/register').send({ name, email, password });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return { token: res.body.data.accessToken, user: res.body.data.user };
}

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return { token: res.body.data.accessToken, user: res.body.data.user, res };
}

async function createAdmin() {
  const user = await createVerifiedUser({ email: 'admin@test.dev', role: 'admin', name: 'Admin' });
  const { token } = await login('admin@test.dev', 'Password123');
  return { token, user };
}

async function createCategory(name = 'Test Category') {
  // Upsert keeps repeated fixture calls from tripping the unique name index.
  return Category.findOneAndUpdate(
    { name },
    { $set: { name, slug: name.toLowerCase().replace(/\s+/g, '-') } },
    { upsert: true, new: true }
  );
}

async function createProduct(overrides = {}) {
  const category = overrides.category || (await createCategory())._id;
  const Product = require('../src/models/Product');
  return Product.create({
    name: 'Test Product',
    slug: 'test-product',
    description: 'A test product description that is long enough.',
    basePrice: 1000,
    stock: 10,
    category,
    images: ['https://example.com/img.jpg'],
    ...overrides,
  });
}

async function createAddress(userId) {
  return Address.create({
    user: userId,
    fullName: 'Test User',
    phone: '+91 9876543210',
    line1: '123 Test Street',
    city: 'Testville',
    state: 'Test State',
    postalCode: '560001',
    country: 'India',
    isDefault: true,
  });
}

/** Signs a mock-gateway payment payload exactly like the mock gateway does. */
const crypto = require('crypto');
const MOCK_KEY_SECRET = 'mock-gateway-key-secret-for-dev-only';
const MOCK_WEBHOOK_SECRET = 'mock-webhook-secret';
function mockSignature(gatewayOrderId, gatewayPaymentId) {
  return crypto.createHmac('sha256', MOCK_KEY_SECRET).update(`${gatewayOrderId}|${gatewayPaymentId}`).digest('hex');
}
function webhookSignature(rawBody) {
  return crypto.createHmac('sha256', MOCK_WEBHOOK_SECRET).update(rawBody).digest('hex');
}

module.exports = {
  app,
  request,
  createVerifiedUser,
  registerAndLogin,
  login,
  createAdmin,
  createCategory,
  createProduct,
  createAddress,
  mockSignature,
  webhookSignature,
  MOCK_WEBHOOK_SECRET,
};
