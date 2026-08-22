# ShelfLife — Production-Grade Full-Stack E-Commerce Platform

A complete e-commerce system: catalog browsing with filters/search/sort, persistent
carts and wishlists, coupon engine, checkout with payment-gateway integration
(Razorpay, with a mock gateway for local development), an 9-state order lifecycle
enforced by a server-side state machine, oversell-proof inventory, verified
reviews, and an admin dashboard with real aggregation analytics.

Built per the PRD's five non-negotiables:

1. **Money is never trusted from the client** — every price is recomputed
   server-side by a single `pricingService`; payments are confirmed only after
   HMAC signature verification (`crypto.timingSafeEqual`).
2. **Stock is decremented atomically, only at confirmed payment** — one
   `findOneAndUpdate` with the sufficiency check in the filter (no
   read-then-write window), inside a multi-document transaction.
3. **Order status changes only through `orderService.transition`** — an
   adjacency map rejects every illegal transition with `409`.
4. **Authorization is enforced server-side on every route** — `authenticate` +
   `authorize(role)` middleware; the frontend's route guards are UX only.
5. **Schemas match PRD §7 exactly** — embed-vs-reference decisions are
   documented per model (order items are immutable snapshots, not references).

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express (CommonJS), layered: routes → controllers → services → models |
| Database | MongoDB via Mongoose 8 (replica set required — used for payment transactions) |
| Auth | JWT access tokens (15 min, in-memory on the client) + rotating refresh tokens (7 d, httpOnly cookie, hashed at rest) |
| Payments | Razorpay (test mode) with signature-verified sync + webhook paths; `MOCK_PAYMENTS=true` simulates the gateway locally |
| Frontend | React 18 (plain JavaScript, no TypeScript) + Vite + React Router 7 |
| UI | Tailwind CSS v4, react-hot-toast, Recharts (admin analytics) |
| Server state | TanStack Query · Client state: Zustand (auth) + localStorage (guest cart) |
| Tests | Jest + Supertest + mongodb-memory-server (replica set) — 53 integration tests |

## Repository layout

```
server/               Express API
├── src/
│   ├── config/       env validation (zod), db, constants (state machine, enums)
│   ├── models/       User, Product, Category, Cart, Wishlist, Address,
│   │                 Order, Payment, Coupon, Review, InventoryHistory
│   ├── routes/       one file per resource + admin/analytics/health
│   ├── controllers/  thin: parse → call service → shape response
│   ├── services/     ALL business logic (pricing, cart, order, payment,
│   │                 inventory, coupon, review, analytics, auth)
│   ├── middleware/   authenticate, authorize, validate (zod), rate limiters,
│   │                 errorHandler, notFound, optionalAuth
│   ├── validators/   zod request schemas per route
│   ├── utils/        ApiError, ApiResponse envelope, asyncHandler, logger (pino)
│   ├── scripts/      seed.js (admin, categories, 42 products, coupons,
│   │                 reviews), dev-memory.js (in-memory replica set)
│   └── app.js / server.js
└── tests/            integration suites (auth, checkout, orders, products/cart,
                      coupons/reviews) + helpers + jest global setup

client/               React SPA
├── src/
│   ├── lib/api/      fetch client (silent refresh + retry-once on 401),
│   │                 one function per endpoint
│   ├── lib/auth/     token store (access token in memory only)
│   ├── lib/cart/     guest cart (localStorage, merges at login)
│   ├── hooks/        useCart (server/guest cart unification), useDebouncedValue
│   ├── components/   ui kit (Button/Input/Modal/Skeleton/EmptyState/...),
│   │                 product, layout
│   └── pages/        shop (home/PLP/PDP/cart/wishlist/checkout/orders),
│   │                 auth, account, admin (lazy-loaded chunk: dashboard,
│   │                 products, orders, customers, coupons, inventory)
└── vite.config.js    React + Tailwind plugins, dev port 3000
```

## Quick start (local, zero external services)

No MongoDB installed? Everything still runs — `dev-memory` boots an in-memory
replica set (transactions included), and `MOCK_PAYMENTS=true` simulates the
gateway with the same sign/verify code path.

```bash
# 1. Backend
cd server
cp .env.example .env            # then edit secrets (any random hex works in dev)
npm install
npm run dev:memory              # API on :5000 with in-memory replica set

# 2. Seed (grab the mongodb:// URI from the dev-memory log line)
MONGODB_URI="<uri-from-log>" npm run seed -- --fresh
# Admin login: admin@shelflife.dev / ChangeMe123! (from .env)

# 3. Frontend
cd ../client
cp .env.example .env            # VITE_API_URL=http://localhost:5000
npm install
npm run dev                     # SPA on :3000 (Vite falls back to :3001 if busy)
```

With a real MongoDB (local or Atlas): set `MONGODB_URI` and run `npm run dev`
instead. **Atlas is required in production** — the free M0 tier is a replica
set, which the payment-confirmation transaction needs.

### Running with real Razorpay (test mode)

