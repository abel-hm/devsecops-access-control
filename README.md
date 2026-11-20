# DineDesk API - Assignment Seven

A classroom demonstration API for authentication, role/permission authorization, branch-level access control, and secrets management.

## Requirements

- Node.js 20 or later
- npm

## Local setup

1. Open a terminal in this folder.
2. Install dependencies: `npm install` (this creates `package-lock.json`; commit that lock file with the source).
3. Copy `.env.example` to `.env`.
4. Replace the `JWT_SECRET` placeholder in `.env` with a new random value of at least 32 characters. Do not commit `.env` or paste its value into an assignment answer, screenshot, or chat.
5. Start the API with `npm start`.
6. In a second terminal, run `npm test`.

The API deliberately refuses to start when `JWT_SECRET` is missing or shorter than 32 characters. It never prints the secret value.

## Fictional demo accounts

All accounts and passwords are invented for this assignment. They are for local classroom testing only.

| Role | Branch | Email | Demo password |
|---|---|---|---|
| Waiter | Bole | `waiter.bole@dinedesk.example` | `WaiterBole-Demo-2026!` |
| Cashier | Bole | `cashier.bole@dinedesk.example` | `CashierBole-Demo-2026!` |
| Manager | Bole | `manager.bole@dinedesk.example` | `ManagerBole-Demo-2026!` |
| Waiter | Piassa | `waiter.piassa@dinedesk.example` | `WaiterPiassa-Demo-2026!` |
| Cashier | Piassa | `cashier.piassa@dinedesk.example` | `CashierPiassa-Demo-2026!` |
| Manager | Piassa | `manager.piassa@dinedesk.example` | `ManagerPiassa-Demo-2026!` |
| Administrator | No branch | `admin@dinedesk.example` | `Admin-Demo-2026!` |

Passwords are represented in the application only by bcrypt hashes. The table above contains fictional test credentials, not production secrets.

## API routes

| Method and path | Access rule |
|---|---|
| `POST /api/auth/login` | Public; generic 401 on bad email/password |
| `GET /api/orders` | `orders:read`; filtered by branch, except admin |
| `GET /api/orders/:id` | `orders:read`; cross-branch orders return 404 |
| `POST /api/orders` | `orders:create`; branch comes from verified server-side identity |
| `POST /api/payments` | `payments:create`; cashier can pay only for an order in their branch |
| `GET /api/reports/branch` | `reports:read`; manager's branch comes from the verified user record |
| `GET /api/admin/users` | `requireRole('admin')`; hashes are excluded |
| `PATCH /api/admin/users/:id/deactivate` | `requireRole('admin')`; next request with the deactivated user's old token receives 401 |

`?branchId=...` is ignored by the branch report route. Non-admin users cannot read or pay for another branch's order. The API intentionally returns 404 for a cross-branch order so it does not reveal whether that order ID exists.

## Roles and permissions

- `waiter`: `orders:create`, `orders:read`
- `cashier`: `orders:read`, `payments:create`
- `manager`: `orders:read`, `reports:read`
- `admin`: `users:manage`, `orders:read`
- Unknown roles: no permissions

The administrator has no branch. For that reason the branch-report endpoint is manager-only; a future chain-wide report should be a separate endpoint and permission rather than silently inventing an administrator branch.

## Tests and the intentional policy-break exercise

`npm test` runs Jest and Supertest. The test configuration uses a fixed, fictional test-only signing key injected directly into the app; no GitHub secret or local `.env` value is required.

Run `npm run prove:policy-break` to temporarily change `canAccessOrder` to allow everyone, show the resulting failing tests, restore the original policy automatically, and run the passing suite again. The script uses a backup and an EXIT trap so the source is restored even if the negative test fails.

## GitHub Actions

- `.github/workflows/ci.yml` runs tests on every push and pull request with `permissions: contents: read`.
- `.github/workflows/verify-demo-secret.yml` is manually triggered and checks whether `DINEDESK_DEMO_KEY` exists without printing the value. The secret is passed to only one step via `env:`.

For the assignment's secret exercise, create `DINEDESK_DEMO_KEY` in the GitHub repository settings, run the manual workflow, record the real run URL and safe log line, and then delete the repository secret.

## Limitations

This is an educational in-memory API. Users, orders, and payments reset when the process restarts. In production, use a persistent database with transactional account-status changes, migrations, audit logging, rate limits, TLS, refresh-token rotation/revocation, secure password reset, centralized secret storage, and a real payment provider integration. Never place a payment provider secret in the React bundle.
