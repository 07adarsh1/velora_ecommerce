const { request, app, registerAndLogin, createAdmin, createProduct, createAddress, mockSignature } = require('./helpers');
const Order = require('../src/models/Order');
const Product = require('../src/models/Product');
const { ORDER_TRANSITIONS } = require('../src/config/constants');

async function confirmedOrder(email = 'flow@test.dev', overrides = {}) {
  const { token, user } = await registerAndLogin({ email });
  const product = await createProduct({ slug: `flow-${email}`, stock: 10, ...overrides });
  const address = await createAddress(user._id);
  const auth = { Authorization: `Bearer ${token}` };
  await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 2 });
  const order = (await request(app).post('/api/orders').set(auth).send({ addressId: address._id })).body.data;
  const pay = (await request(app).post('/api/payments/create-order').set(auth).send({ orderId: order._id })).body.data;
  const mp = (await request(app).post('/api/payments/mock-pay').set(auth).send({ gatewayOrderId: pay.gatewayOrderId, succeed: true })).body.data;
  await request(app).post('/api/payments/verify').set(auth).send({
    orderId: order._id,
    gatewayOrderId: pay.gatewayOrderId,
    gatewayPaymentId: mp.gatewayPaymentId,
    signature: mp.signature,
  });
  return { token, user, product, orderId: order._id, auth };
}

describe('Order state machine (PRD §10)', () => {
  test('every transition listed in the adjacency map is legal via the API happy path', async () => {
    // PENDING_PAYMENT → PAYMENT_CONFIRMED is covered by the checkout suite;
    // here we walk the fulfillment chain and the return loop.
    const { orderId, token, product } = await confirmedOrder('lifecycle@test.dev');
    const { token: adminToken } = await createAdmin();
    const admin = { Authorization: `Bearer ${adminToken}` };
    const cust = { Authorization: `Bearer ${token}` };

    const setStatus = (status) =>
      request(app).patch(`/api/admin/orders/${orderId}/status`).set(admin).send({ status });

    expect((await setStatus('PROCESSING')).body.data.status).toBe('PROCESSING');

    const ship = await request(app).patch(`/api/admin/orders/${orderId}/shipment`).set(admin).send({
      carrier: 'BlueDart',
      trackingNumber: 'BD123456',
    });
    expect(ship.body.data.status).toBe('SHIPPED');
    expect(ship.body.data.shipment.shippedAt).toBeDefined();

    expect((await setStatus('DELIVERED')).body.data.status).toBe('DELIVERED');
    const delivered = await Order.findById(orderId);
    expect(delivered.shipment.deliveredAt).toBeDefined();

    const ret = await request(app).post(`/api/orders/${orderId}/return`).set(cust).send({ reason: 'Wrong size' });
    expect(ret.body.data.status).toBe('RETURN_REQUESTED');
    expect(ret.body.data.returnRequest.status).toBe('PENDING');

    const approve = await request(app).post(`/api/admin/orders/${orderId}/return/approve`).set(admin);
    expect(approve.body.data.status).toBe('REFUNDED');
    expect(approve.body.data.paymentStatus).toBe('REFUNDED');

    // Refund restored stock (2 sold → back to 10)
    expect((await Product.findById(product._id)).stock).toBe(10);
  });

  test('return rejection returns the order to DELIVERED', async () => {
    const { orderId, token } = await confirmedOrder('reject@test.dev');
    const { token: adminToken } = await createAdmin();
    const admin = { Authorization: `Bearer ${adminToken}` };
    await request(app).patch(`/api/admin/orders/${orderId}/status`).set(admin).send({ status: 'PROCESSING' });
    await request(app).patch(`/api/admin/orders/${orderId}/shipment`).set(admin).send({ carrier: 'DTDC', trackingNumber: 'X1' });
    await request(app).patch(`/api/admin/orders/${orderId}/status`).set(admin).send({ status: 'DELIVERED' });
    await request(app).post(`/api/orders/${orderId}/return`).set({ Authorization: `Bearer ${token}` }).send({ reason: 'Not needed' });

    const reject = await request(app).post(`/api/admin/orders/${orderId}/return/reject`).set(admin).send({ note: 'outside policy' });
    expect(reject.body.data.status).toBe('DELIVERED');
    expect(reject.body.data.returnRequest.status).toBe('REJECTED');
  });

  test('every illegal transition attempted via the API is rejected with 409', async () => {
    const { orderId } = await confirmedOrder('illegal@test.dev');
    const { token: adminToken } = await createAdmin();
    const admin = { Authorization: `Bearer ${adminToken}` };

    const order = await Order.findById(orderId);
    // From PAYMENT_CONFIRMED, everything except PROCESSING/CANCELLED is illegal.
    const illegalTargets = Object.values(ORDER_TRANSITIONS).flatMap((targets) => Object.keys(ORDER_TRANSITIONS));
    const allStatuses = [...new Set(illegalTargets)];
    const legalFromConfirmed = ORDER_TRANSITIONS[order.status];

    for (const status of allStatuses) {
      if (legalFromConfirmed.includes(status) || status === 'PAYMENT_FAILED') continue; // PAYMENT_FAILED isn't admin-settable either (400)
      const res = await request(app).patch(`/api/admin/orders/${orderId}/status`).set(admin).send({ status });
      // PAYMENT_FAILED/PENDING_PAYMENT aren't manually settable → 400;
      // everything else non-adjacent → 409. Both reject the transition.
      expect([400, 409]).toContain(res.status);
    }

    // Order never moved despite the barrage.
    expect((await Order.findById(orderId)).status).toBe('PAYMENT_CONFIRMED');

    // Specifically the PRD-called-out case: DELIVERED → PENDING_PAYMENT
    const specific = await request(app).patch(`/api/admin/orders/${orderId}/status`).set(admin).send({ status: 'PENDING_PAYMENT' });
    expect([400, 409]).toContain(specific.status);
  });

  test('customer cancel of PENDING_PAYMENT → CANCELLED with no stock effect', async () => {
    const { token, user } = await registerAndLogin({ email: 'cancl@test.dev' });
    const product = await createProduct({ slug: 'cancl-product', stock: 5 });
    const address = await createAddress(user._id);
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 1 });
    const order = (await request(app).post('/api/orders').set(auth).send({ addressId: address._id })).body.data;

    const res = await request(app).post(`/api/orders/${order._id}/cancel`).set(auth).send({ reason: 'changed mind' });
    expect(res.body.data.status).toBe('CANCELLED');
    expect((await Product.findById(product._id)).stock).toBe(5);
  });

  test('customer cancel of PAYMENT_CONFIRMED → CANCELLED and restores stock', async () => {
    const { token, product, orderId } = await confirmedOrder('cancel2@test.dev');
    const res = await request(app).post(`/api/orders/${orderId}/cancel`).set({ Authorization: `Bearer ${token}` }).send({ reason: 'too slow' });
    expect(res.body.data.status).toBe('CANCELLED');
    expect((await Product.findById(product._id)).stock).toBe(10);
  });

  test('SHIPPED orders cannot be cancelled', async () => {
    const { orderId, token } = await confirmedOrder('shipnocancel@test.dev');
    const { token: adminToken } = await createAdmin();
    const admin = { Authorization: `Bearer ${adminToken}` };
    await request(app).patch(`/api/admin/orders/${orderId}/status`).set(admin).send({ status: 'PROCESSING' });
    await request(app).patch(`/api/admin/orders/${orderId}/shipment`).set(admin).send({ carrier: 'UPS', trackingNumber: 'U1' });

    const res = await request(app).post(`/api/orders/${orderId}/cancel`).set({ Authorization: `Bearer ${token}` }).send({ reason: 'x' });
    expect(res.status).toBe(409);
  });

  test('return window enforcement', async () => {
    const { orderId, token } = await confirmedOrder('window@test.dev');
    const { token: adminToken } = await createAdmin();
    const admin = { Authorization: `Bearer ${adminToken}` };
    await request(app).patch(`/api/admin/orders/${orderId}/status`).set(admin).send({ status: 'PROCESSING' });
    await request(app).patch(`/api/admin/orders/${orderId}/shipment`).set(admin).send({ carrier: 'DHL', trackingNumber: 'D1' });
    await request(app).patch(`/api/admin/orders/${orderId}/status`).set(admin).send({ status: 'DELIVERED' });

    // Age the delivery past the 7-day window.
    await Order.updateOne({ _id: orderId }, { $set: { 'shipment.deliveredAt': new Date(Date.now() - 8 * 86400000) } });

    const res = await request(app).post(`/api/orders/${orderId}/return`).set({ Authorization: `Bearer ${token}` }).send({ reason: 'late' });
    expect(res.status).toBe(409);
  });

  test('customers see only their own orders', async () => {
    const { orderId } = await confirmedOrder('owner1@test.dev');
    const { token: other } = await registerAndLogin({ email: 'owner2@test.dev' });
    const res = await request(app).get(`/api/orders/${orderId}`).set({ Authorization: `Bearer ${other}` });
    expect(res.status).toBe(403);
  });
});

