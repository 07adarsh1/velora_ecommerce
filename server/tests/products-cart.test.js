const { request, app, registerAndLogin, createAdmin, createProduct, createCategory } = require('./helpers');

describe('Product APIs (PRD §12.3)', () => {
  test('list with combined filters + sort + pagination in one query', async () => {
    const cat1 = await createCategory('Audio');
    const cat2 = await createCategory('Books');
    const Product = require('../src/models/Product');
    await Product.create([
      { name: 'Cheap Earbuds', slug: 'cheap-earbuds', description: 'd1', basePrice: 100, stock: 5, category: cat1._id, averageRating: 3 },
      { name: 'Pricey Headphones', slug: 'pricey-headphones', description: 'd2', basePrice: 900, stock: 5, category: cat1._id, averageRating: 5 },
      { name: 'Cheap Book', slug: 'cheap-book', description: 'd3', basePrice: 150, stock: 5, category: cat2._id, averageRating: 4 },
      { name: 'Hidden Item', slug: 'hidden-item', description: 'd4', basePrice: 100, stock: 5, category: cat1._id, isPublished: false },
    ]);

    const res = await request(app).get('/api/products?minPrice=50&maxPrice=500&sort=price&page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.slug)).toEqual(['cheap-earbuds', 'cheap-book']);
    expect(res.body.pagination.total).toBe(2);

    const catFilter = await request(app).get(`/api/products?category=audio&sort=-price`);
    expect(catFilter.body.data.map((p) => p.slug)).toEqual(['pricey-headphones', 'cheap-earbuds']);

    const ratingFilter = await request(app).get('/api/products?rating=4');
    expect(ratingFilter.body.data.map((p) => p.slug).sort()).toEqual(['cheap-book', 'pricey-headphones']);

    const inStock = await request(app).get('/api/products?inStock=true');
    expect(inStock.body.data).toHaveLength(3);
  });

  test('text search hits the name/description index', async () => {
    await createProduct({ name: 'Wireless Mouse', slug: 'wireless-mouse', description: 'ergonomic pointer' });
    const res = await request(app).get('/api/products?search=wireless');
    expect(res.body.data.some((p) => p.slug === 'wireless-mouse')).toBe(true);
    const desc = await request(app).get('/api/products?search=ergonomic');
    expect(desc.body.data.some((p) => p.slug === 'wireless-mouse')).toBe(true);
  });

  test('detail by slug; unpublished → 404 for guests, visible to admin', async () => {
    await createProduct({ name: 'Visible', slug: 'visible', description: 'd' });
    await createProduct({ name: 'Stealth', slug: 'stealth', description: 'd', isPublished: false });

    expect((await request(app).get('/api/products/visible')).status).toBe(200);
    expect((await request(app).get('/api/products/stealth')).status).toBe(404);

    const { token } = await createAdmin();
    const adminView = await request(app).get('/api/products/stealth').set('Authorization', `Bearer ${token}`);
    expect(adminView.status).toBe(200);
  });

  test('related products: same category, excludes self', async () => {
    const cat = await createCategory('Related Cat');
    const a = await createProduct({ name: 'A', slug: 'rel-a', description: 'd', category: cat._id });
    await createProduct({ name: 'B', slug: 'rel-b', description: 'd', category: cat._id });
    await createProduct({ name: 'C', slug: 'rel-c', description: 'd' }); // other category

    const res = await request(app).get(`/api/products/${a._id}/related`);
    expect(res.body.data.map((p) => p.slug)).toEqual(['rel-b']);
  });

  test('admin CRUD: create → update → soft-delete; customer gets 403', async () => {
    const { token: admin } = await createAdmin();
    const { token: customer } = await registerAndLogin({ email: 'nope@test.dev' });
    const cat = await createCategory('CRUD Cat');

    const forbidden = await request(app).post('/api/products').set('Authorization', `Bearer ${customer}`).send({
      name: 'Hack', description: 'attempted injection', basePrice: 1, category: cat._id,
    });
    expect(forbidden.status).toBe(403);

    const created = await request(app).post('/api/products').set('Authorization', `Bearer ${admin}`).send({
      name: 'New Thing',
      description: 'Brand new thing to sell',
      basePrice: 1234,
      stock: 7,
      category: cat._id,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('new-thing');

    const updated = await request(app).patch(`/api/products/${created.body.data._id}`).set('Authorization', `Bearer ${admin}`).send({
      basePrice: 999,
      discountPercent: 10,
    });
    expect(updated.body.data.basePrice).toBe(999);

    const deleted = await request(app).delete(`/api/products/${created.body.data._id}`).set('Authorization', `Bearer ${admin}`);
    expect(deleted.body.data.isPublished).toBe(false);
    expect((await request(app).get('/api/products/new-thing')).status).toBe(404);
  });

  test('variant products expose per-variant stock and price overrides', async () => {
    const Product = require('../src/models/Product');
    await Product.create({
      name: 'Shoes', slug: 'shoes', description: 'd', basePrice: 2000, stock: 0, category: (await createCategory('Shoes Cat'))._id,
      variants: [
        { sku: 'SHOE-BLK-40', attributes: { size: '40', color: 'Black' }, stock: 3 },
        { sku: 'SHOE-WHT-42', attributes: { size: '42', color: 'White' }, price: 2200, stock: 0 },
      ],
    });
    const res = await request(app).get('/api/products/shoes');
    expect(res.body.data.variants).toHaveLength(2);
    expect(res.body.data.variants[1].price).toBe(2200);
  });
});

describe('Cart (PRD §12.5)', () => {
  test('add/update/remove with server-side stock validation', async () => {
    const { token } = await registerAndLogin({ email: 'cart@test.dev' });
    const auth = { Authorization: `Bearer ${token}` };
    const product = await createProduct({ slug: 'cart-product', basePrice: 100, stock: 2 });

    const over = await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 5 });
    expect(over.status).toBe(409);

    const add = await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 1 });
    expect(add.status).toBe(201);
    expect(add.body.data.pricing.subtotal).toBe(100);

    const up = await request(app).patch(`/api/cart/items/${product._id}`).set(auth).send({ quantity: 2 });
    expect(up.body.data.cart.items[0].quantity).toBe(2);

    const tooMany = await request(app).patch(`/api/cart/items/${product._id}`).set(auth).send({ quantity: 3 });
    expect(tooMany.status).toBe(409);

    const del = await request(app).delete(`/api/cart/items/${product._id}`).set(auth);
    expect(del.body.data.cart.items).toHaveLength(0);
  });

  test('discounted products price from effective price', async () => {
    const { token } = await registerAndLogin({ email: 'disc@test.dev' });
    const product = await createProduct({ slug: 'disc-product', basePrice: 1000, discountPercent: 20 });
    const res = await request(app).post('/api/cart/items').set({ Authorization: `Bearer ${token}` }).send({ productId: product._id, quantity: 1 });
    expect(res.body.data.pricing.subtotal).toBe(800);
  });

  test('guest cart merge combines quantities capped at stock without duplicates', async () => {
    const { token } = await registerAndLogin({ email: 'merge@test.dev' });
    const auth = { Authorization: `Bearer ${token}` };
    const product = await createProduct({ slug: 'merge-product', basePrice: 100, stock: 3 });

    await request(app).post('/api/cart/items').set(auth).send({ productId: product._id, quantity: 1 });
    const merged = await request(app).post('/api/cart/merge').set(auth).send({
      items: [
        { productId: product._id, variantSku: null, quantity: 1 },
        { productId: product._id, variantSku: null, quantity: 5 }, // together would exceed stock 3
      ],
    });
    expect(merged.status).toBe(200);
    expect(merged.body.data.cart.items).toHaveLength(1);
    expect(merged.body.data.cart.items[0].quantity).toBe(3);
  });

  test('wishlist add/remove/move-to-cart', async () => {
    const { token } = await registerAndLogin({ email: 'wish@test.dev' });
    const auth = { Authorization: `Bearer ${token}` };
    const product = await createProduct({ slug: 'wish-product', basePrice: 100, stock: 5 });

    await request(app).post('/api/wishlist/items').set(auth).send({ productId: product._id });
    let wl = await request(app).get('/api/wishlist').set(auth);
    expect(wl.body.data.products).toHaveLength(1);

    const move = await request(app).post(`/api/wishlist/items/${product._id}/move-to-cart`).set(auth).send({ quantity: 2 });
    expect(move.status).toBe(200);
    expect(move.body.data.wishlist.products).toHaveLength(0);
    expect(move.body.data.cart.cart.items[0].quantity).toBe(2);
  });
});

describe('Admin authorization sweep (PRD §18.1: every admin route rejects a customer token)', () => {
  const adminRoutes = [
    ['get', '/api/admin/orders'],
    ['get', '/api/admin/inventory'],
    ['get', '/api/admin/analytics/summary'],
    ['get', '/api/admin/coupons'],
    ['get', '/api/users'],
  ];

  test.each(adminRoutes)('%s %s → 403 for customer token', async (method, url) => {
    const { token } = await registerAndLogin({ email: `sweep${Math.random().toString(36).slice(2, 8)}@test.dev` });
    const res = await request(app)[method](url).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
