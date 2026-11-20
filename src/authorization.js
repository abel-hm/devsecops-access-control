'use strict';

const PERMISSIONS = Object.freeze({
  waiter: Object.freeze(['orders:create', 'orders:read']),
  cashier: Object.freeze(['orders:read', 'payments:create']),
  manager: Object.freeze(['orders:read', 'reports:read']),
  // Administrators manage accounts and can read chain-wide orders. The
  // branch-report endpoint remains manager-only because an admin has no branch.
  admin: Object.freeze(['users:manage', 'orders:read'])
});

function permissionsForRole(role) {
  return PERMISSIONS[role] || [];
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || !permissionsForRole(req.user.role).includes(permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

// Single policy used whenever an order is returned. Admin is chain-wide;
// every other staff identity is restricted to its own branch.
function canAccessOrder(user, order) {
  if (!user || !order) return false;
  if (user.role === 'admin') return true;
  return Boolean(user.branchId && user.branchId === order.branchId);
}

module.exports = { PERMISSIONS, permissionsForRole, requireRole, requirePermission, canAccessOrder };
