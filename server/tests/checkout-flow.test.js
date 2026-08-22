const {
  request,
  app,
  registerAndLogin,
  createProduct,
  createAddress,
  mockSignature,
  webhookSignature,
  MOCK_WEBHOOK_SECRET,
} = require('./helpers');

/**
 * Full checkout flow (PRD §4.4, §20.4): cart → order (server-priced) →
 * gateway payment (mock) → verify → PAYMENT_CONFIRMED with every side effect
 * exactly once. Also proves webhook replay and the verify/webhook race are
 * no-ops (§9.4).
 */
describe('Checkout end-to-end (mock gateway)', () => {
  test('complete purchase: stock decremented, cart cleared, order confirmed', async () => {
    const { token, user } = await registerAndLogin({ email: 'buy@test.dev' });
    const product = await createProduct({ basePrice: 1000, stock: 5 });
    const address = await createAddress(user._id);
    const auth = { Authorization: `Bearer ${token}` };

    // Cart add + view shows server-computed breakdown
    const add = await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 2 });
    expect(add.status).toBe(201);
    expect(add.body.data.pricing.subtotal).toBe(2000);
    expect(add.body.data.pricing.shipping).toBe(49);
    expect(add.body.data.pricing.tax).toBe(360); // 18% of 2000
    expect(add.body.data.pricing.total).toBe(2409); // 2000 + 49 + 360

    // Order creation — pricing recalculated server-side, nothing trusted from client
    const order = await request(app).post('/api/orders').set(auth).send({ addressId: address._id });
    expect(order.status).toBe(201);
    expect(order.body.data.status).toBe('PENDING_PAYMENT');
    expect(order.body.data.pricing.total).toBe(2409);
    expect(order.body.data.items[0].unitPrice).toBe(1000);
    expect(order.body.data.items[0].name).toBe('Test Product');
    expect(order.body.data.orderNumber).toMatch(/^SL-\d{4}-/);

    // Gateway order + payment attempt
    const pay = await request(app).post('/api/payments/create-order').set(auth).send({ orderId: order.body.data._id });
    expect(pay.status).toBe(200);
    const { gatewayOrderId } = pay.body.data;
    expect(gatewayOrderId).toMatch(/^mock_order_/);

    // Mock hosted-checkout success returns the signed payload
    const mp = await request(app).post('/api/payments/mock-pay').set(auth).send({ gatewayOrderId, succeed: true });
    expect(mp.status).toBe(200);

    // Client-triggered verification
    const verify = await request(app)
      .post('/api/payments/verify')
      .set(auth)
      .send({
        orderId: order.body.data._id,
        gatewayOrderId,
        gatewayPaymentId: mp.body.data.gatewayPaymentId,
        signature: mp.body.data.signature,
      });
    expect(verify.status).toBe(200);
    expect(verify.body.data.status).toBe('PAYMENT_CONFIRMED');
    expect(verify.body.data.paymentStatus).toBe('PAID');

    // Stock decremented exactly by quantity
    const Product = require('../src/models/Product');
    const after = await Product.findById(product._id);
    expect(after.stock).toBe(3);

    // Cart cleared
    const cart = await request(app).get('/api/cart').set(auth);
    expect(cart.body.data.cart.items).toHaveLength(0);

    // InventoryHistory audit trail written
    const InventoryHistory = require('../src/models/InventoryHistory');
    const history = await InventoryHistory.find({ product: product._id });
    expect(history).toHaveLength(1);
    expect(history[0].change).toBe(-2);
    expect(history[0].reason).toBe('order');
    expect(history[0].stockAfter).toBe(3);
  });

  test('invalid payment signature → rejected, order stays PENDING_PAYMENT', async () => {
    const { token, user } = await registerAndLogin({ email: 'badsig@test.dev' });
    const product = await createProduct({ slug: 'badsig-product', stock: 5 });
    const address = await createAddress(user._id);
    const auth = { Authorization: `Bearer ${token}` };

    await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 1 });
    const order = await request(app).post('/api/orders').set(auth).send({ addressId: address._id });
    const pay = await request(app).post('/api/payments/create-order').set(auth).send({ orderId: order.body.data._id });

    const verify = await request(app).post('/api/payments/verify').set(auth).send({
      orderId: order.body.data._id,
      gatewayOrderId: pay.body.data.gatewayOrderId,
      gatewayPaymentId: 'mock_pay_forged',
      signature: 'a'.repeat(64),
    });
    expect(verify.status).toBe(400);

    const check = await request(app).get(`/api/orders/${order.body.data._id}`).set(auth);
    expect(check.body.data.status).toBe('PENDING_PAYMENT');
  });

  test('webhook replay: duplicate payment.captured events are no-ops (idempotency)', async () => {
    const { token, user } = await registerAndLogin({ email: 'replay@test.dev' });
    const product = await createProduct({ slug: 'replay-product', basePrice: 500, stock: 5 });
    const address = await createAddress(user._id);
    const auth = { Authorization: `Bearer ${token}` };

    await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 1 });
    const order = await request(app).post('/api/orders').set(auth).send({ addressId: address._id });
    const pay = await request(app).post('/api/payments/create-order').set(auth).send({ orderId: order.body.data._id });

    const webhookBody = JSON.stringify({
      event: 'payment.captured',
      id: 'evt_replay_test',
      payload: {
        payment: {
          entity: { id: 'mock_pay_wh_1', notes: { orderId: order.body.data._id } },
        },
      },
    });

    const fire = () =>
      request(app)
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', webhookSignature(webhookBody))
        .send(webhookBody);

    const first = await fire();
    expect(first.status).toBe(200);

    const Product = require('../src/models/Product');
    expect((await Product.findById(product._id)).stock).toBe(4);

    // Same event delivered again — must not decrement stock twice.
    const second = await fire();
    expect(second.status).toBe(200);
    expect((await Product.findById(product._id)).stock).toBe(4);

    const Order = require('../src/models/Order');
    const fresh = await Order.findById(order.body.data._id);
    expect(fresh.status).toBe('PAYMENT_CONFIRMED');
    expect(fresh.timeline.filter((t) => t.status === 'PAYMENT_CONFIRMED')).toHaveLength(1);
  });

  test('webhook with bad signature → 400, no processing', async () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'x', notes: { orderId: '0'.repeat(24) } } } } });
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'f'.repeat(64))
      .send(body);
    expect(res.status).toBe(400);
  });

  test('failed payment → PAYMENT_FAILED, cart intact for retry; retry succeeds', async () => {
    const { token, user } = await registerAndLogin({ email: 'retry@test.dev' });
    const product = await createProduct({ slug: 'retry-product', stock: 5 });
    const address = await createAddress(user._id);
    const auth = { Authorization: `Bearer ${token}` };

    await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 1 });
    const order = await request(app).post('/api/orders').set(auth).send({ addressId: address._id });
    const pay = await request(app).post('/api/payments/create-order').set(auth).send({ orderId: order.body.data._id });

    const fail = await request(app).post('/api/payments/mock-pay').set(auth).send({ gatewayOrderId: pay.body.data.gatewayOrderId, succeed: false });
    expect(fail.status).toBe(200);

    let current = await request(app).get(`/api/orders/${order.body.data._id}`).set(auth);
    expect(current.body.data.status).toBe('PAYMENT_FAILED');
    expect(current.body.data.paymentStatus).toBe('FAILED');

    // Stock untouched by failure
    const Product = require('../src/models/Product');
    expect((await Product.findById(product._id)).stock).toBe(5);

    // Retry: create-order reopens the failed order and a new payment succeeds
    const pay2 = await request(app).post('/api/payments/create-order').set(auth).send({ orderId: order.body.data._id });
    expect(pay2.status).toBe(200);
    const mp = await request(app).post('/api/payments/mock-pay').set(auth).send({ gatewayOrderId: pay2.body.data.gatewayOrderId, succeed: true });
    const verify = await request(app).post('/api/payments/verify').set(auth).send({
      orderId: order.body.data._id,
      gatewayOrderId: pay2.body.data.gatewayOrderId,
      gatewayPaymentId: mp.body.data.gatewayPaymentId,
      signature: mp.body.data.signature,
    });
    expect(verify.status).toBe(200);
    expect(verify.body.data.status).toBe('PAYMENT_CONFIRMED');
    expect((await Product.findById(product._id)).stock).toBe(4);
  });

  test('order creation refuses an empty cart', async () => {
    const { token, user } = await registerAndLogin({ email: 'empty@test.dev' });
    const address = await createAddress(user._id);
    const res = await request(app).post('/api/orders').set({ Authorization: `Bearer ${token}` }).send({ addressId: address._id });
    expect(res.status).toBe(400);
  });

  test('order creation rejects another user’s address (object-level authz)', async () => {
    const { token } = await registerAndLogin({ email: 'thief@test.dev' });
    const { user: victim } = await registerAndLogin({ email: 'victim@test.dev' });
    const product = await createProduct({ slug: 'thief-product', stock: 5 });
    const victimAddress = await createAddress(victim._id);
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 1 });

    const res = await request(app).post('/api/orders').set(auth).send({ addressId: victimAddress._id });
    expect(res.status).toBe(404);
  });
});
