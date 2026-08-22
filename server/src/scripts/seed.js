/**
 * Seed script (PRD §21 Phase 3): admin user, categories, sample products
 * (with variants, discounts, low/out-of-stock cases), coupons, demo customers
 * and reviews with denormalized ratings recalculated.
 *
 *   npm run seed            — upserts into the DB at MONGODB_URI
 *   npm run seed -- --fresh — drops existing data first
 */
const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Review = require('../models/Review');
const { slugify } = require('../utils/helpers');

const CATEGORIES = [
  'Electronics', 'Audio', 'Wearables', 'Home & Kitchen', 'Fitness', 'Books', 'Gaming', 'Accessories',
];

// [name, brand, basePrice, discountPercent, categoryIndex]
const PRODUCTS = [
  ['Aurora Wireless Earbuds', 'Nexon', 2999, 15, 1],
  ['Bass Cannon Over-Ear Headphones', 'Nexon', 4499, 0, 1],
  ['Bluetooth Party Speaker 40W', 'Sonique', 3999, 10, 1],
  ['Studio Monitor Speakers (Pair)', 'Sonique', 12999, 0, 1],
  ['USB-C Fast Charger 65W', 'Voltix', 1899, 5, 0],
  ['Titanium Power Bank 20000mAh', 'Voltix', 2799, 0, 0],
  ['Smart LED Bulb (4-pack)', 'Lumos', 1499, 20, 0],
  ['Mechanical Keyboard TKL', 'Keyforge', 5499, 0, 6],
  ['Wireless Gaming Mouse', 'Keyforge', 2499, 12, 6],
  ['27-inch 144Hz Gaming Monitor', 'Visionary', 18999, 8, 6],
  ['Ergonomic Gaming Chair', 'Thronos', 14999, 0, 6],
  ['Smart Fitness Watch S2', 'Pulse', 7999, 10, 2],
  ['Fitness Band Lite', 'Pulse', 1999, 0, 2],
  ['Wireless Charging Stand', 'Voltix', 1299, 0, 7],
  ['Laptop Sleeve 15.6-inch', 'Carryon', 999, 25, 7],
  ['Canvas Backpack 25L', 'Carryon', 2299, 0, 7],
  ['Leather Wallet RFID', 'Carryon', 1199, 15, 7],
  ['Noise-Cancelling Earbuds Pro', 'Nexon', 6999, 0, 1],
  ['Stainless Steel Water Bottle 1L', 'Hydra', 799, 0, 4],
  ['Adjustable Dumbbell 20kg', 'Ironforge', 4999, 10, 4],
  ['Yoga Mat Premium 6mm', 'Zenflow', 1299, 0, 4],
  ['Resistance Band Set', 'Zenflow', 699, 30, 4],
  ['Smart Body Composition Scale', 'Pulse', 2199, 0, 4],
  ['Espresso Machine Compact', 'Brewlab', 15999, 5, 3],
  ['Electric Kettle 1.7L', 'Brewlab', 1799, 0, 3],
  ['Air Fryer 4L', 'Brewlab', 6499, 15, 3],
  ['Ceramic Dinner Set (16 pcs)', 'Hearth', 3499, 0, 3],
  ['Memory Foam Pillow (2-pack)', 'Restwell', 1899, 20, 3],
  ['Cotton Bedsheet Queen', 'Restwell', 1499, 0, 3],
  ['Aromatherapy Diffuser', 'Hearth', 1299, 0, 3],
  ['Designing Data-Intensive Applications', 'Printopia', 3200, 0, 5],
  ['Clean Architecture', 'Printopia', 2450, 10, 5],
  ['Atomic Habits', 'Printopia', 399, 25, 5],
  ['Sapiens: A Brief History of Humankind', 'Printopia', 499, 0, 5],
  ['Deep Work', 'Printopia', 349, 0, 5],
  ['Webcam 1080p with Mic', 'Visionary', 2299, 0, 0],
  ['Portable Document Scanner', 'Visionary', 8999, 10, 0],
  ['External SSD 1TB', 'Databank', 7499, 5, 0],
  ['USB-C Hub 8-in-1', 'Databank', 2799, 0, 0],
  ['Wireless Presentation Clicker', 'Keyforge', 999, 0, 0],
  ['Running Shoes Velocity', 'Stridex', 3999, 20, 4],
  ['Trail Backpack 30L', 'Carryon', 3299, 0, 4],
];

const IMAGE = (slug, n) => `https://picsum.photos/seed/${slug}-${n}/640/640`;

// Deterministic pseudo-random so repeated seeds produce stable data.
let seedState = 42;
function rand() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

async function upsertAdmin() {
  const admin = await User.findOneAndUpdate(
    { email: env.ADMIN_EMAIL },
    {
      $set: {
        name: env.ADMIN_NAME,
        // Pre-save hook only hashes on new documents, so hash explicitly here.
        passwordHash: await require('bcryptjs').hash(env.ADMIN_PASSWORD, 12),
        role: 'admin',
        isActive: true,
        isEmailVerified: true,
      },
      $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1 },
    },
    { upsert: true, new: true }
  );
  // Hash again on create path: findOneAndUpdate bypasses the pre-save hook.
  console.log(`Admin ready: ${admin.email}`);
  return admin;
}

