'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');

const TEST_CONFIG = Object.freeze({
  port: 0,
  jwtSecret: 'test-only-signing-key-not-a-real-secret-2026',
  jwtIssuer: 'dinedesk-api-test',
  jwtAudience: 'dinedesk-staff-test',
  jwtExpiresIn: '15m'
});

let app;
let api;
let store;

async function login(email, password, extraBody = {}) {
  const response = await api.post('/api/auth/login').send({ email, password, ...extraBody });
  return response;
}

async function bearer(email, password) {
  const response = await login(email, password);
  expect(response.status).toBe(200);
  return response.body.accessToken;
}

beforeEach(() => {
  app = createApp({ config: TEST_CONFIG });
  api = request(app);
  store = app.locals.store;
});

describe('DineDesk authentication and authorization', () => {
  test('no token returns 401', async () => {
    const response = await api.get('/api/orders');
    expect(response.status).toBe(401);
  });

  test('malformed or non-Bearer authorization returns 401', async () => {
    const response = await api.get('/api/orders').set('Authorization', 'Basic abc123');
    expect(response.status).toBe(401);
  });

  test('a token signed with the wrong key returns 401', async () => {
    const token = jwt.sign(
      { sub: 'user-manager-bole' },
      'attacker-controlled-signing-key-xxxxxxxx',
      { algorithm: 'HS256', expiresIn: '15m', issuer: TEST_CONFIG.jwtIssuer, audience: TEST_CONFIG.jwtAudience }
    );
    const response = await api.get('/api/orders').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(401);
  });

  test('an expired token returns 401', async () => {
    const token = jwt.sign(
      { sub: 'user-manager-bole', exp: Math.floor(Date.now() / 1000) - 30 },
      TEST_CONFIG.jwtSecret,
      { algorithm: 'HS256', issuer: TEST_CONFIG.jwtIssuer, audience: TEST_CONFIG.jwtAudience }
    );
    const response = await api.get('/api/orders').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(401);
  });

  test('wrong email and wrong password return the same generic login error', async () => {
    const wrongEmail = await login('nobody@dinedesk.example', 'some-password');
    const wrongPassword = await login('waiter.bole@dinedesk.example', 'wrong-password');
    expect(wrongEmail.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(wrongEmail.body).toEqual({ error: 'Invalid email or password' });
    expect(wrongPassword.body).toEqual(wrongEmail.body);
  });

  test('login ignores role and branch values supplied by the client', async () => {
    const response = await login('waiter.bole@dinedesk.example', 'WaiterBole-Demo-2026!', {
      role: 'admin', branchId: 'piassa'
    });
    expect(response.status).toBe(200);
    const token = response.body.accessToken;
    const orders = await api.get('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('X-User-Role', 'admin');
    expect(orders.status).toBe(200);
    expect(orders.body.orders.every((order) => order.branchId === 'bole')).toBe(true);
  });

  test('a waiter calling GET /api/admin/users receives 403', async () => {
    const token = await bearer('waiter.bole@dinedesk.example', 'WaiterBole-Demo-2026!');
    const response = await api.get('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  test('an administrator can list users and no password hashes are returned', async () => {
    const token = await bearer('admin@dinedesk.example', 'Admin-Demo-2026!');
    const response = await api.get('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(7);
    expect(response.body.users.every((user) => !Object.hasOwn(user, 'passwordHash'))).toBe(true);
  });

  test('a waiter can create an order and the server assigns the trusted branch', async () => {
    const token = await bearer('waiter.bole@dinedesk.example', 'WaiterBole-Demo-2026!');
    const response = await api.post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ table: 'B-09', items: ['Coffee'], total: 90, branchId: 'piassa' });
    expect(response.status).toBe(201);
    expect(response.body.order.branchId).toBe('bole');
    expect(response.body.order.createdBy).toBe('user-waiter-bole');
  });

  test('a cashier cannot create an order and receives 403', async () => {
    const token = await bearer('cashier.bole@dinedesk.example', 'CashierBole-Demo-2026!');
    const response = await api.post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ table: 'B-10', items: ['Tea'] });
    expect(response.status).toBe(403);
  });

  test('a Bole manager can read a Bole order', async () => {
    const token = await bearer('manager.bole@dinedesk.example', 'ManagerBole-Demo-2026!');
    const response = await api.get('/api/orders/order-bole-001').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.order.branchId).toBe('bole');
  });

  test('a Bole manager is denied a Piassa order with 404', async () => {
    const token = await bearer('manager.bole@dinedesk.example', 'ManagerBole-Demo-2026!');
    const response = await api.get('/api/orders/order-piassa-001').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
  });

  test('GET /api/orders returns only the authenticated staff member branch orders', async () => {
    const token = await bearer('waiter.piassa@dinedesk.example', 'WaiterPiassa-Demo-2026!');
    const response = await api.get('/api/orders').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.orders).toHaveLength(2);
    expect(response.body.orders.every((order) => order.branchId === 'piassa')).toBe(true);
  });

  test('a waiter calling GET /api/reports/branch receives 403', async () => {
    const token = await bearer('waiter.bole@dinedesk.example', 'WaiterBole-Demo-2026!');
    const response = await api.get('/api/reports/branch').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  test('a Piassa manager cannot change report scope with ?branchId=bole', async () => {
    const token = await bearer('manager.piassa@dinedesk.example', 'ManagerPiassa-Demo-2026!');
    const response = await api.get('/api/reports/branch?branchId=bole').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.report.branchId).toBe('piassa');
    expect(response.body.report.orderIds).toEqual(['order-piassa-001', 'order-piassa-002']);
    expect(response.body.report.orderIds.some((id) => id.includes('bole'))).toBe(false);
  });

  test('a cashier can record a payment for an order in their own branch', async () => {
    const token = await bearer('cashier.bole@dinedesk.example', 'CashierBole-Demo-2026!');
    const response = await api.post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: 'order-bole-001' });
    expect(response.status).toBe(201);
    expect(response.body.payment.branchId).toBe('bole');
  });

  test('a cashier cannot record payment for another branch order', async () => {
    const token = await bearer('cashier.bole@dinedesk.example', 'CashierBole-Demo-2026!');
    const response = await api.post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: 'order-piassa-001' });
    expect(response.status).toBe(404);
  });

  test('an unknown role receives no implicit permissions', async () => {
    store.users.find((user) => user.id === 'user-waiter-bole').role = 'kitchen';
    const token = await bearer('waiter.bole@dinedesk.example', 'WaiterBole-Demo-2026!');
    const response = await api.get('/api/orders').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  test('an administrator can deactivate a manager and the old token fails on the next request', async () => {
    const managerToken = await bearer('manager.bole@dinedesk.example', 'ManagerBole-Demo-2026!');
    const adminToken = await bearer('admin@dinedesk.example', 'Admin-Demo-2026!');
    const deactivate = await api.patch('/api/admin/users/user-manager-bole/deactivate')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.user.active).toBe(false);
    const response = await api.get('/api/orders').set('Authorization', `Bearer ${managerToken}`);
    expect(response.status).toBe(401);
  });
});
