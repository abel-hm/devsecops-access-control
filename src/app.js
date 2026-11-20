'use strict';

const express = require('express');
const { loadConfig } = require('./config');
const { createStore } = require('./store');
const { createAuthentication } = require('./authentication');
const { requireRole, requirePermission, canAccessOrder } = require('./authorization');

function createApp(options = {}) {
  const config = options.config || loadConfig();
  const store = options.store || createStore();
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  const auth = createAuthentication({ config, store });

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
  app.post('/api/auth/login', auth.login);

  app.get('/api/orders', auth.authenticate, requirePermission('orders:read'), (req, res) => {
    const visibleOrders = store.orders.filter((order) => canAccessOrder(req.user, order));
    return res.status(200).json({ orders: visibleOrders });
  });

  app.get('/api/orders/:id', auth.authenticate, requirePermission('orders:read'), (req, res) => {
    const order = store.orders.find((candidate) => candidate.id === req.params.id);
    if (!order || !canAccessOrder(req.user, order)) {
      // A 404 hides whether an order belonging to another branch exists.
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.status(200).json({ order });
  });

  app.post('/api/orders', auth.authenticate, requirePermission('orders:create'), (req, res) => {
    const body = req.body || {};
    if (!req.user.branchId || typeof body.table !== 'string' || !body.table.trim() ||
        !Array.isArray(body.items) || body.items.length < 1 ||
        !body.items.every((item) => typeof item === 'string' && item.trim())) {
      return res.status(400).json({ error: 'A table and at least one item are required' });
    }
    const order = {
      id: `order-${req.user.branchId}-${String(store.nextOrderNumber++).padStart(3, '0')}`,
      branchId: req.user.branchId,
      table: body.table.trim(),
      items: body.items.map((item) => item.trim()),
      total: Number.isFinite(Number(body.total)) && Number(body.total) >= 0 ? Number(body.total) : 0,
      createdBy: req.user.id
    };
    if (!canAccessOrder(req.user, order)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    store.orders.push(order);
    return res.status(201).json({ order });
  });

  app.post('/api/payments', auth.authenticate, requirePermission('payments:create'), (req, res) => {
    const body = req.body || {};
    const order = store.orders.find((candidate) => candidate.id === body.orderId);
    if (!order || !canAccessOrder(req.user, order)) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const payment = {
      id: `payment-${String(store.nextPaymentNumber++).padStart(3, '0')}`,
      orderId: order.id,
      branchId: order.branchId,
      amount: order.total,
      status: 'demo-recorded'
    };
    store.payments.push(payment);
    return res.status(201).json({ payment });
  });

  app.get('/api/reports/branch', auth.authenticate, requirePermission('reports:read'), (req, res) => {
    if (!req.user.branchId) {
      return res.status(403).json({ error: 'A branch-scoped manager account is required' });
    }
    const branchOrders = store.orders.filter((order) => order.branchId === req.user.branchId);
    const report = {
      branchId: req.user.branchId,
      orderCount: branchOrders.length,
      revenue: branchOrders.reduce((sum, order) => sum + order.total, 0),
      orderIds: branchOrders.map((order) => order.id)
    };
    return res.status(200).json({ report });
  });

  app.get('/api/admin/users', auth.authenticate, requireRole('admin'), (_req, res) => {
    const safeUsers = store.users.map(({ id, email, role, branchId, active }) => ({
      id, email, role, branchId, active
    }));
    return res.status(200).json({ users: safeUsers });
  });

  app.patch('/api/admin/users/:id/deactivate', auth.authenticate, requireRole('admin'), (req, res) => {
    const user = store.users.find((candidate) => candidate.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.active = false;
    return res.status(200).json({
      user: { id: user.id, email: user.email, role: user.role, branchId: user.branchId, active: user.active }
    });
  });

  app.use((err, _req, res, _next) => {
    // Do not include exception details, settings or credentials in client output.
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  });

  app.locals.store = store;
  app.locals.config = config;
  app.locals.canAccessOrder = canAccessOrder;
  return app;
}

module.exports = { createApp };