1. Create a Razorpay account → Settings → API Keys → get **test** key id/secret.
2. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `MOCK_PAYMENTS=false`.
3. Register the webhook in the Razorpay dashboard →
   `https://<your-backend>/api/payments/webhook` with secret
   `RAZORPAY_WEBHOOK_SECRET`, subscribing to `payment.captured`,
   `payment.failed`, `refund.processed`.

## Tests

```bash
cd server
npm test              # 53 integration tests against an in-memory replica set
npm run test:coverage
```

Coverage highlights (PRD §18.1 minimum list):

- Auth: register/login/logout/refresh **rotation + reuse detection**,
  disabled accounts, password reset, generic anti-enumeration errors
- RBAC: every `/admin/*` route returns 403 for a customer token
- Products: combined filters + sort + pagination in one query, text search,
  unpublished → 404 for guests / visible to admin preview
- Cart: stock validation on every mutation, guest-cart merge capped at stock
- Checkout end-to-end: server-side pricing (tamper-proof), signature
  verification, **webhook replay is a no-op** (idempotent confirmation)
- Order state machine: every legal transition succeeds, every illegal one 409s
- **Overselling**: 10 concurrent payment confirmations against stock 3 →
  exactly 3 succeed, 7 get 409, final stock 0, never negative
- Coupons: expiry, min order, per-user and total usage limits, usage recorded
  exactly once per confirmed payment
- Reviews: one per (user, product), `verifiedPurchase` computed server-side,
  denormalized ratings recalculated on create/edit/delete

## Manual GUI verification (performed)

The full journey was exercised in a real browser against the running stack:
register → browse → product page → add to cart (badge updates) → apply
`WELCOME10` (−₹700, tax recomputed) → checkout (address form, Pay disabled
until complete) → mock payment → **order page shows PAYMENT CONFIRMED / PAID**
with tracker + timeline → admin dashboard showing the order's ₹7,482 in live
aggregates → admin order transitions (Start processing → shipment → SHIPPED).
Server-side effects verified in the DB: stock decremented, cart cleared,
`InventoryHistory` written, coupon usage recorded.

## Deployment (PRD §19)

| Piece | Where | Notes |
|---|---|---|
| Frontend | Vercel | build `client/`, set `VITE_API_URL` to the backend URL |
| Backend | Render / Railway | build `server/`, `npm start`; env vars from dashboard |
| Database | MongoDB Atlas | free M0 replica set; dedicated least-privilege user |
| Images | Cloudinary | `CLOUDINARY_*` env vars enable `/products/:id/images` uploads |
| Payments | Razorpay test mode | webhook URL → `/api/payments/webhook` |

Production env checklist: `NODE_ENV=production`, strong random
`ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET`, `CLIENT_ORIGIN` set to your
Vercel URL(s) only, `MOCK_PAYMENTS=false` + Razorpay keys (both validated at
boot — the server refuses to start otherwise), Atlas connection string.

Note on cookies across origins (Vercel ⇄ Render are different sites): if the
refresh cookie is dropped in your deployed setup, serve the API and the SPA
from the same site (e.g., custom domain + subdomain, or proxy `/api` through
the frontend host) — `sameSite: 'strict'` cookies do not travel cross-site.

## Design decisions worth knowing (interview fodder)

- **Why bcryptjs?** Same algorithm/API as bcrypt without native build churn on
  Windows/CI; cost factor 12 per PRD.
- **Why a replica set locally?** `confirmPayment` wraps Payment + Order +
  stock + cart + coupon-usage in one multi-document transaction — a standalone
  mongod would throw on `startSession().withTransaction()`.
- **`PAYMENT_FAILED → PENDING_PAYMENT`** is the one deliberate addition to the
  PRD's transition table: §9.5 requires retrying payment on the *same* order,
  which is impossible if the failure state is terminal.
- **Idempotency** lives in one function (`orderService.confirmPayment`): both
  the client-verify endpoint and the webhook call it; it checks payment status
  and a processed-event-ID list before doing anything, so duplicate webhook
  delivery and the verify/webhook race collapse into no-ops.
- **Refresh-token rotation** retires each token on use (atomic conditional
  update — no version-collision races) and treats presentation of an
  already-rotated token as theft → all sessions revoked.
- **Guest carts** live in localStorage and merge into the server cart at login
  in one `/api/cart/merge` call, quantities capped at current stock.

## Security notes

- Admin elevation is **not** exposed via any public API — seed a script or
  edit the DB (deliberate, per PRD §3).
- Password reset tokens and refresh tokens are stored **hashed**; access
  tokens are short-lived and kept in memory on the client (not localStorage).
- Login/forgot-password are rate-limited (25 req / 15 min / IP); global limit
  500 / 15 min; errors never leak stack traces; login failures are generic to
  prevent user enumeration.
- All inputs are zod-validated at the edge; updates go through explicit field
  whitelists (no mass assignment); ownership is checked on every by-id route.

## What's next (post-MVP, PRD §16)

Redis caching → BullMQ background jobs (email) → Docker → cohort analytics →
recommendations. None block the MVP; the service layer is already structured
so each slots in without touching controllers.
