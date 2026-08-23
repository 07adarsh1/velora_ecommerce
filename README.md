# Velora — Production-Grade Full-Stack E-Commerce Platform

A modern, full-stack D2C e-commerce platform built with an architectural focus on financial accuracy, tamper-proof transactions, high-performance image delivery, and a "quiet luxury" design system.

Features catalog browsing with multi-attribute filtering and debounced search, persistent carts and guest-cart merging, a coupon engine, checkout with Razorpay and mock payment gateways, an 9-state server-side order lifecycle state machine, oversell-proof atomic inventory management, verified reviews, and a comprehensive real-time admin dashboard with aggregation analytics.

---

## 🏛️ Architecture & Core Principles

1. **Zero-Trust Client Pricing:** Every price, discount, tax, and shipping calculation is executed strictly server-side by `pricingService`. The client never submits monetary values. Payments are confirmed only after cryptographic HMAC SHA-256 signature verification (`crypto.timingSafeEqual`).
2. **Oversell-Proof Atomic Inventory:** Stock is decremented atomically inside multi-document transactions using conditional `findOneAndUpdate` queries (`stock >= quantity`), preventing race conditions and negative inventory.
3. **Finite State Machine Lifecycle:** Order status transitions strictly adhere to a deterministic adjacency matrix (`orderService.transition`), immediately rejecting illegal transitions with `409 Conflict`.
4. **Server-Side Role-Based Access Control (RBAC):** JWT access tokens (15-min TTL, in-memory) + rotating refresh tokens (7-day TTL, httpOnly cookie with reuse detection). Authorization is enforced on every API route.
5. **Optimized Cloudinary Media Pipeline:** Automated on-the-fly responsive image resizing, format auto-detection (`f_auto`), and quality optimization (`q_auto`) using the `cimg()` delivery helper.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, React Router 7, TanStack Query, Zustand, Tailwind CSS v4 |
| **Typography & Icons** | Fraunces Variable (Display / Serif), Inter Variable (UI / Body), Lucide Icons |
| **Backend** | Node.js, Express (CommonJS), Layered Monolith: Routes → Controllers → Services → Models |
| **Database** | MongoDB 8 via Mongoose (Replica Set required for multi-document ACID transactions) |
| **Authentication** | JWT (in-memory access tokens) + SHA-256 hashed refresh tokens (httpOnly cookies) |
| **Payments** | Razorpay (Test / Live mode) + Local In-Memory Mock Gateway (`MOCK_PAYMENTS=true`) |
| **Analytics & Charts** | Recharts (custom warm-palette styled for revenue & category analytics) |
| **Testing** | Jest, Supertest, `mongodb-memory-server` (53 integration test suites) |

---

## 📂 Repository Layout

```
ecommerce_platform/
├── server/                   # Express REST API
│   ├── src/
│   │   ├── config/           # Environment validation (Zod), MongoDB connection, constants
│   │   ├── controllers/      # Request handlers & response formatting
│   │   ├── middleware/       # JWT auth, RBAC, Zod validation, rate limiters, error handling
│   │   ├── models/           # Mongoose schemas (User, Product, Order, Payment, Cart, etc.)
│   │   ├── routes/           # REST endpoints grouped by resource
│   │   ├── services/         # Core business logic (pricing, orders, inventory, payments)
│   │   ├── utils/            # ApiError, ApiResponse envelope, Pino logger, query helpers
│   │   ├── validators/       # Zod request validation schemas
│   │   ├── scripts/          # Database seeding & in-memory replica set runners
│   │   └── server.js         # API server entry point
│   └── tests/                # 53 integration tests across 5 test suites
│
└── client/                   # React 19 + Tailwind v4 Storefront & Admin
    ├── src/
    │   ├── components/       # Design system primitives, layout (Navbar, Footer), ProductCard
    │   ├── hooks/            # useCart (server/guest unification), useDebouncedValue
    │   ├── lib/api/          # API client with automatic token refresh & endpoints
    │   ├── lib/auth/         # Token store & session state
    │   ├── lib/cart/         # LocalStorage guest cart
    │   ├── lib/utils/        # Cloudinary cimg() delivery transformer
    │   ├── pages/            # Storefront (Home, Products, PDP, Cart, Checkout, Orders)
    │   └── pages/admin/      # Admin suite (Dashboard, Products, Orders, Customers, Coupons, Inventory)
    ├── index.html
    └── vite.config.js
```

---

## ⚡ Quick Start (Local Development)

### 1. Backend Setup

```bash
cd server
cp .env.example .env
npm install

# Start with a local in-memory replica set (no MongoDB installation required):
npm run dev:memory

# OR start with a real MongoDB connection (Atlas / local replica set):
npm run dev
```

### 2. Database Seeding (Optional)

```bash
# Seed default admin, categories, 40+ products, and promotional coupons:
npm run seed -- --fresh

# Default Admin Credentials:
# Email: admin@velora.dev
# Password: ChangeMe123!
```

### 3. Frontend Setup

```bash
cd ../client
cp .env.example .env    # VITE_API_URL=http://localhost:5000
npm install
npm run dev -- --port 3002
```

Open **`http://localhost:3002`** in your browser.

---

## 💳 Payment Gateway Configuration

### Option A: Instant Mock Gateway (Fastest for Local Dev)
In `server/.env`:
```env
MOCK_PAYMENTS=true
```
Clicking "Pay & Place Order" instantly signs, verifies, and confirms payments locally.

### Option B: Razorpay Test Mode
In `server/.env`:
```env
MOCK_PAYMENTS=false
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

**Test Credentials:**
- **Domestic MasterCard:** `5123 4567 8901 2346` | Expiry: `12/28` | CVV: `123` | OTP: `123456`
- **Domestic RuPay:** `5081 5900 0000 0000` | Expiry: `12/28` | CVV: `123` | OTP: `123456`
- **UPI:** `success@razorpay` (auto-approves)

---

## 🧪 Testing & Quality Assurance

```bash
cd server
npm test               # Run all 53 integration test suites
npm run test:coverage  # Generate coverage reports
```

### Test Coverage Highlights:
- **Authentication & RBAC:** Session rotation, refresh token reuse detection, role protection.
- **Inventory Concurrency:** 10 simultaneous checkout payments against 3 available stock units — exactly 3 succeed, 7 receive `409 Conflict`, stock never goes below zero.
- **Payment & Webhook Idempotency:** Duplicate webhook payloads and client-verification race conditions resolve idempotently without double-fulfilling orders.
- **Order State Transitions:** Rigorous testing of legal transitions and rejection of invalid states.
- **Coupons & Reviews:** Verified purchase computation, usage limits, and rating recalculations.

---

## 🎨 Design System Tokens

- **Canvas:** `#FAF9F7` (Warm off-white)
- **Surface:** `#FFFFFF` (Pure white)
- **Ink / Text:** `#1C1B1A` (Warm near-black)
- **Secondary Ink:** `#6E6A65`
- **Accent:** `#0F5C4C` (Deep emerald)
- **Accent Soft:** `#EDF5F2`
- **Sale / Discount:** `#B4432F` (Brick red)
- **Gold / Ratings:** `#B08D57`
- **Borders:** `1px solid #E8E5E0` hairline borders
- **Display Typography:** Fraunces Variable Serif
- **Body Typography:** Inter Variable Sans

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
