'use strict';

// These are fictional classroom accounts. Only bcrypt hashes are stored.
// The matching demo passwords are documented in README.md for local testing.
const HASHES = Object.freeze({
  waiterBole: '$2b$10$8pE46pKuusnW1QIRXhltW.9o54Y0OME.sDPSLsrolJPvtcjblgywq',
  cashierBole: '$2b$10$QWRu29xXS.yJx.sF/sd3S.DHiuvs.2FlI.657Y4bKCB1ItZI7pUKS',
  managerBole: '$2b$10$DbhDAHa/UPsPjAgqxzOhOOEIcw4oowygKAbo8LyfoHoA2xbH8wu9i',
  waiterPiassa: '$2b$10$2EgHHDSHpwJrEJyr/WTSEeBKwBkrfxOMH7Mu8XJXvWaJ.7IhDqw86',
  cashierPiassa: '$2b$10$ygX9NaygmZXnpuMlCE8LyecuA1qVHJ/kd47TCbnE73K5vbCyhZHwq',
  managerPiassa: '$2b$10$izKWxZXVa7s/CTtfjYege.cPmMKzvoSyyAY.iMdHjHZ/boP9JJAa6',
  admin: '$2b$10$VWBmSy.MF4KjsAU/0jgBwOylVLvxG6.t7zU6LneyygepE10/X4sby'
});

function createStore() {
  const users = [
    { id: 'user-waiter-bole', email: 'waiter.bole@dinedesk.example', role: 'waiter', branchId: 'bole', active: true, passwordHash: HASHES.waiterBole },
    { id: 'user-cashier-bole', email: 'cashier.bole@dinedesk.example', role: 'cashier', branchId: 'bole', active: true, passwordHash: HASHES.cashierBole },
    { id: 'user-manager-bole', email: 'manager.bole@dinedesk.example', role: 'manager', branchId: 'bole', active: true, passwordHash: HASHES.managerBole },
    { id: 'user-waiter-piassa', email: 'waiter.piassa@dinedesk.example', role: 'waiter', branchId: 'piassa', active: true, passwordHash: HASHES.waiterPiassa },
    { id: 'user-cashier-piassa', email: 'cashier.piassa@dinedesk.example', role: 'cashier', branchId: 'piassa', active: true, passwordHash: HASHES.cashierPiassa },
    { id: 'user-manager-piassa', email: 'manager.piassa@dinedesk.example', role: 'manager', branchId: 'piassa', active: true, passwordHash: HASHES.managerPiassa },
    { id: 'user-admin', email: 'admin@dinedesk.example', role: 'admin', branchId: null, active: true, passwordHash: HASHES.admin }
  ];

  const orders = [
    { id: 'order-bole-001', branchId: 'bole', table: 'B-01', items: ['Injera combo'], total: 520, createdBy: 'user-waiter-bole' },
    { id: 'order-bole-002', branchId: 'bole', table: 'B-02', items: ['Shiro', 'Water'], total: 310, createdBy: 'user-waiter-bole' },
    { id: 'order-piassa-001', branchId: 'piassa', table: 'P-01', items: ['Tibs'], total: 680, createdBy: 'user-waiter-piassa' },
    { id: 'order-piassa-002', branchId: 'piassa', table: 'P-02', items: ['Pasta'], total: 450, createdBy: 'user-waiter-piassa' }
  ];

  return {
    users,
    orders,
    payments: [],
    nextOrderNumber: 3,
    nextPaymentNumber: 1
  };
}

module.exports = { createStore };