async function seed(options = {}) {
  const fresh = options.fresh !== undefined ? options.fresh : process.argv.includes('--fresh');
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  if (fresh) {
    await Promise.all(
      ['users', 'categories', 'products', 'coupons', 'reviews', 'carts', 'wishlists', 'orders', 'payments', 'inventoryhistories'].map((c) =>
        mongoose.connection.collection(c).deleteMany({})
      )
    );
    console.log('Cleared existing data (--fresh)');
  }

  await upsertAdmin();

  const demoCustomers = [];
  for (let i = 1; i <= 5; i++) {
    const email = `customer${i}@shelflife.dev`;
    const existing = await User.findOne({ email });
    if (existing) {
      demoCustomers.push(existing);
      continue;
    }
    const u = new User({ name: `Customer ${i}`, email, passwordHash: 'Password123' });
    await u.save();
    demoCustomers.push(u);
  }

  const categoryIds = {};
  for (const name of CATEGORIES) {
    const cat = await Category.findOneAndUpdate(
      { slug: slugify(name) },
      { $set: { name } },
      { upsert: true, new: true }
    );
    categoryIds[name] = cat._id;
  }
  console.log(`Categories: ${Object.keys(categoryIds).length}`);

  const REVIEW_COMMENTS = [
    'Exceeded expectations — great build quality.',
    'Good value for the price.',
    'Works exactly as advertised.',
    'Decent, but packaging could be better.',
    'Bought a second one for my family.',
    'Solid daily driver, no complaints.',
    '',
    '',
  ];

  for (const [name, brand, basePrice, discountPercent, catIdx] of PRODUCTS) {
    const slug = slugify(name);
    const category = categoryIds[CATEGORIES[catIdx]];

    // A third of products get size/color variants with their own SKU and stock.
    const withVariants = rand() < 0.33;
    let variants = [];
    if (withVariants) {
      const colors = ['Black', 'White', 'Blue'];
      variants = colors.map((color) => ({
        sku: `${slug.toUpperCase().replace(/-/g, '').slice(0, 10)}-${color.toUpperCase().slice(0, 3)}`,
        attributes: { color },
        price: rand() < 0.5 ? basePrice + randInt(-300, 500) : undefined,
        stock: randInt(0, 40),
      }));
    }

    // Sprinkle low-stock and out-of-stock cases for the admin dashboard.
    const topStock = rand() < 0.1 ? 0 : rand() < 0.2 ? randInt(1, 4) : randInt(10, 120);

    const product = await Product.findOneAndUpdate(
      { slug },
      {
        $set: {
          name,
          brand,
          basePrice,
          discountPercent,
          category,
          description: `${name} by ${brand}. ${pick([
            'A reliable everyday pick with a clean, minimal design.',
            'Engineered for performance and built to last.',
            'A favourite among our customers for its quality and finish.',
            'Compact, practical, and thoughtfully designed.',
          ])} Free delivery on eligible orders.`,
          images: [IMAGE(slug, 1), IMAGE(slug, 2), IMAGE(slug, 3)],
          variants,
          stock: withVariants ? 0 : topStock,
          averageRating: 0,
          numReviews: 0,
          isPublished: true,
        },
      },
      { upsert: true, new: true }
    );

    // Reviews from demo customers; ratings recomputed into denormalized fields.
    if (fresh) {
      const reviewers = demoCustomers.filter(() => rand() < 0.6);
      for (const user of reviewers) {
        await Review.findOneAndUpdate(
          { product: product._id, user: user._id },
          { $set: { rating: randInt(3, 5), comment: pick(REVIEW_COMMENTS), verifiedPurchase: rand() < 0.7 } },
          { upsert: true, new: true }
        );
      }
    }
  }
  console.log(`Products: ${await Product.countDocuments()}`);

  // Recompute denormalized rating aggregates (same math reviewService uses).
  await mongoose.connection.collection('products').aggregate([
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'product',
        as: 'revs',
      },
    },
    {
      $addFields: {
        averageRating: { $ifNull: [{ $avg: '$revs.rating' }, 0] },
        numReviews: { $size: '$revs' },
      },
    },
    { $merge: { into: 'products' } },
  ]).toArray();

  const coupons = [
    { code: 'WELCOME10', type: 'percentage', value: 10, minOrderValue: 999, expiresAt: new Date('2027-12-31'), usageLimit: null, usageLimitPerUser: 1 },
    { code: 'FLAT200', type: 'fixed', value: 200, minOrderValue: 1500, expiresAt: new Date('2027-06-30'), usageLimit: 100, usageLimitPerUser: 2 },
  ];
  for (const c of coupons) {
    await Coupon.findOneAndUpdate({ code: c.code }, { $set: c }, { upsert: true });
  }
  console.log(`Coupons: ${coupons.map((c) => c.code).join(', ')}`);
  console.log(`Reviews: ${await Review.countDocuments()}`);
  console.log('Seed complete. Admin login:', env.ADMIN_EMAIL, '/ password from ADMIN_PASSWORD in .env');
}

if (require.main === module) {
  seed()
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seed;
