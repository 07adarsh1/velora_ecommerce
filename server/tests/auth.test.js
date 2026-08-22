const { request, app, registerAndLogin, login, createVerifiedUser, createAdmin } = require('./helpers');

describe('Authentication (PRD §12.1)', () => {
  test('register → 201 with user + accessToken, no password material in response', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@test.dev',
      password: 'Password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe('alice@test.dev');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.role).toBe('customer');
  });

  test('register with duplicate email → 409', async () => {
    await registerAndLogin({ email: 'dup@test.dev' });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Dup',
      email: 'dup@test.dev',
      password: 'Password123',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('register with weak password → 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Weak',
      email: 'weak@test.dev',
      password: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('login success → 200 + refresh cookie set', async () => {
    await createVerifiedUser({ email: 'login@test.dev' });
    const res = await request(app).post('/api/auth/login').send({ email: 'login@test.dev', password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    const cookies = res.headers['set-cookie'];
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
  });

  test('login with wrong password → 401 with generic message', async () => {
    await createVerifiedUser({ email: 'login2@test.dev' });
    const res = await request(app).post('/api/auth/login').send({ email: 'login2@test.dev', password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  test('login with unknown email → identical generic 401 (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'Whatever1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  test('disabled account (isActive:false) → 403', async () => {
    await createVerifiedUser({ email: 'disabled@test.dev' });
    const User = require('../src/models/User');
    await User.updateOne({ email: 'disabled@test.dev' }, { isActive: false });
    const res = await request(app).post('/api/auth/login').send({ email: 'disabled@test.dev', password: 'Password123' });
    expect(res.status).toBe(403);
  });

  test('refresh rotates the refresh token and reusing the old one revokes everything', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({
      name: 'Rot',
      email: 'rotate@test.dev',
      password: 'Password123',
    });
    const oldCookie = registerRes.headers['set-cookie'].find((c) => c.startsWith('refreshToken='));

    const r1 = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(r1.status).toBe(200);
    expect(r1.body.data.accessToken).toBeDefined();

    // Old token was rotated out — presenting it again is treated as theft.
    const r2 = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(r2.status).toBe(401);

    // And the newly-issued token was revoked along with all sessions.
    const newCookie = r1.headers['set-cookie'].find((c) => c.startsWith('refreshToken='));
    const r3 = await request(app).post('/api/auth/refresh').set('Cookie', newCookie);
    expect(r3.status).toBe(401);
  });

  test('logout revokes the presented refresh token', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({
      name: 'Out',
      email: 'logout@test.dev',
      password: 'Password123',
    });
    const cookie = registerRes.headers['set-cookie'].find((c) => c.startsWith('refreshToken='));
    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);
    const after = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });

  test('GET /auth/me with valid token → profile; without token → 401', async () => {
    const { token, user } = await registerAndLogin({ email: 'me@test.dev' });
    const ok = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data._id).toBe(user._id);

    const no = await request(app).get('/api/auth/me');
    expect(no.status).toBe(401);
  });

  test('expired access token → 401', async () => {
    const jwt = require('jsonwebtoken');
    await createVerifiedUser({ email: 'expired@test.dev' });
    const expired = jwt.sign(
      { sub: '000000000000000000000000', role: 'customer' },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '-1s', algorithm: 'HS256' }
    );
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  test('forgot/reset password flow', async () => {
    await createVerifiedUser({ email: 'reset@test.dev' });
    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: 'reset@test.dev' });
    expect(forgot.status).toBe(200);
    expect(forgot.body.message).toMatch(/reset link/i);

    // Unknown email gets the same generic response (no enumeration).
    const forgotGhost = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.dev' });
    expect(forgotGhost.status).toBe(200);
    expect(forgotGhost.body.message).toBe(forgot.body.message);

    // Dev-mode response carries the token; use it to reset.
    const token = forgot.body.data.resetToken;
    expect(token).toBeDefined();
    const reset = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'NewPassword123' });
    expect(reset.status).toBe(200);

    const relogin = await login('reset@test.dev', 'NewPassword123');
    expect(relogin.res.status).toBe(200);
  });
});

describe('RBAC on protected routes (PRD §18.1)', () => {
  test('customer token → 403 on admin route; no token → 401; admin → 200', async () => {
    const { token: customerToken } = await registerAndLogin({ email: 'cust@test.dev' });
    const { token: adminToken } = await createAdmin();

    const no = await request(app).get('/api/users');
    expect(no.status).toBe(401);

    const forbidden = await request(app).get('/api/users').set('Authorization', `Bearer ${customerToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    const ok = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    expect(ok.status).toBe(200);
  });
});