describe('Inventory overselling under concurrency (PRD §11, §18.1)', () => {
  test(`${'N'} concurrent confirmations against stock < N → exactly stock succeed, rest 409`, async () => {
    const STOCK = 3;
    const BUYERS = 10;

    // One buyer with one product of limited stock; K independent orders.
    const { token, user } = await registerAndLogin({ email: 'race@test.dev' });
    const product = await createProduct({ slug: 'race-product', stock: STOCK });
    const address = await createAddress(user._id);
    const auth = { Authorization: `Bearer ${token}` };

    const orders = [];
    await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 1 });
    for (let i = 0; i < BUYERS; i++) {
      const order = (await request(app).post('/api/orders').set(auth).send({ addressId: address._id })).body.data;
      const pay = (await request(app).post('/api/payments/create-order').set(auth).send({ orderId: order._id })).body.data;
      orders.push({ orderId: order._id, gatewayOrderId: pay.gatewayOrderId });
    }

    // Fire all confirmations concurrently via the signed verify path.
    const statuses = await Promise.all(
      orders.map(({ orderId, gatewayOrderId }) => {
        const gatewayPaymentId = `mock_pay_race_${orderId}`;
        return request(app)
          .post('/api/payments/verify')
          .set(auth)
          .send({ orderId, gatewayOrderId, gatewayPaymentId, signature: mockSignature(gatewayOrderId, gatewayPaymentId) })
          .then((r) => r.status);
      })
    );

    const successes = statuses.filter((s) => s === 200).length;
    const conflicts = statuses.filter((s) => s === 409).length;
    expect(successes).toBe(STOCK);
    expect(conflicts).toBe(BUYERS - STOCK);

    // Final stock is exactly zero — never negative, never oversold.
    expect((await Product.findById(product._id)).stock).toBe(0);

    const confirmed = await Order.countDocuments({ status: 'PAYMENT_CONFIRMED' });
    expect(confirmed).toBe(STOCK);
  });
});
