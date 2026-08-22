const { request, app, registerAndLogin, createAdmin, createProduct } = require('./helpers');
const Coupon = require('../src/models/Coupon');
const Product = require('../src/models/Product');

async function makeCoupon(overrides = {}) {
  return Coupon.create({
    code: 'TEST10',
    type: 'percentage',
    value: 10,
    minOrderValue: 0,
    expiresAt: new Date(Date.now() + 86400000),
    usageLimitPerUser: 1,
    ...overrides,
  });
}

describe('Coupons (PRD §5.6, §12.5 coupon routes)', () => {
  test('apply → breakdown reflects discount; remove → back to full price', async () => {
    const { token } = await registerAndLogin({ email: 'coupon@test.dev' });
    const auth = { Authorization: `Bearer ${token}` };
    const product = await createProduct({ slug: 'coupon-product', basePrice: 1000, stock: 5 });
    await makeCoupon();

    await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 1 });
    const applied = await request(app).post('/api/cart/coupon').set(auth).send({ code: 'TEST10' });
    expect(applied.status).toBe(200);
    expect(applied.body.data.pricing.discount).toBe(100);
    expect(applied.body.data.pricing.total).toBe(949 + 162); // (1000-100) + 49 shipping + 18% tax on 900

    const removed = await request(app).delete('/api/cart/coupon').set(auth);
    expect(removed.body.data.pricing.discount).toBe(0);
  });

  test('expired coupon → 409', async () => {
    const { token } = await registerAndLogin({ email: 'expiredcpn@test.dev' });
    const product = await createProduct({ slug: 'exp-product', basePrice: 1000, stock: 5 });
    await makeCoupon({ code: 'OLDCPN', expiresAt: new Date(Date.now() - 86400000) });
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 1 });
    const res = await request(app).post('/api/cart/coupon').set(auth).send({ code: 'OLDCPN' });
    expect(res.status).toBe(409);
  });

  test('min order value and per-user limits enforced at apply time', async () => {
    const { token } = await registerAndLogin({ email: 'mincpn@test.dev' });
    const product = await createProduct({ slug: 'min-product', basePrice: 500, stock: 5 });
    await makeCoupon({ code: 'BIGCPN', minOrderValue: 1000, usageLimitPerUser: 1 });
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 1 });

    const tooSmall = await request(app).post('/api/cart/coupon').set(auth).send({ code: 'BIGCPN' });
    expect(tooSmall.status).toBe(409);
    expect(tooSmall.body.error.message).toMatch(/minimum order/i);

    // Raise subtotal above the minimum, then exhaust the per-user limit.
    await request(app).patch(`/api/cart/items/${product._id}`).set(auth).send({ quantity: 3 });
    const ok = await request(app).post('/api/cart/coupon').set(auth).send({ code: 'BIGCPN' });
    expect(ok.status).toBe(200);

    await Coupon.updateOne({ code: 'BIGCPN' }, { $push: { usedBy: { user: ok.body.data ? (await require('../src/models/User').findOne({ email: 'mincpn@test.dev' }))._id : null, count: 1 } } });
    const exhausted = await request(app).post('/api/cart/coupon').set(auth).send({ code: 'BIGCPN' });
    expect(exhausted.status).toBe(409);
    expect(exhausted.body.error.message).toMatch(/maximum number of times/i);
  });

  test('total usage limit enforced', async () => {
    const { token } = await registerAndLogin({ email: 'totcpn@test.dev' });
    const product = await createProduct({ slug: 'tot-product', basePrice: 2000, stock: 5 });
    await makeCoupon({ code: 'ONCECPN', usageLimit: 1, timesUsed: 1 });
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 1 });
    const res = await request(app).post('/api/cart/coupon').set(auth).send({ code: 'ONCECPN' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/usage limit/i);
  });

  test('coupon usage recorded exactly once per confirmed payment', async () => {
    const { token, user } = await registerAndLogin({ email: 'usage@test.dev' });
    const product = await createProduct({ slug: 'usage-product', basePrice: 2000, stock: 5 });
    const coupon = await makeCoupon({ code: 'USE10' });
    const auth = { Authorization: `Bearer ${token}` };

    await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 1 });
    await request(app).post('/api/cart/coupon').set(auth).send({ code: 'USE10' });
    const order = (await request(app).post('/api/orders').set(auth).send({ addressId: (await require('./helpers').createAddress(user._id))._id })).body.data;
    const pay = (await request(app).post('/api/payments/create-order').set(auth).send({ orderId: order._id })).body.data;
    const mp = (await request(app).post('/api/payments/mock-pay').set(auth).send({ gatewayOrderId: pay.gatewayOrderId, succeed: true })).body.data;
    await request(app).post('/api/payments/verify').set(auth).send({
      orderId: order._id, gatewayOrderId: pay.gatewayOrderId, gatewayPaymentId: mp.gatewayPaymentId, signature: mp.signature,
    });

    const after = await Coupon.findById(coupon._id);
    expect(after.timesUsed).toBe(1);
    expect(after.usedBy).toHaveLength(1);
    expect(after.usedBy[0].count).toBe(1);
    // Order snapshot captured the discount
    const Order = require('../src/models/Order');
    const placed = await Order.findById(order._id);
    expect(placed.coupon.code).toBe('USE10');
    expect(placed.pricing.discount).toBe(200);
  });

  test('admin CRUD lifecycle for coupons', async () => {
    const { token } = await createAdmin();
    const auth = { Authorization: `Bearer ${token}` };

    const created = await request(app).post('/api/admin/coupons').set(auth).send({
      code: 'ADMIN20',
      type: 'fixed',
      value: 250,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(created.status).toBe(201);

    const dup = await request(app).post('/api/admin/coupons').set(auth).send({
      code: 'ADMIN20',
      type: 'fixed',
      value: 10,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(dup.status).toBe(409);

    const updated = await request(app).patch(`/api/admin/coupons/${created.body.data._id}`).set(auth).send({ isActive: false });
    expect(updated.body.data.isActive).toBe(false);

    const list = await request(app).get('/api/admin/coupons').set(auth);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);

    const deleted = await request(app).delete(`/api/admin/coupons/${created.body.data._id}`).set(auth);
    expect(deleted.status).toBe(200);
  });
});

describe('Reviews (PRD §4.5, §12.10)', () => {
  test('create → denormalized rating updates; duplicate → 409; verifiedPurchase computed', async () => {
    const { token } = await registerAndLogin({ email: 'rev@test.dev' });
    const auth = { Authorization: `Bearer ${token}` };
    const product = await createProduct({ slug: 'rev-product', basePrice: 100, stock: 5 });

    const r1 = await request(app).post(`/api/products/${product._id}/reviews`).set(auth).send({ rating: 4, comment: 'Nice' });
    expect(r1.status).toBe(201);
    expect(r1.body.data.verifiedPurchase).toBe(false); // no delivered order

    const dup = await request(app).post(`/api/products/${product._id}/reviews`).set(auth).send({ rating: 5 });
    expect(dup.status).toBe(409);

    const updated = await Product.findById(product._id);
    expect(updated.averageRating).toBe(4);
    expect(updated.numReviews).toBe(1);

    const list = await request(app).get(`/api/products/${product._id}/reviews`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].user.name).toBe('Test User');
  });

  test('edit own review recalculates the average; editing someone else’s → 403', async () => {
    const { token: a } = await registerAndLogin({ email: 'rev-a@test.dev' });
    const { token: b } = await registerAndLogin({ email: 'rev-b@test.dev' });
    const product = await createProduct({ slug: 'rev2-product', basePrice: 100, stock: 5 });

    const review = (await request(app).post(`/api/products/${product._id}/reviews`).set({ Authorization: `Bearer ${a}` }).send({ rating: 2 })).body.data;

    const forbidden = await request(app).patch(`/api/reviews/${review._id}`).set({ Authorization: `Bearer ${b}` }).send({ rating: 5 });
    expect(forbidden.status).toBe(403);

    const ok = await request(app).patch(`/api/reviews/${review._id}`).set({ Authorization: `Bearer ${a}` }).send({ rating: 5 });
    expect(ok.status).toBe(200);

    const updated = await Product.findById(product._id);
    expect(updated.averageRating).toBe(5);
  });

  test('delete own review zeroes denormalized fields; admin can delete any', async () => {
    const { token: a } = await registerAndLogin({ email: 'rev-c@test.dev' });
    const { token: admin } = await createAdmin();
    const product = await createProduct({ slug: 'rev3-product', basePrice: 100, stock: 5 });
    const review = (await request(app).post(`/api/products/${product._id}/reviews`).set({ Authorization: `Bearer ${a}` }).send({ rating: 3 })).body.data;

    const del = await request(app).delete(`/api/reviews/${review._id}`).set({ Authorization: `Bearer ${admin}` });
    expect(del.status).toBe(200);

    const updated = await Product.findById(product._id);
    expect(updated.averageRating).toBe(0);
    expect(updated.numReviews).toBe(0);
  });
});
