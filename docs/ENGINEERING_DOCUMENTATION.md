# Silkwaves Backend — Engineering Documentation

**Version:** 1.0
**Scope:** `silkwaves-backend` (Node.js / Express / MongoDB API), with references to its two client applications (`silkwaves` storefront, `silkwaves-admin` CMS) and its local integration bridge (`silkwaves-tally-bridge`).
**Audience:** Any engineer joining this project — this document is written to be the single source of truth needed to understand, run, debug, deploy, and extend the system without asking the original author anything.

> **How this document was produced:** Every architectural claim, schema field, route, and controller behavior in this document was verified directly against the live source code at the time of writing. Every debugging story, deployment issue, and integration decision in Sections 19–22 is drawn from the actual engineering session logs for this project. Where something is planned but not built, it is explicitly labeled **Planned** or **Future Work** — nothing here is invented.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Project Structure](#4-project-structure)
5. [Database Documentation](#5-database-documentation)
6. [Authentication System](#6-authentication-system)
7. [API Documentation](#7-api-documentation)
8. [Product Management](#8-product-management)
9. [Order Management](#9-order-management)
10. [Payment System](#10-payment-system)
11. [Shipping System](#11-shipping-system)
12. [Email System](#12-email-system)
13. [Invoice System](#13-invoice-system)
14. [Dashboard](#14-dashboard)
15. [Fulfillment](#15-fulfillment)
16. [Frontend Integration](#16-frontend-integration)
17. [Environment Variables](#17-environment-variables)
18. [Deployment](#18-deployment)
19. [External Integrations](#19-external-integrations)
20. [Tally Integration (Case Study)](#20-tally-integration-case-study)
21. [Development Timeline](#21-development-timeline)
22. [Problems Faced & Debugging Handbook](#22-problems-faced--debugging-handbook)
23. [Code Standards](#23-code-standards)
24. [Future Roadmap](#24-future-roadmap)
25. [Project Summary](#25-project-summary)

---

## 1. Project Overview

### 1.1 What Silkwaves Is

Silkwaves is a direct-to-consumer e-commerce business selling sarees (Indian silk garments), operating under the registered trade name **ATHARV FASHION**. The product spans three coordinated applications plus one local integration tool:

| Application | Repo | Deployment | Purpose |
|---|---|---|---|
| Storefront | `silkwaves` | Netlify | Public customer-facing shopping site — browse, cart, checkout, order tracking, account, wishlist |
| Admin CMS | `silkwaves-admin` | Netlify | Internal tool for staff to manage products, orders, customers, employees, reports, settings, and Tally vouchers |
| Backend API | `silkwaves-backend` | Render | The single Node/Express API both of the above talk to; owns all business logic and the MongoDB database |
| Tally Bridge | `silkwaves-tally-bridge` | Runs locally on the shop's PC (not deployed to any cloud host) | Polls the backend and pushes sales/stock data into a local Tally Prime accounting installation |

### 1.2 Business Goal

Silkwaves needed a real online storefront to sell sarees directly to customers with:
- A professional shopping experience (browsing, cart, checkout, order tracking) comparable to established e-commerce sites.
- Reliable payment collection (via Razorpay) and automated shipping (via Delhivery).
- Staff tooling to manage the catalog, fulfill orders, and see business performance — without needing developer involvement for day-to-day operations.
- Compliance and bookkeeping continuity: since ATHARV FASHION's actual accounting of record is done in **Tally Prime**, every online sale needs to eventually appear there as a proper GST-compliant sales voucher, not just live in MongoDB.

### 1.3 Purpose of the Backend

The backend is the **single source of truth and single point of business logic** for the whole system. Both client apps are intentionally "thin" — they render UI and call backend endpoints; almost no business logic (stock checks, payment verification, permission checks, GST tax computation) lives in either frontend. This keeps the storefront and admin panel simple and means all critical logic can be reasoned about, tested, and fixed in one codebase.

### 1.4 High-Level Architecture

```
                     ┌─────────────────────┐
                     │   Customers (web)   │
                     └──────────┬──────────┘
                                │ HTTPS
                                ▼
                  ┌──────────────────────────┐
                  │  silkwaves (Storefront)  │  Netlify
                  │  React + Vite            │
                  └──────────────┬───────────┘
                                 │ REST/JSON (fetch)
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│                    silkwaves-backend (API)                     │  Render
│         Node.js + Express 5, single deployable service         │
│                                                                  │
│   Auth  Products  Orders  Payments  Shipping  Reports  Tally    │
└───┬──────────┬──────────┬─────────┬─────────┬─────────┬────────┘
    │          │          │         │         │         │
    ▼          ▼          ▼         ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐ ┌────────┐ ┌──────────────┐
│MongoDB │ │Cloudin.│ │Razorpay│ │Delhiv.│ │ Brevo  │ │Tally Bridge  │
│ Atlas  │ │(images)│ │(pay)   │ │(ship) │ │(email) │ │(local PC,    │
│        │ │        │ │        │ │       │ │        │ │polls backend)│
└────────┘ └────────┘ └────────┘ └───────┘ └────────┘ └──────┬───────┘
                                                               │ local XML/HTTP
                                                               ▼
                                                        ┌──────────────┐
                                                        │ Tally Prime  │
                                                        │ (local PC)   │
                                                        └──────────────┘
                                 ▲
                                 │ REST/JSON (fetch, JWT auth)
                  ┌──────────────┴───────────┐
                  │ silkwaves-admin (CMS)     │  Netlify
                  │ React + Vite              │
                  └──────────────┬────────────┘
                                 │
                     ┌───────────┴───────────┐
                     │   Staff / Admin users │
                     └────────────────────────┘
```

### 1.5 Customer Flow

1. Customer browses products (`GET /products`, public, no auth).
2. Customer optionally logs in via phone-number OTP (email-delivered, since SMS/DLT is not set up — see [§22.12](#2212-otp-delivered-by-email-not-sms)) to save addresses and view order history.
3. Customer adds items to a client-side cart (no server-side cart persistence — see [§24](#24-future-roadmap)) and checks out.
4. `POST /orders` creates an Order in `Pending` payment state.
5. `POST /create-payment` creates a Razorpay order; the Razorpay Checkout widget collects payment client-side.
6. `POST /verify-payment` verifies the Razorpay signature, marks the order `Paid`, decrements stock, and (best-effort) emails an order confirmation with the invoice PDF attached.
7. Customer can track the order via `GET /customer/orders` (their own orders only, JWT-scoped).

### 1.6 Admin Flow

1. Staff log in (`POST /auth/login`) with email/password, receive a JWT.
2. Depending on `role` (`admin` full access, or `employee` with granular per-section `view`/`edit` permissions), staff can:
   - Manage products (create/edit/delete, upload images to Cloudinary, assign a Tally Stock Group).
   - View and manage orders (change status, change payment status, trigger status-update emails, upload a manually-generated Tally invoice PDF).
   - Manage fulfillment (create Delhivery shipments, print labels, track, cancel).
   - View customers and their order history.
   - Manage other employee accounts and their permissions (admin-only).
   - View analytics on the Dashboard and generate Excel exports (Orders, Products, Customers, and a combined Report).
   - View the Vouchers panel to see which orders have synced to Tally and what voucher number was assigned.

### 1.7 Backend Responsibilities

- **Data ownership**: single MongoDB database, all writes gated through the API.
- **Authentication & authorization**: two separate JWT schemes (admin/employee vs. customer), plus a third API-key scheme for the local Tally bridge.
- **Business rules**: stock decrement on payment, GST-relevant data shaping for Tally, permission enforcement, order/payment state machines.
- **Third-party orchestration**: Cloudinary (images), Razorpay (payments), Delhivery (shipping), Brevo (email), and (locally) Tally Prime (accounting) — the backend is the only thing that talks to any of these; neither frontend calls a third party directly except the Razorpay Checkout widget, which is loaded client-side per Razorpay's standard integration pattern but still requires backend-side order creation and signature verification.
- **Reporting**: on-demand Excel exports and dashboard aggregation, computed live from MongoDB (no separate data warehouse or pre-aggregated tables).

---

## 2. Tech Stack

### 2.1 Core Runtime & Framework

| Technology | Purpose | Reason for Choosing | Advantages | Disadvantages | Alternatives Considered | Where Used | Status |
|---|---|---|---|---|---|---|---|
| **Node.js** | JavaScript runtime for the backend | Single language (JS) across frontend and backend, huge ecosystem, fast to build with | Non-blocking I/O suits an API that's mostly waiting on MongoDB/third-party HTTP calls; npm ecosystem covers every integration needed (Cloudinary, Razorpay SDKs etc.) | Single-threaded — CPU-heavy work (e.g. PDF/Excel generation) blocks the event loop; no built-in type safety | Python/Django, PHP/Laravel | Entire backend runtime | ✅ In production |
| **Express 5** (`^5.2.1`) | HTTP server / routing framework | Minimal, unopinionated, the de-facto standard for Node APIs; Express 5 specifically adopted for native async/await error propagation | Tiny surface area, huge middleware ecosystem, easy to reason about route-by-route | Express 5 changes some error-handling semantics vs. Express 4 (native async support) — code written without awareness of this could behave subtly differently than expected under older Express-4 tutorials/StackOverflow answers | Fastify, Koa, NestJS | `server.js` + all `routes/*.js` | ✅ In production |
| **CommonJS modules** (`"type": "commonjs"`) | Module system | Simplicity, no build step needed to run the server directly with `node server.js` | Works everywhere, no bundler required for the backend itself | No native ESM tree-shaking (irrelevant for a server, but worth knowing if this code is ever shared with frontend tooling) | ESM (`"type": "module"`) | Every backend file | ✅ In production |

### 2.2 Database

| Technology | Purpose | Reason for Choosing | Advantages | Disadvantages | Alternatives | Where Used | Status |
|---|---|---|---|---|---|---|---|
| **MongoDB Atlas** | Managed cloud document database | No self-hosted DB ops burden; generous free/low tier suits a small e-commerce store's early scale; document model fits variable e-commerce shapes (e.g. embedded order line items, embedded addresses) well | Zero-ops managed hosting, built-in backups, easy connection via a single URI, flexible schema for evolving fields (many fields were added incrementally over the project's life — see [§21](#21-development-timeline)) | No relational joins/foreign-key integrity — cross-collection links (`Order.phone` ↔ `Customer.phone`, `Order.items[].productId` ↔ `Product`) are enforced only in application code, not the database; risk of orphaned/inconsistent data if a bug skips a step | PostgreSQL (relational, would need an ORM + migrations), self-hosted MongoDB | Entire database layer | ✅ In production |
| **Mongoose** (`^8.24.1`) | ODM (Object-Document Mapper) for MongoDB | Schema definitions, validation, and a familiar model API on top of the native MongoDB driver | Declarative schemas (`required`, `enum`, `default`, embedded sub-schemas) catch obvious mistakes before they hit the DB; `.populate()` simplifies the one formal relationship in the system (`Customer.wishlist → Product`) | Schema is JS-side only — MongoDB itself will still accept documents that don't match if written outside Mongoose; adds a layer of abstraction over the native driver | Native MongoDB Node.js driver directly, Prisma (with Mongo support) | Every `models/*.js` file, every controller that touches data | ✅ In production |

### 2.3 Authentication & Security

| Technology | Purpose | Reason | Advantages | Disadvantages | Alternatives | Where Used | Status |
|---|---|---|---|---|---|---|---|
| **JWT** (`jsonwebtoken` `^9.0.3`) | Stateless auth tokens | No server-side session store needed; simple to verify on each request | Scales horizontally with zero shared session state; easy to embed role/permission-relevant claims (`id`, `email`, `role` for admins; `id`, `phone`, `role` for customers) | Tokens can't be revoked before expiry without an extra blocklist mechanism (not implemented); admin tokens are long-lived (7 days) with no refresh-token rotation | Session cookies + server-side store (Redis), OAuth-based identity provider | `services/jwt.js`, `middleware/authMiddleware.js`, `middleware/customerAuthMiddleware.js` | ✅ In production |
| **bcryptjs** (`^3.0.3`) | Password/OTP hashing | Standard, well-vetted password hashing; pure-JS (no native compile step, simpler deploys than `bcrypt`) | Safe against rainbow-table attacks, adjustable cost factor (12 used for admin passwords) | Slightly slower than native `bcrypt` (irrelevant at this scale) | `argon2`, native `bcrypt` | `controllers/authController.js` (admin login), `controllers/employeeController.js` (employee password hashing), `services/otp.js` (OTP hashing) | ✅ In production |
| **Static API key** (custom, `x-tally-bridge-key` header) | Authenticates the local Tally bridge (not a human user, no login flow) | JWT/session auth doesn't fit an unattended local script with no login UI; a long random shared secret compared server-side is simpler and sufficient for this trust boundary | Trivial to implement and reason about | No expiry/rotation mechanism; if leaked, must be manually rotated on both the backend env var and the bridge's `.env` | OAuth client-credentials flow, mTLS | `middleware/bridgeAuthMiddleware.js`, all `/tally/*` routes | ✅ In production |
| **CORS** (`cors` `^2.8.6`) | Cross-origin request handling | Storefront and admin panel are on different origins (Netlify) than the API (Render) | One-line setup (`app.use(cors())`) | **Currently configured wide open (all origins allowed, no allow-list)** — acceptable for a small store with two known frontends but not a security best practice at scale; see [§22](#22-problems-faced--debugging-handbook) and [§24](#24-future-roadmap) | Explicit origin allow-list via `cors({ origin: [...] })` | `server.js` (global middleware) | ⚠️ In production, unrestricted |

### 2.4 File Storage & Media

| Technology | Purpose | Reason | Advantages | Disadvantages | Alternatives | Where Used | Status |
|---|---|---|---|---|---|---|---|
| **Cloudinary** (`cloudinary` `^2.10.0`) | Image (and PDF/"raw") hosting for product photos and manually-uploaded Tally invoices | Free tier is generous for a small catalog; handles storage + CDN delivery + on-the-fly transforms without running our own file server | No server disk usage (important since Render's filesystem is ephemeral on redeploy); automatic CDN; simple SDK (`upload_stream`) | Vendor lock-in for image URLs baked into the DB (`Product.coverImage`, `galleryImages` store full Cloudinary URLs); **uploaded images are never deleted when a product is deleted or an image is replaced — orphaned assets accumulate over time** (see [§22](#22-problems-faced--debugging-handbook)) | AWS S3 + CloudFront, Uploadcare | `services/cloudinary.js`, `controllers/productController.js`, `controllers/orderController.js` (invoice upload) | ✅ In production |
| **streamifier** (`^0.1.1`) | Converts an in-memory Buffer (from `multer`) into a readable stream for Cloudinary's `upload_stream` API | Cloudinary's streaming upload API expects a stream, not a raw buffer | Tiny, does exactly one job | None relevant at this scale | Write buffer to a temp file first (unnecessary extra I/O) | `productController.js`, `orderController.js` | ✅ In production |
| **Multer** (`^2.2.0`) | Multipart/form-data parsing middleware (file uploads) | Standard Express file-upload middleware | Simple `.fields()`/`.single()` API, in-memory storage avoids writing to Render's ephemeral disk | In-memory storage means large files consume server RAM during the request — acceptable for product photos/PDFs at this scale, would need reconsideration for large-file use cases | `busboy` directly, `formidable` | `routes/productRoutes.js` (cover + gallery images), `routes/orderRoutes.js` (invoice PDF upload) | ✅ In production |

### 2.5 Payments & Shipping

| Technology | Purpose | Reason | Advantages | Disadvantages | Alternatives | Where Used | Status |
|---|---|---|---|---|---|---|---|
| **Razorpay** (`razorpay` `^2.9.6`) | Payment gateway | Leading India-focused payment gateway with strong UPI/card/netbanking coverage, needed for an India-based storefront | Well-documented SDK, Checkout widget handles most of the payment UI for free, signature-based verification is straightforward to implement server-side | Currently only order-creation + signature verification is implemented — **no webhook listener** (see [§10](#10-payment-system) and [§24](#24-future-roadmap)), meaning payment status only updates when the customer's browser successfully calls back to `verify-payment`; a payment that succeeds but whose client-side callback never fires (closed tab, network drop) will leave the order stuck at `Pending` even though Razorpay actually collected the money | Stripe (less India-payment-method coverage), PayU, Cashfree | `controllers/paymentController.js`, storefront checkout flow | ✅ In production (partial — no webhook) |
| **Delhivery** | Courier / logistics partner — pincode serviceability, shipment creation, tracking, label printing, cancellation | Established pan-India courier with a usable public API | Direct API access for the full shipment lifecycle | **No dedicated SDK — all calls are raw `axios` requests hand-built inline in `shipmentController.js`** (the intended wrapper file `services/delhivery.js` exists but is empty — see [§22](#22-problems-faced--debugging-handbook)); API responses are stored as raw JSON blobs (`Order.delhiveryResponse`) rather than normalized | Shiprocket, direct courier APIs (BlueDart, DTDC) | `controllers/shipmentController.js`, `services/shipmentBuilder.js`, `services/serviceability.js` | ✅ In production (with known code-quality gaps) |

### 2.6 Email

| Technology | Purpose | Reason | Advantages | Disadvantages | Alternatives | Where Used | Status |
|---|---|---|---|---|---|---|---|
| **Brevo** (formerly Sendinblue) transactional email HTTP API | Sending OTPs, order confirmations, shipment notifications, status updates | Free tier transactional email with a simple REST API (no SMTP relay setup headaches) | Simple `axios.post` integration (`services/emailService.js`), reliable deliverability, supports base64 attachments (used for invoice PDFs) | API-key based (`BREVO_API_KEY`) — if leaked, needs manual rotation; no bounce/complaint webhook handling implemented | SendGrid, Amazon SES, Postmark | `services/emailService.js`, called from `orderController`, `paymentController`, `shipmentController`, `customerAuthController` | ✅ In production |
| **Nodemailer** (`^9.0.3`) | Node.js SMTP email library | Declared as a dependency, and `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` env vars exist | — | **Not actually used anywhere in the codebase.** All real email sending goes through Brevo's HTTP API in `services/emailService.js`, not through SMTP/Nodemailer. This is dead weight in `package.json` and an unused set of env vars — likely an earlier approach that was replaced by the Brevo HTTP integration without removing the leftover dependency/config. | — | — (installed but unused) | ⚠️ Declared, unused |

### 2.7 Documents & Reporting

| Technology | Purpose | Reason | Advantages | Disadvantages | Alternatives | Where Used | Status |
|---|---|---|---|---|---|---|---|
| **PDFKit** (`pdfkit` `^0.19.1`) | Programmatic PDF generation for invoices | Pure-JS PDF generation, no external binary/headless-browser dependency (unlike Puppeteer-based PDF generation) | Lightweight, fast, full control over layout via drawing primitives | Layout code is imperative (manual x/y positioning) rather than HTML/CSS-based — harder to restyle than a templated approach | Puppeteer + HTML/CSS → PDF, `html-pdf` | `services/invoicePdf.js`, used by `invoiceController.js` (on-demand download) and `paymentController.js` (emailed attachment) | ✅ In production |
| **ExcelJS** (`exceljs` `^4.4.0`) | Generating `.xlsx` exports for Orders, Products, Customers, and the combined Report | Full-featured, actively maintained Excel-writing library with streaming output support | Styling support (used for branded header rows), multi-sheet workbooks, can embed images (chart) | Larger dependency than a CSV-only approach; in-memory workbook construction (fine at this data scale) | `csv-writer` (CSV only, less rich), `xlsx` (SheetJS) | `services/excelReport.js`, used by `reportController`, `orderController`, `productController`, `adminCustomerController` | ✅ In production |
| **QuickChart.js** (`quickchart-js` `^4.0.0`) | Generates a rendered chart image (via the hosted QuickChart.io API) to embed in the Excel report's Overview sheet | Avoids needing a native canvas/chart-rendering dependency on the server (e.g. `chartjs-node-canvas`, which requires native build tooling that's awkward on some hosts) | No native build step, works reliably on Render | Depends on an external third-party hosted service being available at export time; chart data leaves the server and goes to a third party (low sensitivity here — it's just a revenue trend line, but worth being aware of) | `chartjs-node-canvas` (native canvas rendering, self-hosted) | `services/excelReport.js` (`addChartImage`) | ✅ In production |

### 2.8 Utilities

| Technology | Purpose | Reason | Where Used | Status |
|---|---|---|---|---|
| **dotenv** (`^17.4.2`) | Loads `.env` into `process.env` for local development | Standard Node convention | `server.js` (first line) | ✅ In production (Render injects env vars directly in production; dotenv is primarily for local dev) |
| **axios** (`^1.18.1`) | HTTP client for all outbound third-party calls | Promise-based, simple API, used consistently across Delhivery, Brevo, and (in the Tally bridge) Tally's local XML server | `shipmentController.js`, `services/emailService.js`, `services/serviceability.js`, `server.js` | ✅ In production |
| **qs** (`^6.15.3`) | Query-string / form encoding (Delhivery's `create.json` endpoint expects `application/x-www-form-urlencoded` with a specific nested structure) | Needed because Delhivery's shipment-create API doesn't accept plain JSON | `shipmentController.js` | ✅ In production |

### 2.9 Tooling & Infrastructure (not npm packages)

| Tool | Purpose | Reason for Choosing | Where Used | Status |
|---|---|---|---|---|
| **Render** | Backend hosting (PaaS) | Simple git-push-to-deploy workflow, free/low-cost tier suitable for early-stage traffic, managed HTTPS | Hosts `silkwaves-backend` as a Web Service | ✅ In production — **Note:** on the free tier, the service spins down after inactivity and takes ~30–50 seconds to "cold start" on the next request; this was observed directly and is a real operational characteristic to plan around (e.g., the Tally bridge's first poll after idle time may need a retry). |
| **Netlify** | Storefront + Admin panel hosting | Zero-config static/SPA hosting with git-based auto-deploy, generous free tier | Hosts `silkwaves` and `silkwaves-admin` | ✅ In production |
| **GitHub** | Source control, three separate repositories (`silkwaves`, `silkwaves-admin`, `silkwaves-backend`) plus a fourth local-only repo (`silkwaves-tally-bridge`, never pushed to a remote) | Standard git hosting, integrates directly with Render/Netlify's auto-deploy hooks | All four codebases | ✅ In production for the first three; `silkwaves-tally-bridge` is git-tracked locally only (deliberately — it only ever needs to run on the shop's own PC) |
| **MongoDB Atlas dashboard** | Database administration | Comes with the managed MongoDB Atlas service | Direct DB inspection/administration outside the app | ✅ In use |
| **Render / Cloudinary / Brevo / Razorpay dashboards** | Per-service admin consoles | Each service's own control plane | Environment variable management (Render), asset browsing (Cloudinary), email logs (Brevo), payment/refund management (Razorpay) | ✅ In use |

---

## 3. System Architecture

### 3.1 Component Communication Overview

```
Customer's Browser                          Admin's Browser
        │                                          │
        │ HTTPS                                    │ HTTPS
        ▼                                          ▼
┌───────────────┐                         ┌────────────────┐
│  silkwaves     │                         │ silkwaves-admin │
│  (storefront)  │                         │ (CMS)           │
└───────┬────────┘                         └────────┬───────┘
        │  fetch() JSON, no auth for public routes   │  fetch() JSON + Bearer JWT
        │  fetch() JSON + Bearer JWT for /customer/*  │
        └──────────────────┬───────────────────────────┘
                            ▼
                 ┌─────────────────────┐
                 │  silkwaves-backend  │  (single Express app, Render)
                 └──────────┬──────────┘
        ┌───────────────────┼────────────────────────────────┐
        ▼                   ▼                                ▼
┌──────────────┐   ┌─────────────────┐              ┌──────────────────┐
│ MongoDB Atlas │   │ Third-party APIs │              │ silkwaves-tally- │
│ (all app data)│   │ Cloudinary       │              │ bridge (polls    │
└──────────────┘   │ Razorpay         │              │ this backend via │
                    │ Delhivery        │              │ /tally/* routes, │
                    │ Brevo            │              │ x-tally-bridge-  │
                    └─────────────────┘              │ key header)      │
                                                       └────────┬─────────┘
                                                                │ local HTTP
                                                                │ (XML import)
                                                                ▼
                                                       ┌──────────────────┐
                                                       │  Tally Prime     │
                                                       │  (local PC,      │
                                                       │  localhost:9000) │
                                                       └──────────────────┘
```

### 3.2 Request Lifecycle — Example: Customer Checkout → Payment

```
1. Customer clicks "Pay Now"
       │
       ▼
2. Storefront → POST /orders (public)
       │  Body: { customer, email, phone, address, city, state, pincode, items, amount, notes }
       ▼
3. orderController.createOrder
       │  - Generates id = "SW" + Date.now()
       │  - Sets payment="Pending", status="Placed"
       │  - Saves Order document
       │  - Returns 201 + order
       ▼
4. Storefront → POST /create-payment
       │  Body: { amount }
       ▼
5. paymentController.createPayment
       │  - razorpay.orders.create({ amount: amount*100, currency:"INR" })
       │  - Returns Razorpay order object (no DB write)
       ▼
6. Razorpay Checkout widget opens client-side, customer pays
       │
       ▼
7. Razorpay callback fires in the browser with:
       razorpay_order_id, razorpay_payment_id, razorpay_signature
       │
       ▼
8. Storefront → POST /verify-payment
       │  Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId }
       ▼
9. paymentController.verifyPayment
       │  - Verifies HMAC-SHA256 signature against RAZORPAY_KEY_SECRET
       │  - Loads Order by id=orderId
       │  - For each line item: loads Product, checks stock, decrements stock, saves Product
       │  - Sets order.payment="Paid", saves Order
       │  - Responds 200 to the browser
       │  - (After responding) generates invoice PDF + emails order confirmation via Brevo
       ▼
10. Order now visible to admin (GET /orders), to the customer (GET /customer/orders),
    and will be picked up by the Tally bridge on its next poll (GET /tally/sync/orders)
    since payment="Paid" and tallyInvoiceSynced=false.
```

> **⚠️ Known gap:** there is no Razorpay webhook. If the customer's browser never successfully calls `POST /verify-payment` (closed tab, crashed browser, network failure after Razorpay already collected payment), the Order stays `Pending` forever even though money was actually captured. See [§10.6](#106-known-gaps) and [§24](#24-future-roadmap).

### 3.3 Request Lifecycle — Example: Tally Bridge Sync

```
Every 15 seconds (configurable via POLL_INTERVAL_MS), on the shop's local PC:

1. Bridge → GET /tally/sync/products   (header: x-tally-bridge-key)
2. Backend returns products where !tallyStockItemSynced || updatedAt > tallySyncedAt
3. Bridge builds a Tally "Stock Item" XML per product (Stock Group = product.tallyGroup)
4. Bridge → POST http://localhost:9000  (Tally's local XML/HTTP import endpoint)
5. Bridge → POST /tally/sync/products/:id/ack  { success: true }
6. Backend sets tallyStockItemSynced=true, tallySyncedAt=now (with timestamps:false,
   to avoid the ack itself re-triggering "pending" state — see §22.12)

7. Bridge → GET /tally/sync/orders     (Paid orders where tallyInvoiceSynced=false)
8. For each order without an existing Tally ledger:
     Bridge builds a "Ledger" XML (customer name, address, state, pincode)
     Bridge → POST http://localhost:9000
     Bridge → POST /tally/customer-ledger/:phone  { tallyLedgerName }
9. Bridge builds a "Sales Voucher" XML (line items, CGST+SGST or IGST depending on
   whether the order's state matches the company's home state, exact-paisa tax split)
10. Bridge → POST http://localhost:9000
11. Bridge → GET (Day Book export) to look up the real Tally voucher number
    by matching the voucher's REFERENCE field to the order id
12. Bridge → POST /tally/sync/orders/:id/ack  { success: true, tallyVoucherNumber }
13. Backend sets tallyInvoiceSynced=true, tallyVoucherNumber, tallySyncedAt
```

See [§20](#20-tally-integration-case-study) for the full case study of how this was built.

---

## 4. Project Structure

### 4.1 Backend Folder Tree

```
silkwaves-backend/
├── server.js                    # App entry point — Express setup, route mounting, DB connect + listen
├── package.json
├── .env                         # Local secrets (⚠️ see §22 — this file is tracked in git, a known issue)
├── config/
│   └── db.js                    # Mongoose connection (connectDB())
├── models/
│   ├── Admin.js                 # Admin/employee accounts + permissions
│   ├── Customer.js               # Storefront customer accounts, addresses, wishlist
│   ├── Order.js                  # Orders, embedded line items, payment/shipment/Tally state
│   ├── Product.js                # Catalog products
│   └── Setting.js                # Singleton company/warehouse settings document
├── controllers/
│   ├── authController.js         # Admin login
│   ├── customerAuthController.js # Customer OTP login, profile, addresses, wishlist
│   ├── productController.js      # Product CRUD + image upload + export
│   ├── orderController.js        # Order CRUD, status/payment updates, invoice upload, export
│   ├── paymentController.js      # Razorpay order creation + payment verification
│   ├── shipmentController.js     # Delhivery integration (waybill, create/track/cancel shipment)
│   ├── invoiceController.js      # On-demand PDF invoice generation
│   ├── dashboardController.js    # Dashboard analytics aggregation
│   ├── reportController.js       # Report data + full Excel export
│   ├── adminCustomerController.js # Admin customer list/detail/export
│   ├── employeeController.js     # Employee account management (admin-only)
│   ├── settingsController.js     # Company/warehouse settings get/save
│   └── tallyController.js        # Tally bridge sync endpoints
├── routes/
│   ├── authRoutes.js
│   ├── customerRoutes.js
│   ├── productRoutes.js
│   ├── orderRoutes.js
│   ├── paymentRoutes.js
│   ├── shipmentRoutes.js
│   ├── invoiceRoutes.js
│   ├── dashboardRoutes.js
│   ├── reportRoutes.js
│   ├── adminCustomerRoutes.js
│   ├── employeeRoutes.js
│   ├── settingsRoutes.js
│   ├── emailRoutes.js            # Contains a debug/test route only
│   └── tallyRoutes.js
├── middleware/
│   ├── authMiddleware.js         # Admin/employee JWT verification → req.admin
│   ├── customerAuthMiddleware.js # Customer JWT verification → req.customer
│   ├── permissionMiddleware.js   # requirePermission(section, level), requireAdminRole
│   └── bridgeAuthMiddleware.js   # Static API-key check for the Tally bridge
├── services/
│   ├── cloudinary.js             # Cloudinary SDK configuration/export
│   ├── emailService.js           # Brevo transactional email wrapper
│   ├── invoicePdf.js             # PDFKit invoice generation
│   ├── excelReport.js            # ExcelJS workbook builder + QuickChart embedding
│   ├── shipmentBuilder.js        # Order → Delhivery payload transform
│   ├── serviceability.js         # Delhivery pincode-serviceability check
│   ├── otp.js                    # OTP generation/hashing
│   ├── jwt.js                    # JWT signing helpers (admin + customer tokens)
│   └── delhivery.js              # ⚠️ Empty file — see §22, all Delhivery calls live inline in shipmentController.js instead
├── emailTemplates/
│   ├── layout.js                 # Shared branded HTML wrapper
│   ├── otpEmail.js
│   ├── orderConfirmation.js
│   ├── shipmentCreated.js
│   ├── orderStatusUpdate.js
│   ├── paymentSuccess.js         # ⚠️ Empty, unused — Planned but not implemented
│   ├── delivered.js              # ⚠️ Empty, unused — Planned but not implemented
│   └── invoiceEmail.js           # ⚠️ Empty, unused — Planned but not implemented
└── docs/
    └── ENGINEERING_DOCUMENTATION.md   # This document
```

There is **no `utils/` or `constants/` directory** in this project — confirmed by direct filesystem search. Enum values (order status, payment status, admin permission sections) are defined inline in their respective model files rather than in a shared constants module. See [§22](#22-problems-faced--debugging-handbook) for the implications of this.

There is **no `uploads/` directory** — file uploads never touch local disk; they're streamed in-memory (via Multer) straight to Cloudinary.

### 4.2 File Responsibilities — Key Files

| File | Responsibilities | Depends On |
|---|---|---|
| `server.js` | Loads env, configures Express (CORS, JSON/urlencoded body parsing), mounts all 14 route modules at their respective paths, connects to MongoDB, starts the HTTP listener | `config/db.js`, every `routes/*.js` |
| `config/db.js` | Single `connectDB()` async function wrapping `mongoose.connect(process.env.MONGODB_URI)` | `mongoose`, `MONGODB_URI` env var |
| `middleware/authMiddleware.js` | Verifies admin/employee JWT, loads the `Admin` doc, sets `req.admin` | `jsonwebtoken`, `models/Admin.js`, `JWT_SECRET` |
| `middleware/permissionMiddleware.js` | `requirePermission(section, level)` factory + `requireAdminRole` — gate routes by the `Admin.permissions` object | Must run after `authMiddleware` (reads `req.admin`) |
| `controllers/paymentController.js` | Razorpay order creation, signature verification, stock decrement, order-confirmation email trigger | `razorpay` SDK, `models/Order.js`, `models/Product.js`, `services/invoicePdf.js`, `services/emailService.js` |
| `controllers/tallyController.js` | Exposes the sync surface the local bridge polls; never talks to Tally directly itself (that's the bridge's job) | `models/Product.js`, `models/Order.js`, `models/Customer.js` |

---

## 5. Database Documentation

Database: **MongoDB Atlas**, accessed via a single connection string (`MONGODB_URI`). Five collections, one embedded sub-document type each in `Customer` (addresses) and `Order` (line items).

### 5.1 `admins` collection (model: `Admin`)

**Purpose:** Staff accounts — both the full-access owner/admin and permission-scoped employees.

**Schema:**

| Field | Type | Constraints |
|---|---|---|
| `name` | String | required, trimmed |
| `email` | String | required, unique, lowercase, trimmed |
| `password` | String | required (bcrypt hash, cost 12) |
| `role` | String | enum `["admin", "employee"]`, default `"admin"` |
| `permissions` | Object | nested object with 7 keys — see below |
| `createdAt` / `updatedAt` | Date | via `timestamps: true` |

**`permissions` structure** — each of these 7 keys holds `{ view: Boolean, edit: Boolean }` (both default `false`):

```
dashboard, orders, fulfillment, products, customers, settings, reports
```

> **Note:** `role: "admin"` bypasses all granular permission checks entirely (`permissionMiddleware.js` short-circuits to "allowed" for any admin role, regardless of what's actually stored in `permissions`). Only `role: "employee"` accounts are actually gated by the `permissions` object.

**Example document:**
```json
{
  "_id": "665f1a2b3c4d5e6f7a8b9c0d",
  "name": "Priya Sharma",
  "email": "priya@example.com",
  "password": "$2a$12$...",
  "role": "employee",
  "permissions": {
    "dashboard": { "view": true, "edit": false },
    "orders": { "view": true, "edit": true },
    "fulfillment": { "view": true, "edit": true },
    "products": { "view": false, "edit": false },
    "customers": { "view": true, "edit": false },
    "settings": { "view": false, "edit": false },
    "reports": { "view": false, "edit": false }
  },
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-06-01T10:00:00.000Z"
}
```

**Indexes:** implicit unique index on `email` only.

---

### 5.2 `customers` collection (model: `Customer`)

**Purpose:** Storefront customer accounts, identified and logged-in via phone number OTP.

**Schema:**

| Field | Type | Constraints |
|---|---|---|
| `phone` | String | required, **unique** — primary identity/login key |
| `email` | String | required, lowercase, trimmed (not unique) |
| `name` | String | default `""` |
| `otpHash` | String | default `null` |
| `otpExpiresAt` | Date | default `null` |
| `otpAttempts` | Number | default `0` |
| `verified` | Boolean | default `false` |
| `addresses` | Array of embedded `addressSchema` | default `[]` |
| `wishlist` | Array of ObjectId (`ref: "Product"`) | default `[]` — **the only formal Mongoose relationship in the schema** |
| `tallyLedgerName` | String | default `null` — set once the Tally bridge creates this customer's ledger |
| `createdAt` / `updatedAt` | Date | via `timestamps: true` |

**Embedded `addressSchema`:**

| Field | Type | Constraints |
|---|---|---|
| `label` | String | default `"Home"` |
| `name` | String | required |
| `phone` | String | required |
| `address` | String | required |
| `city` | String | required |
| `state` | String | required |
| `pincode` | String | required |
| `isDefault` | Boolean | default `false` |

**Example document:**
```json
{
  "_id": "665f...",
  "phone": "8310283871",
  "email": "yogeshkhatriwork@gmail.com",
  "name": "Yogesh D Khatri",
  "verified": true,
  "addresses": [
    {
      "_id": "665f...",
      "label": "Home",
      "name": "Yogesh D Khatri",
      "phone": "8310283871",
      "address": "#4 2nd floor 28th cross cubbonpete main road",
      "city": "Bangalore",
      "state": "Karnataka",
      "pincode": "560002",
      "isDefault": true
    }
  ],
  "wishlist": ["665f...", "665f..."],
  "tallyLedgerName": "Yogesh D Khatri",
  "createdAt": "2026-06-15T08:00:00.000Z",
  "updatedAt": "2026-07-30T06:38:13.000Z"
}
```

**Business logic notes:**
- A `Customer` document can also be **upserted by the Tally bridge** (`POST /tally/customer-ledger/:phone`) for a guest checkout that never signed up — in that case `email` is set to a placeholder `${phone}@guest.silkwaves`.
- Pincode is validated against Delhivery's serviceability API before an address can be saved (`services/serviceability.js`).

---

### 5.3 `orders` collection (model: `Order`)

**Purpose:** Every order placed, from creation through payment, fulfillment, and (eventually) Tally sync.

**Schema:**

| Field | Type | Constraints |
|---|---|---|
| `id` | String | unique — human-facing order number, format `"SW" + Date.now()` |
| `customer` | String | required — customer's **name** (not a reference) |
| `email` | String | default `""` |
| `phone` | String | required — logically links to `Customer.phone` |
| `address`, `city`, `state`, `pincode` | String | all required |
| `amount` | Number | required |
| `payment` | String | enum `["Pending","Paid","Failed","Refunded"]`, default `"Pending"` |
| `paymentId` | String | default `null` — Razorpay payment ID |
| `paymentStatus` | String | default `"Pending"`, **no enum** — distinct, overlapping field from `payment` above (see [§22](#22-problems-faced--debugging-handbook)) |
| `paymentVerified` | Boolean | default `false` |
| `razorpayOrderId` | String | default `null` |
| `orderId` | String | default `null` — **a second, separate ID field distinct from the top-level `id`**, purpose not fully disambiguated in code (flagged for future cleanup) |
| `status` | String | enum `["Placed","Confirmed","Packed","Shipped","Delivered","Cancelled","Returned"]`, default `"Placed"` |
| `items` | Array of embedded `itemSchema` | fulfillment/order line items |
| `awb` | String | default `null` — Delhivery Air Waybill number |
| `shipmentStatus` | String | default `"Not Created"`, no enum |
| `trackingId`, `trackingUrl` | String | default `null` |
| `courier` | String | default `"Delhivery"` |
| `delhiveryResponse` | Object | default `null` — raw API response blob stored as-is |
| `notes` | String | default `""` |
| `tallyInvoiceSynced` | Boolean | default `false` |
| `tallyVoucherNumber` | String | default `null` |
| `tallySyncedAt` | Date | default `null` |
| `invoiceFileUrl` | String | default `null` — Cloudinary URL of a manually-uploaded Tally invoice PDF |
| `createdAt` / `updatedAt` | Date | via `timestamps: true` |

**Embedded `itemSchema`:**

| Field | Type |
|---|---|
| `productId` | String (plain — not ObjectId, logical link only) |
| `title` | String (denormalized snapshot of `Product.title` at order time) |
| `price` | Number (snapshot) |
| `quantity` | Number |
| `coverImage` | String (snapshot) |

**Example document:**
```json
{
  "_id": "665f...",
  "id": "SW1785355916951",
  "customer": "Yogesh D Khatri",
  "email": "yogeshkhatriwork@gmail.com",
  "phone": "8310283871",
  "address": "#4 2nd floor 28th cross cubbonpete main road",
  "city": "Bangalore",
  "state": "Karnataka",
  "pincode": "560002",
  "amount": 500000,
  "payment": "Paid",
  "paymentId": "pay_THoJxBKNCkheRB",
  "status": "Placed",
  "items": [
    { "productId": "665f...", "title": "database mongo check settings", "price": 100000, "quantity": 5 }
  ],
  "awb": null,
  "shipmentStatus": "Not Created",
  "courier": "Delhivery",
  "tallyInvoiceSynced": true,
  "tallyVoucherNumber": "76/SALE-26-27",
  "invoiceFileUrl": null,
  "createdAt": "2026-07-30T06:11:56.959Z"
}
```

---

### 5.4 `products` collection (model: `Product`)

**Purpose:** The saree catalog.

**Schema:**

| Field | Type | Constraints |
|---|---|---|
| `title` | String | required |
| `slug` | String | required, unique — URL-facing identifier, auto-generated from `title` |
| `price` | Number | required |
| `compareAtPrice` | Number | default `null` — "was" price for a sale badge; a product is considered "on sale" purely by `compareAtPrice > price` |
| `stock` | Number | default `0` |
| `category` | String | default `""` — **plain free text, no enum, no backing constants list** (currently used as `"Type 1 Sarees"` / `"Type 2 Sarees"` / `"Type 3 Sarees"` by convention in the admin UI) |
| `description` | String | default `""` |
| `coverImage` | String | default `""` — Cloudinary URL |
| `galleryImages` | Array of String | default `[]` — Cloudinary URLs |
| `tallyGroup` | String | default `null` — admin-selected, one of the real Tally Stock Group names (e.g. `"PURE SILK SAREE"`) |
| `tallyStockItemSynced` | Boolean | default `false` |
| `tallySyncedAt` | Date | default `null` |
| `createdAt` / `updatedAt` | Date | via `timestamps: true` |

**Example document:**
```json
{
  "_id": "665f...",
  "title": "Kanjivaram Silk Saree - Maroon",
  "slug": "kanjivaram-silk-saree-maroon",
  "price": 4599,
  "compareAtPrice": 6999,
  "stock": 20,
  "category": "Type 1 Sarees",
  "tallyGroup": "PURE SILK SAREE",
  "coverImage": "https://res.cloudinary.com/.../products/xyz.jpg",
  "galleryImages": [],
  "tallyStockItemSynced": true,
  "tallySyncedAt": "2026-07-30T06:38:13.000Z"
}
```

---

### 5.5 `settings` collection (model: `Setting`, note singular filename)

**Purpose:** A **singleton** document holding company/warehouse info used to build shipment payloads. Nothing in the schema itself enforces there being only one document — application code is responsible for that convention (`settingsController.getSettings` creates a default doc if none exists, and presumably always reuses the same one thereafter).

**Schema:**

| Field | Type | Default |
|---|---|---|
| `companyName` | String | `""` |
| `gstNumber` | String | `""` |
| `email` | String | `""` |
| `phone` | String | `""` |
| `warehouseName` | String | `""` |
| `address`, `city`, `state`, `pincode` | String | `""` |
| `country` | String | `"India"` |
| `packageWeight` | String | `"0.5"` — ⚠️ stored as a **String**, not a Number, despite being used numerically in shipment payloads |
| `packageLength` | String | `"30"` |
| `packageBreadth` | String | `"25"` |
| `packageHeight` | String | `"8"` |

**Note:** this is the only model **without** `{ timestamps: true }`.

---

### 5.6 Relationship Diagram

```
┌───────────┐  wishlist (ObjectId ref, formal)  ┌───────────┐
│ Customer  │ ────────────────────────────────▶ │ Product   │
└─────┬─────┘                                    └─────▲─────┘
      │ phone (logical, string match only)              │ productId (logical, string only)
      ▼                                                  │
┌───────────┐  items[] (embedded, denormalized) ─────────┘
│ Order     │
└─────┬─────┘
      │ tallyGroup / tallyLedgerName / tallyVoucherNumber
      ▼  (all logical links to an EXTERNAL system, not a local collection)
┌────────────────────┐
│ Tally Prime         │  (external, not in MongoDB)
│ Stock Items, Ledgers, Sales Vouchers │
└────────────────────┘

┌───────────┐
│ Setting   │  (singleton, no relationships — read by shipmentBuilder.js)
└───────────┘

┌───────────┐
│ Admin     │  (no relationships to other collections)
└───────────┘
```

**Only one formal (`ref`-based) relationship exists in the entire schema:** `Customer.wishlist → Product`. Every other cross-collection link (`Order.phone` ↔ `Customer.phone`, `Order.items[].productId` ↔ `Product`) is a plain string matched only in application code — there is no database-level referential integrity. This is a deliberate document-database tradeoff, but it means a bug that writes an inconsistent `phone` or `productId` will not be caught by MongoDB itself.

---

## 6. Authentication System

There are **three distinct auth schemes** in this backend, each for a different class of caller.

### 6.1 Admin / Employee Authentication (JWT)

```
┌────────┐                    ┌─────────┐                    ┌──────────┐
│ Client │                    │ Backend │                    │ MongoDB  │
└───┬────┘                    └────┬────┘                    └────┬─────┘
    │  POST /auth/login             │                              │
    │  { email, password }          │                              │
    │───────────────────────────────▶                              │
    │                                │  Admin.findOne({email})      │
    │                                │──────────────────────────────▶
    │                                │◀──────────────────────────────
    │                                │  bcrypt.compare(password,hash)│
    │                                │  generateToken(admin) (JWT)   │
    │◀───────────────────────────────│                              │
    │  { success, token, admin }     │                              │
    │                                │                              │
    │  (subsequent requests)         │                              │
    │  Authorization: Bearer <jwt>   │                              │
    │───────────────────────────────▶│                              │
    │                                │  authMiddleware:              │
    │                                │   jwt.verify(token, SECRET)   │
    │                                │   Admin.findById(decoded.id)  │
    │                                │   req.admin = admin           │
    │                                │  permissionMiddleware:        │
    │                                │   requirePermission(section,  │
    │                                │     level) checks             │
    │                                │     req.admin.permissions     │
    │                                │   (bypassed entirely if       │
    │                                │     req.admin.role==="admin") │
```

- **Token payload:** `{ id, email, role }`.
- **Expiry:** 7 days (`services/jwt.js`).
- **No refresh token / rotation mechanism.**
- **Role bypass:** `role: "admin"` always passes every `requirePermission` check regardless of the `permissions` object's actual contents; only `role: "employee"` is genuinely gated per-section.

### 6.2 Customer Authentication (Phone OTP + JWT)

```
1. POST /customer/auth/request-otp   { phone, email }
     - Find-or-create Customer by phone (email required on first signup)
     - Generate 6-digit OTP, bcrypt-hash it, store otpHash + otpExpiresAt (now+5min)
     - Email the OTP via Brevo (otpEmail.js template) — NOT SMS (see §22.12)
     - Response: { success, message, emailHint: "ab***@domain.com" }

2. POST /customer/auth/verify-otp    { phone, otp }
     - Reject if no OTP requested, expired, or otpAttempts >= 5 (429)
     - bcrypt.compare(otp, otpHash); increment otpAttempts on mismatch
     - On success: verified=true, clear otpHash/otpExpiresAt/otpAttempts
     - Issue JWT: generateCustomerToken(customer) → { id, phone, role:"customer" }, 30-day expiry
     - Response: { success, token, customer }

3. Subsequent requests: Authorization: Bearer <jwt>
     customerAuthMiddleware verifies the token AND checks decoded.role==="customer"
     (rejects an admin token used against a customer-only route)
     Customer.findById(decoded.id) → req.customer
```

### 6.3 Tally Bridge Authentication (Static API Key)

```
Bridge → any /tally/* route
  Header: x-tally-bridge-key: <TALLY_BRIDGE_API_KEY>

bridgeAuthMiddleware:
  if (key !== process.env.TALLY_BRIDGE_API_KEY) → 401
  else → next()
```

No JWT, no expiry, no user identity — this is a machine-to-machine shared secret, appropriate for an unattended local script with no human login flow.

### 6.4 Security Notes

- Passwords hashed with bcrypt cost factor 12 (admin/employee accounts).
- OTPs hashed with bcrypt before storage (never stored in plaintext).
- **`authMiddleware.js` logs the full Authorization header, the raw extracted token, and the decoded JWT payload to the console on every single admin-authenticated request** — this is a credential-logging concern that should be removed before any serious production hardening pass (see [§22](#22-problems-faced--debugging-handbook)).
- CORS is currently open to all origins (see [§2.3](#23-authentication--security)).

---

## 7. API Documentation

All endpoints below were extracted directly from the live route files. Base URL in production: `https://silkwaves-api.onrender.com`.

### 7.1 Auth Routes — mounted at `/auth`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | none | Admin/employee login. Body: `{email, password}`. Returns `{success, token, admin}`. |
| GET | `/auth/me` | Bearer (admin) | Returns the currently authenticated admin/employee doc. |

### 7.2 Customer Routes — mounted at `/customer`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/customer/auth/request-otp` | none | Request a login OTP (emailed). |
| POST | `/customer/auth/verify-otp` | none | Verify OTP, issue customer JWT. |
| GET | `/customer/auth/me` | Bearer (customer) | Get current customer profile. |
| GET | `/customer/me` | Bearer (customer) | Duplicate of the above. |
| PATCH | `/customer/me` | Bearer (customer) | Update `name` only. |
| GET | `/customer/addresses` | Bearer (customer) | List saved addresses. |
| POST | `/customer/addresses` | Bearer (customer) | Add an address (pincode validated against Delhivery serviceability). |
| PUT | `/customer/addresses/:addressId` | Bearer (customer) | Update an address. |
| DELETE | `/customer/addresses/:addressId` | Bearer (customer) | Delete an address. |
| GET | `/customer/orders` | Bearer (customer) | List the logged-in customer's own orders. |
| GET | `/customer/wishlist` | Bearer (customer) | List wishlisted products (populated). |
| POST | `/customer/wishlist` | Bearer (customer) | Add a product to the wishlist. Body: `{productId}`. |
| DELETE | `/customer/wishlist/:productId` | Bearer (customer) | Remove a product from the wishlist. |

### 7.3 Product Routes — mounted at `/products`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/products/export` | Bearer (admin-only) | Excel export of all products/stock. |
| GET | `/products` | none | List all products (public catalog). |
| POST | `/products` | Bearer + `products.edit` | Create a product (multipart: cover + up to 4 gallery images). |
| PUT | `/products/:id` | Bearer + `products.edit` | Update a product. |
| DELETE | `/products/:id` | Bearer + `products.edit` | Delete a product. |

### 7.4 Order Routes — mounted at `/orders`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/orders` | none | Create an order (customer checkout). |
| GET | `/orders` | Bearer + `orders.view` | List orders, filterable by `status`, `payment`, `customer` (regex), `phone`. |
| GET | `/orders/export` | Bearer (admin-only) | Excel export of orders. |
| GET | `/orders/:id` | Bearer + `orders.view` | Single order by business `id`. |
| PATCH | `/orders/:id/status` | Bearer + `orders.edit` | Update `status` field. |
| POST | `/orders/:id/notify-status` | Bearer + `orders.edit` | Send a status-update email to the customer. |
| PATCH | `/orders/:id/payment` | Bearer + `orders.edit` | Update `payment` field. |
| POST | `/orders/:id/invoice` | Bearer + `orders.edit` | Upload a manually-generated Tally invoice PDF (multipart, field `voucherFile`) → Cloudinary → `invoiceFileUrl`. |
| DELETE | `/orders/:id` | Bearer + `orders.edit` | Delete an order. |

### 7.5 Payment Routes — mounted at root (no prefix)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/create-payment` | none | Create a Razorpay order. Body: `{amount}` (rupees; converted to paise internally). |
| POST | `/verify-payment` | none | Verify Razorpay signature, mark order Paid, decrement stock, email confirmation. |

### 7.6 Shipment Routes — mounted at root (no prefix)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/fetch-waybill` | Bearer + `fulfillment.view` | Fetch a fresh Delhivery waybill/AWB number. |
| GET | `/check-serviceability` | Bearer + `fulfillment.view` | Check if a pincode is serviceable. |
| GET | `/public/check-serviceability` | none | Same, public (used at storefront checkout). |
| POST | `/create-shipment/:orderId` | Bearer + `fulfillment.edit` | Create a Delhivery shipment for an order. |
| GET | `/shipping-label/:orderId` | Bearer + `fulfillment.view` | Fetch the packing slip/label. |
| GET | `/track-shipment/:orderId` | Bearer + `fulfillment.view` | Fetch live tracking status. |
| GET | `/shipment/:orderId` | Bearer + `fulfillment.view` | Get stored shipment fields (no external call). |
| POST | `/cancel-shipment/:orderId` | Bearer + `fulfillment.edit` | Cancel a Delhivery shipment. |
| POST | `/sync-shipment/:orderId` | Bearer + `fulfillment.edit` | Re-sync shipment status from Delhivery. |

### 7.7 Invoice Routes — mounted at `/invoices`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/invoices/:orderId` | **none** ⚠️ | Generates and streams a PDF invoice. Unauthenticated despite containing customer PII — anyone who knows/guesses an order ID can download it. |

### 7.8 Dashboard, Reports, Settings, Employees, Admin Customers

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/dashboard` | Bearer + `dashboard.view` | Aggregated analytics (revenue, order counts, low stock, recent orders/products, 30-day trend). |
| GET | `/reports` | Bearer + `reports.view` | Date-range-filterable report data (JSON). |
| GET | `/reports/export` | Bearer (admin-only) | Full multi-sheet Excel report with an embedded chart. |
| GET | `/setting` | none | Get company/warehouse settings. |
| POST | `/setting` | Bearer + `settings.edit` | Save settings (accepts arbitrary body fields, no whitelist). |
| GET | `/employees` | Bearer (admin-only) | List employee accounts. |
| POST | `/employees` | Bearer (admin-only) | Create an employee account. |
| PUT | `/employees/:id` | Bearer (admin-only) | Update an employee (name, permissions, password). |
| DELETE | `/employees/:id` | Bearer (admin-only) | Delete an employee. |
| GET | `/admin/customers/export` | Bearer (admin-only) | Excel export of customers. |
| GET | `/admin/customers` | Bearer + `customers.view` | List customers with order stats. |
| GET | `/admin/customers/:id` | Bearer + `customers.view` | Single customer profile + full order history. |

### 7.9 Tally Routes — mounted at `/tally`, all gated by `bridgeAuthMiddleware`

| Method | Path | Purpose |
|---|---|---|
| GET | `/tally/sync/products` | Products needing sync (never synced, or updated since last sync). |
| POST | `/tally/sync/products/:id/ack` | Bridge reports sync result back. Body: `{success}`. |
| GET | `/tally/sync/orders` | Paid, unsynced orders, with existing Tally ledger name pre-joined by phone. |
| POST | `/tally/sync/orders/:id/ack` | Bridge reports sync result + real Tally voucher number. Body: `{success, tallyVoucherNumber}`. |
| GET | `/tally/customer-ledger/:phone` | Check if a customer already has a Tally ledger. |
| POST | `/tally/customer-ledger/:phone` | Register a new customer's Tally ledger name (upserts a `Customer` if needed). |

### 7.10 Miscellaneous / Debug Routes

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | none | Health check, returns `"SILKWAVES API RUNNING"`. |
| GET | `/test` | none | Returns `"ok"` (defined inline in `server.js`). |
| GET | `/test-awb` | none | ⚠️ Debug endpoint, calls Delhivery's bulk-waybill API directly. Should not exist in a hardened production build. |
| GET | `/email/test` | none | ⚠️ Debug endpoint — sends a **real** order-confirmation email to a hardcoded address every time it's hit. Should be removed before hardening. |

---

## 8. Product Management

- **CRUD:** `productController.js` (`getProducts`, `createProduct`, `updateProduct`, `deleteProduct`).
- **Image upload:** `POST`/`PUT /products` accept `multipart/form-data` with `coverImage` (single) and `galleryImages` (up to 4). Files are held in memory by Multer, then streamed to Cloudinary (`services/cloudinary.js`) under the `silkwaves/products` folder. The resulting `secure_url`s are stored on the `Product` document.
- **Inventory:** `stock` is a plain Number, decremented only at payment-verification time (`paymentController.verifyPayment`), never at order-creation time (no reservation/hold mechanism — see [§24](#24-future-roadmap) for a race-condition risk this implies under concurrent checkouts of the last unit).
- **Categories:** free-text `category` field, conventionally `"Type 1/2/3 Sarees"` in the current admin UI — no enum enforcement.
- **Pricing / Discounts:** `price` is the actual selling price; `compareAtPrice` (optional) is a "was" price purely for display — a product is shown with a sale badge whenever `compareAtPrice > price`. There is no coupon/discount-code system (see [§24](#24-future-roadmap)).
- **Product lifecycle:** Created → (optionally edited any number of times) → Deleted. **Deleting a product does not delete its Cloudinary images**, nor does replacing an image on update delete the old one — both are known sources of orphaned Cloudinary storage.
- **Tally linkage:** `tallyGroup` (admin-selected Tally Stock Group), `tallyStockItemSynced`, `tallySyncedAt` — see [§20](#20-tally-integration-case-study).

---

## 9. Order Management

### 9.1 Order Creation

`POST /orders` (public) — the customer's cart, submitted directly as `items[]`, becomes the order's line items verbatim (denormalized snapshot of title/price/coverImage at that moment). No stock check or reservation happens at this point — an order can be created for an item that's actually out of stock; the check only happens later at payment verification.

### 9.2 Order Status Lifecycle

```
Placed → Confirmed → Packed → Shipped → Delivered
   │                                        ▲
   └──────────────► Cancelled               │
                          └──── Returned ────┘
```

(These are the enum values on `Order.status`; the actual UI-driven transitions between them are managed manually by admin staff via `PATCH /orders/:id/status` — there is no automated state-machine enforcement preventing, say, jumping straight from `Placed` to `Delivered`.)

### 9.3 Inventory Update

Handled entirely inside `paymentController.verifyPayment`, not `orderController` — see [§10](#10-payment-system).

### 9.4 Invoice

Two separate invoice mechanisms exist:
1. **On-demand generated PDF** (`GET /invoices/:orderId`, via `services/invoicePdf.js`/PDFKit) — a standard tax-invoice layout built from the Order document.
2. **Manually-uploaded Tally invoice PDF** (`POST /orders/:id/invoice`) — since the Tally bridge (see [§20](#20-tally-integration-case-study)) cannot auto-print, staff print the invoice from Tally themselves and upload the PDF here; it's stored in Cloudinary and linked via `Order.invoiceFileUrl`, visible in the admin panel's **Vouchers** tab.

### 9.5 Payment Link

No standalone "payment link" feature exists — payment happens synchronously during checkout via the Razorpay Checkout widget (see [§10](#10-payment-system)).

### 9.6 Shipment

See [§11](#11-shipping-system).

### 9.7 Email

Order-related emails: order confirmation (post-payment), shipment-created (post-shipment-creation), and status-update (manually triggered by admin via a separate endpoint from the status change itself). See [§12](#12-email-system).

### 9.8 Database Flow Summary

```
Order created (Pending) → Payment verified (Paid, stock--) → Admin changes status
  → Admin creates shipment (awb set, shipmentStatus="Created")
  → Admin/customer tracks (shipmentStatus updated from Delhivery)
  → Admin marks Delivered
  → (independently, on its own polling schedule) Tally bridge syncs the Paid order
    into a Sales Voucher once its date-window constraints allow it
```

---

## 10. Payment System

### 10.1 Payment Order Creation

`POST /create-payment` — Body `{amount}` (rupees). Creates a Razorpay order via `razorpay.orders.create({ amount: amount*100, currency: "INR" })` — note the ×100 conversion to paise, Razorpay's smallest currency unit. No database write happens at this step; the Razorpay order object is returned directly to the client for the Checkout widget to consume.

### 10.2 Checkout

The Razorpay Checkout widget is loaded and driven client-side in the storefront (outside this backend's code). It collects card/UPI/netbanking details directly with Razorpay (PCI scope stays off this server entirely) and, on success, invokes a client-side callback with `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`.

### 10.3 Verification

`POST /verify-payment` — Body `{razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId}`.

```js
// Signature check (conceptually):
expected = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)
if (expected !== razorpay_signature) → 400 reject
```

This is the standard Razorpay server-side verification pattern and is implemented correctly.

### 10.4 Stock Update on Payment Success

For each line item in the order: load the `Product`, if not found skip silently, if `stock < quantity` return 400 `"${title} is out of stock"` (aborting further processing), otherwise `product.stock -= quantity` and save. **This loop has no database transaction** — if item 3 of 5 fails the stock check, items 1–2 have already had their stock permanently decremented even though the overall payment-verification response is a failure. This is a real correctness gap under partial-stock-failure scenarios (flagged, not yet fixed).

### 10.5 Payment Failure

There is no explicit "payment failed" webhook/callback handler — if the customer abandons or the Razorpay widget reports failure, no backend endpoint is called at all, and the order simply remains in its initial `Pending` state indefinitely.

### 10.6 Known Gaps

- **No Razorpay webhook.** The only way `payment` transitions to `Paid` is the client-side `verify-payment` call succeeding. A payment that Razorpay actually captured, but whose confirming request never reaches the backend (closed tab, crashed browser, dropped connection), leaves the order stuck `Pending` with no automatic reconciliation. This is the single most consequential gap in the payment system and the top recommended item in [§24](#24-future-roadmap).
- **No refund flow implemented in code** — `Order.payment` has a `"Refunded"` enum value, implying it was designed for, but no controller function sets it; refunds would currently have to be issued manually in the Razorpay dashboard and then the order's payment field updated by hand via `PATCH /orders/:id/payment`.
- **Post-response side effects:** invoice generation + email sending happen in `verifyPayment` *after* `res.json(...)` has already been called, wrapped in their own try/catch so failures don't affect the HTTP response — functionally fine in Node, but worth knowing this pattern exists when debugging why an email didn't send even though the payment API call "succeeded."

---

## 11. Shipping System

### 11.1 Architecture

**Important:** despite the filename `services/delhivery.js` existing, **it is completely empty**. Every actual Delhivery API call is hand-written inline with `axios` directly inside `controllers/shipmentController.js` (and a near-duplicate `fetchWaybill` helper also exists in `server.js` for the `/test-awb` debug route). There is no shared Delhivery client wrapper, no retry logic, and no response normalization — each controller function builds its own request and reads Delhivery's raw response shape directly.

### 11.2 Waybill (AWB)

`GET /fetch-waybill` → Delhivery `GET /waybill/api/bulk/json/?count=N` → returns raw waybill number(s). Used internally by `createShipment` to get an AWB before building the shipment payload.

### 11.3 Serviceability

- **Admin-facing:** `GET /check-serviceability?pincode=`
- **Public (storefront checkout):** `GET /public/check-serviceability?pincode=`
- Both call the same controller function, which hits Delhivery `GET /c/api/pin-codes/json/?filter_codes=<pincode>`.
- The same underlying check (`services/serviceability.js`) is reused server-side when a customer saves a new address, rejecting unserviceable pincodes before they're even stored.

### 11.4 Shipment Creation

`POST /create-shipment/:orderId`:
1. Load `Order` and the singleton `Setting` doc (pickup/warehouse info).
2. Fetch a waybill.
3. Build the Delhivery payload via `services/shipmentBuilder.buildShipment(order, settings, awb)`.
4. POST to Delhivery's `create.json` endpoint using **`qs`-encoded form data** (not JSON — Delhivery's API requires this specific encoding for this endpoint).
5. On success: `order.awb`, `shipmentStatus="Created"`, `delhiveryResponse` saved; a "shipment created" email is sent (best-effort, swallowed on failure).
6. On failure: `shipmentStatus="Creation Failed"` saved, 400 returned.

> **⚠️ Code-quality flag:** there is a stray, unreachable `catch` block immediately following the failure-path `return` in this function — dead code from an editing mistake, not a functional bug today, but worth cleaning up.

### 11.5 Labels

`GET /shipping-label/:orderId` → Delhivery `GET /api/p/packing_slip?wbns=<awb>&pdf=true&pdf_size=A4`. Note: this **passes through Delhivery's raw JSON response**, it does not proxy/stream an actual binary PDF file to the client — the frontend is responsible for interpreting whatever Delhivery returns (likely a URL to the actual PDF, though this wasn't independently confirmed against Delhivery's docs in this documentation pass).

### 11.6 Tracking

`GET /track-shipment/:orderId` → Delhivery `GET /api/v1/packages/json/?waybill=<awb>` → updates `order.shipmentStatus` and `order.delhiveryResponse`, returns `{success, tracking}`.

`POST /sync-shipment/:orderId` does the same underlying tracking call but returns a lighter payload (`{success, shipmentStatus}`) — intended for a "refresh status" button that doesn't need the full raw tracking payload back.

### 11.7 Cancellation

`POST /cancel-shipment/:orderId` → Delhivery `POST /api/p/edit` (JSON body this time, `{waybill, cancellation:"true"}` — inconsistent encoding vs. the form-encoded creation call) → sets `shipmentStatus="Cancelled"`.

### 11.8 Common Errors / Operational Notes

- Every shipment action requires `order.awb` to already be set (i.e., a shipment must have been created first) — calling label/track/cancel before creation returns a 400.
- Delhivery's raw response is stored verbatim in `delhiveryResponse` — useful for debugging a specific order's shipment history directly from the database, at the cost of an unstructured/unindexed blob.
- `courier` is hardcoded to `"Delhivery"` everywhere it's set — there is no multi-courier support built in, despite the field existing as if it were meant to vary.

### 11.9 Future Improvements

See [§24](#24-future-roadmap): a proper `services/delhivery.js` wrapper (consolidating the currently-duplicated inline `axios` calls), consistent request encoding (JSON vs. form) across all Delhivery calls, and either removing the dead empty file or actually building it out.

---

## 12. Email System

### 12.1 Provider

**Brevo** (formerly Sendinblue) transactional email, via its HTTP API (`services/emailService.js`, `axios.post("https://api.brevo.com/v3/smtp/email", ...)`), authenticated with `BREVO_API_KEY`. **Nodemailer and the `SMTP_*` env vars are declared/present but unused** — all real email goes through Brevo's HTTP API, not raw SMTP (see [§22](#22-problems-faced--debugging-handbook)).

### 12.2 Layout / Templating

`emailTemplates/layout.js` is a shared function `layout(title, contentHtml)` returning a branded HTML shell (dark green `#00674E` header bar, "SILKWAVES" wordmark, white content card, footer with `support@silkwaves.in`). Every other template function builds its inner content HTML and passes it through `layout(...)`.

### 12.3 Templates and Their Triggers

| Template | Trigger | Called From |
|---|---|---|
| `otpEmail.js` | Customer requests a login OTP | `customerAuthController.requestOtp` |
| `orderConfirmation.js` | Payment verified successfully | `paymentController.verifyPayment` (also exercised via the debug `GET /email/test` route with a fake order) |
| `shipmentCreated.js` | A Delhivery shipment/AWB is created | `shipmentController.createShipment` |
| `orderStatusUpdate.js` | Admin explicitly triggers a status notification | `orderController.notifyStatusChange` (a **separate** call from the status-change itself — changing status via `PATCH /orders/:id/status` does **not** automatically email the customer) |
| `paymentSuccess.js` | — | ⚠️ **Empty file, unused.** Planned but never implemented (order confirmation currently covers this role instead). |
| `delivered.js` | — | ⚠️ **Empty file, unused.** Planned but never implemented — no automatic "your order was delivered" email exists. |
| `invoiceEmail.js` | — | ⚠️ **Empty file, unused.** Planned but never implemented — the invoice is instead attached directly to the `orderConfirmation` email rather than sent via a dedicated template. |

### 12.4 Email Flow

```
Controller function
   │
   ▼
services/emailService.sendEmail({ to, subject, html, attachments })
   │
   ▼
axios.post("https://api.brevo.com/v3/smtp/email", {
  sender: { email: EMAIL_FROM },
  to: [{ email: to }],
  subject,
  htmlContent: html,
  attachment: [...]   // base64-encoded Buffers, e.g. invoice PDFs
}, { headers: { "api-key": BREVO_API_KEY } })
```

Email failures are consistently caught and logged rather than propagated as HTTP errors — e.g., a failed order-confirmation email does not cause `verify-payment` to report failure to the customer, since the payment itself already succeeded and is the more important outcome.

---

## 13. Invoice System

### 13.1 On-Demand PDF Generation

`GET /invoices/:orderId` (⚠️ unauthenticated) → `invoiceController.generateInvoice` → `services/invoicePdf.generateInvoiceBuffer(order)`.

Built with **PDFKit** — imperative drawing calls produce: Silkwaves header, invoice/order number, date, bill-to block, an itemized table (qty/price/line total per item), grand total, payment method, and a thank-you footer. The function resolves a `Buffer`, which the controller streams back with `Content-Type: application/pdf` and `Content-Disposition: inline`.

### 13.2 Email Attachment

The same `generateInvoiceBuffer` function is reused inside `paymentController.verifyPayment` to attach the invoice PDF to the order-confirmation email (base64-encoded).

### 13.3 Manually-Uploaded Tally Invoices

A second, entirely separate invoice concept: since the Tally accounting integration (see [§20](#20-tally-integration-case-study)) cannot auto-print a GST-compliant invoice directly from Tally, staff print it from Tally themselves and upload the resulting PDF via `POST /orders/:id/invoice`. This is stored in Cloudinary (`silkwaves/vouchers` folder, `resource_type: "raw"`) and the URL saved to `Order.invoiceFileUrl`. The admin panel's **Vouchers** tab lists every Paid order with its reference number, its real Tally voucher number (once synced), and an upload/view control for this file.

### 13.4 Storage

- On-demand PDFs: generated fresh on every request, never stored.
- Manually-uploaded Tally invoices: stored permanently in Cloudinary, linked via `Order.invoiceFileUrl`.

### 13.5 Future Improvements

See [§24](#24-future-roadmap) — implementing the empty `invoiceEmail.js` template as its own dedicated email (separate from being bundled into order confirmation) is a small, low-risk improvement.

---

## 14. Dashboard

`GET /dashboard` → `dashboardController.getDashboard`. Loads **all** `Order` and `Product` documents into memory (no pagination or date filtering at the query level — see [§22](#22-problems-faced--debugging-handbook) for the scalability implication) and computes, all in JS:

- `revenue` — sum of `amount` across all `Paid` orders.
- `pendingOrders` / `shipped` / `delivered` — counts by `status`/`shipmentStatus`.
- `lowStock` — count of products with `stock <= 5`.
- `customers` — count of unique `phone` values across orders (not a true customer-collection count).
- `recentOrders` — top 5 by `createdAt`.
- `recentProducts` — sorted by recency, **but the code has a bug where the `.slice()` call is missing after the sort**, so this field actually returns the *entire* product list rather than just the 5 most recent (flagged, not yet fixed).
- `topProducts` — top 5 by quantity sold, computed from `Paid` orders' line items.
- `lowStockProducts` — top 5 lowest-stock products.
- `revenueLast30Days` — a day-by-day array built with a nested loop (O(orders × 30)) for a 30-day chart on the admin Dashboard page.

This endpoint is the backing data for the admin panel's Dashboard page (revenue chart, KPI tiles, "Top Selling Products", "Recent Orders", "Recent Products", "Inventory Alerts" sections).

---

## 15. Fulfillment

The admin panel's **Fulfillment** page is the UI surface for the shipment endpoints documented in [§11](#11-shipping-system). Conceptual warehouse flow:

```
Order Paid
   │
   ▼
Staff reviews order in Fulfillment tab
   │
   ▼
POST /create-shipment/:orderId  (fetches AWB, submits to Delhivery)
   │
   ▼
Print label: GET /shipping-label/:orderId
   │
   ▼
Package handed to Delhivery courier
   │
   ▼
Status polled/refreshed: GET /track-shipment/:orderId or POST /sync-shipment/:orderId
   │
   ▼
Order.status manually updated by staff (Packed → Shipped → Delivered)
   │
   ▼
(if needed) POST /cancel-shipment/:orderId
```

There is no automatic webhook from Delhivery pushing status updates into the backend — all status refreshes are pull-based, triggered by staff action in the admin UI.

---

## 16. Frontend Integration

### 16.1 Storefront (`silkwaves`) → Backend Endpoint Map

| Storefront Feature | Backend Endpoint(s) |
|---|---|
| Home / Collections / Product Detail | `GET /products` |
| Cart → Checkout | `POST /orders`, `POST /create-payment`, `POST /verify-payment` |
| Address serviceability check | `GET /public/check-serviceability` |
| Customer login (OTP) | `POST /customer/auth/request-otp`, `POST /customer/auth/verify-otp` |
| My Orders | `GET /customer/orders` |
| Account / Addresses | `GET/PATCH /customer/me`, `GET/POST/PUT/DELETE /customer/addresses` |
| Wishlist | `GET/POST/DELETE /customer/wishlist*` |
| Sale page | `GET /products` (client-side filter on `compareAtPrice > price`) |

### 16.2 Admin Panel (`silkwaves-admin`) → Backend Endpoint Map

| Admin Page | Backend Endpoint(s) |
|---|---|
| Login | `POST /auth/login`, `GET /auth/me` |
| Dashboard | `GET /dashboard` |
| Add / Manage Products | `GET/POST/PUT/DELETE /products*`, `GET /products/export` |
| Orders | `GET/PATCH/DELETE /orders*`, `POST /orders/:id/notify-status`, `GET /orders/export` |
| Vouchers | `GET /orders` (filtered client-side to `payment==="Paid"`), `POST /orders/:id/invoice` |
| Fulfillment | All `/…-shipment*` and `/fetch-waybill`, `/check-serviceability` routes |
| Customers | `GET /admin/customers*` |
| Reports | `GET /reports`, `GET /reports/export` |
| Settings | `GET/POST /setting` |
| Employees | `GET/POST/PUT/DELETE /employees*` (admin-only) |

### 16.3 Tally Bridge (`silkwaves-tally-bridge`) → Backend Endpoint Map

All `/tally/*` routes — see [§7.9](#79-tally-routes--mounted-at-tally) and [§20](#20-tally-integration-case-study).

---

## 17. Environment Variables

| Variable | Purpose | Where Used | Security Notes |
|---|---|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string | `config/db.js` | Contains embedded DB credentials — treat as a full secret. |
| `JWT_SECRET` | Signs/verifies admin and customer JWTs | `services/jwt.js`, `middleware/authMiddleware.js`, `middleware/customerAuthMiddleware.js` | If leaked, every issued token can be forged — rotate immediately if ever exposed (would force all users to re-login). |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account identifier | `services/cloudinary.js` | Not secret by itself, but paired with the key/secret below. |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `services/cloudinary.js` | Secret. |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | `services/cloudinary.js` | Secret — **this specific variable was found mismatched between local `.env` and Render's deployed environment during this project** (see [§22](#22-problems-faced--debugging-handbook)), causing every image/PDF upload to fail with an "Invalid Signature" error until corrected. |
| `RAZORPAY_KEY_ID` | Razorpay API key ID | `controllers/paymentController.js`, `server.js` | Public-ish (also used client-side in the Checkout widget), but keep paired secret private. |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret, used for signature verification | `controllers/paymentController.js` | Secret — compromise would allow forging payment-verification signatures. |
| `DELHIVERY_API_TOKEN` | Delhivery API bearer token | `controllers/shipmentController.js`, `services/serviceability.js`, `server.js` | Secret. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP credentials | **Declared but unused** — no code path actually sends mail via SMTP/Nodemailer | Low priority to rotate since unused, but should eventually be removed to reduce confusion. |
| `EMAIL_FROM` | "From" address for outgoing email | `services/emailService.js` | Not secret. |
| `BREVO_API_KEY` | Brevo transactional email API key | `services/emailService.js` | Secret. |
| `TALLY_BRIDGE_API_KEY` | Shared secret authenticating the local Tally bridge | `middleware/bridgeAuthMiddleware.js` | Secret — must match the bridge's own `BRIDGE_API_KEY` value exactly. Added mid-project specifically for the Tally integration (see [§20](#20-tally-integration-case-study)). |

**⚠️ Security note (see [§22](#22-problems-faced--debugging-handbook) for full detail):** `silkwaves-backend`'s `.env` file is currently **tracked in git** (no `.gitignore` entry excludes it), meaning every value above has been committed to the repository's history. This is a known, pre-existing issue flagged for remediation — rotating every credential above and adding `.env` to `.gitignore` (with `git rm --cached .env`) is a recommended near-term security task, tracked separately from this documentation effort.

---

## 18. Deployment

### 18.1 Backend (Render)

- **Platform:** Render Web Service, connected to the `silkwaves-backend` GitHub repo (`master` branch).
- **Deploy trigger:** automatic on every `git push` to `master` (standard Render git-integration auto-deploy).
- **Build/start:** `npm install` then `npm start` (→ `node server.js`).
- **Environment variables:** managed in Render's dashboard (Environment tab) — **critically, changing an env var via Render's REST API does *not* automatically restart the running process**; only changes made through Render's own dashboard UI (or an explicit manual redeploy) reliably restart the service with the new value loaded. This was discovered directly during this project (see [§22](#22-problems-faced--debugging-handbook)) — a `TALLY_BRIDGE_API_KEY` added via the Render API was saved correctly but had no effect until a manual redeploy was triggered.
- **Cold starts:** on Render's free/low tier, the service spins down after a period of inactivity and takes roughly 30–50 seconds to respond to the next request ("cold start"). This is a real, observed operational characteristic — any client (including the Tally bridge) hitting the API after idle time should tolerate a slow/failed first request and retry, rather than treating it as a hard failure.
- **Monitoring:** Render's own dashboard provides deploy logs and basic service logs; no separate APM/monitoring tool is integrated.

### 18.2 Storefront & Admin Panel (Netlify)

- Both are Vite + React SPAs, deployed on Netlify with git-based auto-deploy from their respective `main` branches.
- Both read the backend's base URL from a `VITE_API_BASE_URL` environment variable at build time.
- A Netlify `_redirects` file (or equivalent SPA fallback rule) handles client-side routing so direct-URL navigation (e.g. refreshing on `/product/some-slug`) doesn't 404.

### 18.3 Production Configuration Checklist

- [ ] All secrets in [§17](#17-environment-variables) set correctly in Render's dashboard (not just locally).
- [ ] `TALLY_BRIDGE_API_KEY` matches exactly between Render and the bridge's local `.env`.
- [ ] `CLOUDINARY_API_SECRET` matches exactly between local and Render (previously mismatched — see [§22](#22-problems-faced--debugging-handbook)).
- [ ] Frontend `VITE_API_BASE_URL` points at the production Render URL (not `localhost`) for any deployed build.
- [ ] `.env` removed from git tracking and rotated (see [§17](#17-environment-variables) security note) — **outstanding, not yet done**.

### 18.4 Scaling Considerations

The current architecture is a single Render Web Service instance with no horizontal scaling configuration, no caching layer, and dashboard/report endpoints that load entire collections into memory rather than using database-side aggregation pagination for large datasets. These are all reasonable tradeoffs at the store's current scale but are the first things to revisit if order/product volume grows substantially — see [§24](#24-future-roadmap).

---

## 19. External Integrations

This section catalogs every external service integrated (or attempted) by this backend.

### 19.1 MongoDB Atlas
- **Purpose:** primary data store.
- **Setup:** Atlas cluster, connection via `MONGODB_URI`.
- **Status:** ✅ Fully in production, used by every part of the app.

### 19.2 Cloudinary
- **Purpose:** image hosting (products) and raw file hosting (manually-uploaded Tally invoice PDFs).
- **Setup:** `services/cloudinary.js` configures the SDK from three env vars.
- **Implementation:** `upload_stream` + `streamifier` piping a Multer in-memory buffer.
- **Files:** `services/cloudinary.js`, `controllers/productController.js`, `controllers/orderController.js`.
- **Limitations:** no cleanup of orphaned assets on delete/replace; account-level free-tier storage/bandwidth caps apply.
- **Status:** ✅ In production. Had a real incident (secret mismatch between local/Render) — see [§22](#22-problems-faced--debugging-handbook).

### 19.3 Razorpay
- **Purpose:** payment collection.
- **Setup:** SDK instantiated with `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`.
- **Implementation:** order creation + signature verification only; **no webhook**.
- **Status:** ✅ In production, ⚠️ webhook gap noted.

### 19.4 Delhivery
- **Purpose:** shipping/courier.
- **Setup:** raw `axios` calls with `Authorization: Token <DELHIVERY_API_TOKEN>`.
- **Implementation:** inline in `shipmentController.js`; intended `services/delhivery.js` wrapper file exists but is empty.
- **Status:** ✅ In production, ⚠️ code-organization gap noted.

### 19.5 Brevo
- **Purpose:** transactional email (OTP, order confirmation, shipment notification, status updates).
- **Setup:** HTTP API via `axios`, authenticated with `BREVO_API_KEY`.
- **Status:** ✅ In production.

### 19.6 Render
- **Purpose:** backend hosting.
- **Status:** ✅ In production. See [§18](#18-deployment) for operational notes (cold starts, env-var-update-doesn't-auto-restart).

### 19.7 GitHub
- **Purpose:** source control + deploy trigger for Render/Netlify.
- **Status:** ✅ In production for `silkwaves-backend`, `silkwaves-admin`, `silkwaves`. The fourth repo, `silkwaves-tally-bridge`, is git-initialized locally but has **no remote** — by design, since it only ever needs to run on the shop's own PC.

### 19.8 Postman / VS Code / npm
- Standard developer tooling used throughout the project's life for manual API testing, code editing, and package management respectively. No special project-specific configuration beyond what's documented elsewhere in this document (route lists in [§7](#7-api-documentation) double as a manual-testing reference).

### 19.9 Tally Prime (via the local bridge)
- **Purpose:** accounting/GST bookkeeping system of record.
- See [§20](#20-tally-integration-case-study) for the complete case study — this is the most involved integration in the project and warrants its own section.

---

## 20. Tally Integration (Case Study)

### 20.1 Why This Integration Was Required

ATHARV FASHION's actual books of account are kept in **Tally Prime**, not in this backend's MongoDB. Every sale made through the Silkwaves storefront needs to eventually show up in Tally as a proper GST-compliant Sales Voucher, and every product in the catalog needs a corresponding Tally Stock Item with correct stock levels, so that:
- GST returns can be filed correctly from Tally (the company's actual statutory record).
- Physical/accounting stock stays reconciled with what the website shows as available.
- The business doesn't have to manually re-type every online order into Tally by hand.

### 20.2 Business Requirements (as specified by the business owner)

- A small local program should run continuously on the same PC as Tally, polling the cloud backend and pushing data into Tally's local XML/HTTP interface. **Tally itself must never be exposed to the internet.**
- Poll frequency: every 10–30 seconds (15s chosen).
- **Stock Item sync**: when a product is added/updated in the admin CMS, a corresponding Tally Stock Item should be created/updated automatically, with correct stock quantity.
- **Sales Voucher automation**: only when an order's payment is confirmed (not at order placement) — a Sales Voucher should be created in Tally automatically.
- Each fabric type has a different official HSN code, already reflected in this company's real Tally chart of accounts as distinct pre-configured **Stock Groups** (see [§20.7](#207-the-real-mechanism-stock-group-inheritance) — this was the single biggest architectural discovery of the whole integration).
- Each unique customer (by phone number) gets **one Tally Ledger**, created automatically on their first order and reused for all subsequent orders.
- GST split: **CGST+SGST** for intra-state (same state as the company, Karnataka) sales, **IGST** for inter-state sales — and CGST/SGST must sum to the *exact* tax amount even when that produces an unequal split down to the paisa (e.g. ₹229.95 tax → CGST ₹114.98 + SGST ₹114.97, not ₹114.98 twice).

### 20.3 Architecture

```
Silkwaves Backend (Render, cloud)
      │  polled every ~15s via HTTPS
      │  Authorization: x-tally-bridge-key: <shared secret>
      ▼
silkwaves-tally-bridge (Node.js, runs continuously on the shop's local PC)
      │  builds Tally-Import XML in memory
      │  POST http://localhost:9000  (Tally's own local XML/HTTP server)
      ▼
Tally Prime (company: ATHARV FASHION, XML/HTTP server enabled on port 9000)
```

The bridge is a **separate, standalone Node.js project** (`silkwaves-tally-bridge`), not merged into the main backend, because:
- It has a fundamentally different process lifecycle (runs forever on a desktop, not a cloud dyno).
- It needs an XML-building/parsing capability (`fast-xml-parser`) the cloud backend has no other reason to depend on.
- It keeps every Tally-specific XML quirk isolated in one place, away from the core e-commerce backend.

### 20.4 Backend-Side Surface (already documented in [§7.9](#79-tally-routes--mounted-at-tally))

`routes/tallyRoutes.js` + `controllers/tallyController.js` + `middleware/bridgeAuthMiddleware.js` — a small, purpose-built JSON API the bridge polls. The backend itself has **zero knowledge of Tally's XML format**; it only exposes plain product/order data and accepts simple acknowledgements.

### 20.5 Bridge-Side Structure

```
silkwaves-tally-bridge/
├── package.json        (deps: axios, dotenv, fast-xml-parser)
├── .env                 TALLY_URL, BACKEND_API_URL, BRIDGE_API_KEY,
                          TALLY_COMPANY_NAME, TALLY_STOCK_GROUP_NAME (fallback),
                          TALLY_GST_RATE, TALLY_SALES_LEDGER, TALLY_COMPANY_STATE,
                          TALLY_GODOWN_NAME, TALLY_VOUCHER_CLASS, POLL_INTERVAL_MS
├── launch.bat            One-click launcher: starts the bridge, then opens Tally
├── src/
│   ├── index.js          Entry point, starts the poll loop
│   ├── config.js          Reads/validates env vars
│   ├── backendClient.js    axios wrapper for all /tally/* calls
│   ├── tallyClient.js       POST XML to Tally, parse <RESPONSE>, and
│   │                        lookupVoucherNumber() (Day Book export → match by REFERENCE)
│   ├── xmlBuilders/
│   │   ├── envelope.js        Shared ENVELOPE/HEADER/IMPORTDATA scaffold
│   │   ├── stockItem.js        Stock Item Create/Alter XML
│   │   ├── ledger.js            Customer Ledger Create XML
│   │   └── salesVoucher.js       Sales Voucher Create XML (tax logic lives here)
│   └── poller.js            Orchestration: syncProducts(), syncOrders(), setInterval loop
└── test/                    Unit tests for the XML builders (no live Tally needed) +
                              saved diagnostic XML files from the debugging process
```

### 20.6 XML/API Architecture Basics

Tally Prime exposes a local XML/HTTP server (enabled via Gateway of Tally → F12 Advanced Configuration or the Connectivity settings, default port 9000). All requests follow the same envelope:

```xml
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>ATHARV FASHION</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <!-- STOCKITEM / LEDGER / VOUCHER goes here -->
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```

Tally responds with a `<RESPONSE>` block containing `CREATED`/`ALTERED`/`ERRORS`/`EXCEPTIONS`/`LINEERROR` counts. The bridge's `tallyClient.js` treats any non-zero `ERRORS`/`EXCEPTIONS`, or a present `LINEERROR`, as a thrown error.

### 20.7 The Real Mechanism: Stock Group Inheritance

This was the single biggest and hardest-won discovery of the entire integration. The initial, intuitive approach — sending an explicit `<GSTDETAILS.LIST>` (HSN code, tax rate, taxability) directly on each Stock Item — **never worked reliably**, no matter what combination of fields was tried (including `HSNSOURCETYPE`/`GSTSOURCETYPE` set to various guessed values). Every item kept displaying "Source of details: Company" in Tally's own UI and silently used the Company-level default HSN instead of whatever was sent per-item.

The actual mechanism, discovered by manually creating a test item in Tally's UI under different **Stock Groups** and inspecting the result, is:

> **GST/HSN configuration in this Tally company is inherited from the Stock Item's parent Stock Group, not the Company, and not an item-level override field sent via XML import.**

This company already has 9 real, pre-configured Stock Groups, each with its own correct HSN baked in:

| Stock Group | HSN Code |
|---|---|
| ART BALATAN | 540730 |
| ART BALATAN SAREE | 540730 |
| ART DUPION SAREE | 540730 |
| ART FANCY SAREE | 540754 |
| ART KANJIWARAM | 540784 |
| ART TANA | 540710 |
| PURE EMBRODERY | 500720 |
| PURE PRINTED | 500720 |
| PURE SILK SAREE | 500720 |

Once this was understood, the fix was to **stop trying to override GST/HSN per item entirely** and instead file each Stock Item under the correct pre-existing group. The final `stockItem.js` XML builder sends no `GSTDETAILS.LIST` at all — just `GSTAPPLICABLE=Applicable` and the correct `PARENT` (Stock Group name), and the item inherits the right HSN automatically.

To make this selectable per-product without engineering guesswork, a **"Tally Stock Group" dropdown** (admin-only, never shown on the storefront) was added to the product form, backed by a new `Product.tallyGroup` field, listing all 9 real group names. Staff pick the correct fabric-type group when adding/editing a product.

### 20.8 GST Voucher Logic

`xmlBuilders/salesVoucher.js` computes, per order:
1. `taxableAmount` = sum of line-item amounts.
2. `taxAmount` = `taxableAmount × 5%` (Tally's own auto-calculation was found to be unreliable for XML-imported vouchers — the bridge computes tax itself and posts it explicitly).
3. If the order's delivery state matches the company's home state (Karnataka), split into **CGST + SGST**; otherwise post a single **IGST** line.
4. **Critical correctness rule** (explicitly specified by the business owner after reviewing a test voucher): CGST and SGST must sum to the *exact* tax amount, even if that means they're not equal to the paisa (e.g. `114.98 + 114.97`, not `114.98 + 114.98`) — `ROUND OFF` only absorbs the rounding needed to reach a whole-rupee total, it must never be used to paper over an incorrect tax total.
5. A `ROUND OFF` ledger line absorbs the residual needed to round the grand total to the nearest rupee.

Each inventory line also carries `ISDEEMEDPOSITIVE=No` directly (a field discovered to be needed at the inventory-entry level, not just inside the nested accounting allocation, via a corrected reference XML the business owner manually edited and confirmed worked with **zero import exceptions**).

The voucher also carries full buyer address fields (`STATENAME`, `PLACEOFSUPPLY`, `PARTYPINCODE`, `ADDRESS.LIST`, `BASICBUYERADDRESS.LIST`, `GSTREGISTRATIONTYPE=Unregistered`) directly on the voucher itself — these were found to need to be on the **voucher**, not just the customer's Ledger master, because Tally's GST Tax Analysis screen resolves "Place of Supply" from a snapshot on the transaction, not purely from the party ledger's stored address.

No `CLASSNAME` (Voucher Class) is sent on the voucher — an earlier version used `CLASSNAME="GST SALES"` (matching the real reference invoice), but the business owner's manually-corrected reference XML removed it, and that corrected version was adopted as the final approach.

### 20.9 Customer Ledger Auto-Creation

On first sync of a Paid order for a given phone number, the bridge creates a Tally Ledger (`xmlBuilders/ledger.js`) under the `Sundry Debtors` group, with a full address, state, and pincode (also required for correct Tax Analysis resolution — see above), and `GSTREGISTRATIONTYPE=Unregistered` (appropriate for retail/individual customers with no GSTIN). The backend then stores `Customer.tallyLedgerName` (matched by phone), so subsequent orders from the same phone number reuse the same ledger rather than creating a duplicate — **by design**, this means orders placed under different typed names but the same phone number all bill to whichever ledger name was created first for that phone.

### 20.10 Inventory Sync

`xmlBuilders/stockItem.js` builds a `<STOCKITEM>` Create/Alter XML: `NAME`, `PARENT` (the product's `tallyGroup`, or a configured fallback group), `BASEUNITS=Pcs`, `ISBATCHWISEON=No` (new CMS-created items deliberately skip batch tracking for simplicity, unlike some pre-existing manually-entered items that do use batches), `GSTAPPLICABLE=Applicable`, and (only on first creation) `OPENINGBALANCE`/`OPENINGRATE`/`OPENINGVALUE` (the opening value is sent as a **negative** number — confirmed correct against the business owner's own manually-verified reference, matching Tally's internal Dr/Cr sign convention for opening stock value). Opening balance is intentionally **only sent once, at creation** — later product edits sync price/other fields via `ACTION="Alter"` but do not re-push stock quantity, since once real Sales Vouchers start flowing through Tally, Tally's own stock ledger should become authoritative rather than being repeatedly overwritten by the bridge.

### 20.11 Network Architecture & Security

Tally is never exposed to the public internet. The bridge runs on the same physical/local machine as Tally and talks to it exclusively via `http://localhost:9000`. The bridge authenticates *outbound* to the cloud backend using a static shared-secret header (`x-tally-bridge-key`), the same static-API-key pattern documented in [§6.3](#63-tally-bridge-authentication-static-api-key).

### 20.12 Testing Strategy

Because there is no automated way to assert against a real Tally instance's internal state from a CI pipeline, testing followed a two-tier approach used throughout the whole integration's development:
1. **Unit tests** (`test/run.js`) — pure string/structure assertions on the XML builder output (no I/O), run with plain Node (`node test/run.js`), covering: correct Stock Item name/group/opening-balance shape, IGST vs. CGST+SGST branching, exact-paisa tax-split correctness, absence of removed fields (Voucher Class), and presence of the `ISDEEMEDPOSITIVE` fix.
2. **Live diagnostic testing against the real local Tally instance** — since Tally's HTTP-API error responses are often uninformatively generic (`EXCEPTIONS: 1` with no message text), the most effective diagnostic technique discovered was writing the exact XML to a file and having the business owner import it manually via Tally's own **Import → Masters/Transactions** UI, which surfaces a detailed, human-readable exception screen that the raw HTTP response never does. This technique directly resolved several otherwise-opaque failures (see [§22.13](#2213-tally-xml-import-silent-failures)–[§22.17](#2217-hsngst-not-following-per-item-override)).

### 20.13 Every Real Blocker Encountered (Summary — full detail in §22)

| # | Blocker | Root Cause | Resolution |
|---|---|---|---|
| 1 | Manual Tally UI **Export** feature refused to export a Stock Item | Tally Prime **Educational edition** disables master export as an anti-piracy restriction | Worked around by using UI screenshots + (once discovered) the "Import" diagnostic technique instead of Export |
| 2 | Stock Item creation via XML returned opaque `EXCEPTIONS: 1` with no message | Wrong identifying tag — used `<STOCKITEMNAME>` (which is only valid for *referencing* an item from a voucher) instead of `<NAME>` (required for the master itself) | Switched master-identity tag to `<NAME>` |
| 3 | Stock Item creation failed with `Stock Group 'PRIMARY'/'Primary' does not exist!` | This Tally company has **no implicit root Stock Group** the way it has an implicit `Sundry Debtors` account group — Stock Groups must be explicitly created first | Created the needed Stock Group master via the same XML-import mechanism before creating items under it |
| 4 | Voucher creation failed with `Voucher date is missing`, regardless of date format tried | **Tally Prime Educational edition only accepts voucher dates on the 1st, 2nd, or last day of the month** — a hard license restriction, not a data/formatting bug | Bridge pins every new Sales Voucher's date to the 2nd of the current month (temporary workaround, documented as such — resolves permanently once the business moves to a licensed Tally Prime) |
| 5 | Multi-item Sales Vouchers failed while single-item ones succeeded, with the failed voucher showing a debit-only, zero-credit "Mismatch in total amount" exception | A rounding bug: independently rounding CGST and SGST as two equal halves of the tax amount (e.g. both `114.98`) introduced a paisa of drift from the true tax total whenever the tax amount had an odd number of paise — invisible with round test prices (₹1000, ₹3000) but real with actual saree prices (₹4599 etc.) | Recomputed SGST as the *remainder* after CGST, guaranteeing the pair always sums to the exact tax amount |
| 6 | GST Tax Analysis showed "Country, State, Registration Type or Place of Supply not specified" even for correctly-configured customers | These fields must be present **on the voucher itself** (a transaction-time snapshot), not only on the customer's Ledger master | Added `STATENAME`, `PLACEOFSUPPLY`, `PARTYPINCODE`, `ADDRESS.LIST`, `BASICBUYERADDRESS.LIST`, `GSTREGISTRATIONTYPE` directly to the voucher XML |
| 7 | New Stock Items always showed HSN `540730` (a stale early default) regardless of what HSN was sent, "Source of details: Company" | See [§20.7](#207-the-real-mechanism-stock-group-inheritance) — HSN is inherited from the Stock Group, not settable per-item via XML at all | Abandoned per-item override entirely; route items to the correct pre-existing Stock Group instead |
| 8 | Interstate vs. intrastate tax logic was initially removed (per an earlier instruction to "just always use IGST" for simplicity), then had to be restored | The business owner, after reviewing a same-state test voucher in Tally's own Tax Analysis screen, correctly identified that Tally itself flags an IGST-on-a-local-sale voucher as a compliance mismatch — a genuine GST rule, not just a Tally quirk | Restored the interstate/intrastate branch (`config.companyState` comparison), keeping the exact-paisa CGST/SGST split fix from blocker #5 |
| 9 | The bridge's `Render`-hosted backend rejected all bridge requests with 401 even though the correct API key was set in Render's dashboard | Render's **API-based** environment-variable update does not restart the already-running process (unlike a dashboard-driven change) — the live process was still running with the old environment | Triggered an explicit manual redeploy via Render's API, which restarted the process with the current environment loaded |
| 10 | Product image/PDF uploads suddenly failed with `Invalid Signature` from Cloudinary | Render's deployed `CLOUDINARY_API_SECRET` value did not match the working local `.env` value — a pre-existing mismatch unrelated to the Tally work, discovered while debugging in the same session | Updated Render's `CLOUDINARY_API_SECRET` to the correct value + redeployed |

### 20.14 Current Status

| Component | Status |
|---|---|
| Stock Item sync (create/update, correct HSN via Stock Group routing) | ✅ Implemented and live-tested against the real Tally instance |
| Customer Ledger auto-creation (by phone, with full address) | ✅ Implemented and live-tested |
| Sales Voucher automation on payment confirmation | ✅ Implemented and live-tested — full order-to-Tally flow confirmed working end-to-end with the running bridge polling automatically |
| Correct CGST+SGST vs. IGST branching with exact-paisa tax split | ✅ Implemented and confirmed against Tally's own Tax Analysis screen |
| Real Tally voucher number capture (for display in the admin Vouchers tab) | ✅ Implemented via a Day Book export lookup matched by the voucher's `REFERENCE` field |
| Auto-print of the Tally invoice | ❌ **Not achievable via the XML import path** — Tally's "Print Voucher after Saving" hook only fires for interactively-entered vouchers, not ones created via XML import. **Workaround shipped instead:** a manual invoice-upload feature (admin Vouchers tab, `POST /orders/:id/invoice`) — staff print from Tally themselves and upload the PDF. |
| Voucher date restriction | ⚠️ **Planned/interim**: pinned to the 2nd of the month as a workaround for the Educational-edition license limit; resolves itself once the business licenses Tally Prime |
| Credit Note automation | 📋 **Future Work** — explicitly out of scope for this phase, mentioned early in planning but never built |
| Barcode printing automation | 📋 **Future Work** — explicitly out of scope for this phase |
| Bridge auto-start / background-service installation | 📋 **Planned, not yet built** — a `launch.bat` one-click launcher exists (starts the bridge, then opens Tally), but true OS-level auto-start (Windows scheduled task at login, or an installed background service) was discussed as an option and left for later, in favor of the simpler manual `npm start` / launcher-script workflow for now |
| Deployment to the real production Tally PC (a different, remote machine, not the one used for development/testing) | 📋 **Planned, not yet done** — a step-by-step checklist was prepared (clone the bridge repo there, install Node, configure `.env` to point at production, ensure Tally's port 9000 server is enabled, run continuously), but was not executed as of this document's writing since the business owner was working from a different machine than the actual shop PC during development |

---

## 21. Development Timeline

> **Source-of-truth note:** the entries below are reconstructed from the actual engineering session logs for this project. Where a phase is referenced only briefly in that record (without full file-level detail preserved), it is marked accordingly rather than invented in full.

| Phase | Objective | Key Outcomes |
|---|---|---|
| UI Rebuild | Rebuild/restyle the storefront | New UI shipped (limited further detail retained in the session record beyond this being an early completed phase) |
| Customer Login (OTP) | Let customers log in without a password | Phone-number OTP flow, delivered by email (SMS/DLT not set up) — `customerAuthController.js`, `services/otp.js`, `otpEmail.js` |
| Hover product-card slideshow + Quick View | Storefront UX improvements | Frontend-only enhancement (`silkwaves` repo) |
| Saved Addresses + Account Settings | Let customers manage multiple delivery addresses, wired into Checkout | `Customer.addresses` embedded schema, `/customer/addresses*` routes, Delhivery serviceability validation on save |
| Netlify SPA fallback fix | Fixed direct-URL 404s on the storefront | Added a `_redirects` rule for client-side routing |
| Admin Customers panel | Give staff visibility into customer accounts and order history | `adminCustomerController.js`, `/admin/customers*` routes |
| Order-status email confirmation | Notify customers when their order status changes | `orderStatusUpdate.js` template + `notifyStatusChange` endpoint (separate call from the status change itself) |
| Employees / Permissions system | Let the owner delegate admin access without giving full control | `Admin.role`/`permissions`, `middleware/permissionMiddleware.js`, `employeeController.js` |
| Orders table beautification | Admin UX polish (icons, status pills, styled selects) | Frontend-only (`silkwaves-admin`) |
| Invoice PDF email attachment | Attach the generated invoice to the order-confirmation email | `services/invoicePdf.js` wired into `paymentController.verifyPayment` |
| Reports panel + Excel exports | Business analytics + downloadable spreadsheets | `reportController.js`, `services/excelReport.js`, QuickChart-embedded revenue trend |
| Sale pricing/badges + Wishlist | `compareAtPrice`-based sale display, customer wishlist | `Product.compareAtPrice`, `Customer.wishlist` (the only formal `ref` relationship in the schema) |
| **Tally Integration** (this project's largest single phase) | Automate Stock Item, Ledger, and Sales Voucher creation in Tally Prime from the e-commerce backend | See [§20](#20-tally-integration-case-study) in full — new `silkwaves-tally-bridge` repo, new `tallyController.js`/`tallyRoutes.js`/`bridgeAuthMiddleware.js`, new `Product.tallyGroup`/`tallyStockItemSynced`/`tallySyncedAt`, new `Order.tallyInvoiceSynced`/`tallyVoucherNumber`/`tallySyncedAt`/`invoiceFileUrl`, new `Customer.tallyLedgerName`, new admin "Vouchers" tab and "Tally Stock Group" product-form dropdown |
| Cloudinary secret fix (production) | Fix broken image/invoice uploads on the deployed backend | Corrected mismatched `CLOUDINARY_API_SECRET` on Render, redeployed |
| Documentation | This document | — |

**Git milestones (backend repo, most recent commits at time of writing):**
```
ef4ca5f  Add tallyGroup field for per-fabric-type Tally Stock Group routing
e0c8f03  Include product category in Tally product sync response
a727b03  Add Tally sync endpoints and manual invoice upload for orders
015c345  Add sale pricing (compareAtPrice) and customer wishlist
4844bd7  Add Reports panel with admin-only Excel exports
67e920a  Attach the invoice PDF to the order-confirmation email
d0b6a86  Add employee accounts with per-section view/edit permissions
1c01b66  Add customer saved addresses, admin Customers panel, and status-change email
```

---

## 22. Problems Faced & Debugging Handbook

This is the largest and most practically useful section for a future maintainer — every confirmed debugging session from this project, with root cause and resolution.

### 22.1 Backend `.env` Tracked in Git (Security)
**Symptom:** repository security review found `silkwaves-backend`'s `.env` file (containing every live secret in [§17](#17-environment-variables)) committed to git history, with no `.gitignore` entry excluding it.
**Root cause:** the file was likely committed early in the project before a `.gitignore` was set up, and never removed afterward.
**Status:** Known, flagged, **not yet remediated**. Recommended fix: rotate every credential, `git rm --cached .env`, add `.env` to `.gitignore`.

### 22.2 `node_modules` Also Tracked in Git
**Symptom:** `git status` on the backend repo shows thousands of tracked files under `node_modules/`.
**Root cause:** same class of issue as §22.1 — no `.gitignore` for build artifacts/dependencies.
**Status:** Known, flagged, not yet remediated.

### 22.3 Render API-Based Env Var Update Doesn't Restart the Process
**Symptom:** after adding `TALLY_BRIDGE_API_KEY` to Render via its REST API, every request from the bridge still got `401 Unauthorized`, even though querying Render's API back confirmed the variable was saved with the exact correct value.
**Diagnosis process:** verified the key matched byte-for-byte on both sides; verified the deployed commit actually contained the new `bridgeAuthMiddleware.js` code (it did); concluded the *running process* itself must not have the new environment loaded.
**Root cause:** Render's dashboard-driven environment variable changes trigger an automatic service restart, but changes made via Render's public API do not reliably do the same — the already-running Node process kept its original `process.env` snapshot from when it last booted.
**Solution:** trigger an explicit manual redeploy via Render's `POST /v1/services/:id/deploys` API endpoint, which restarts the process with the current environment.
**Prevention:** after any env-var change made via API (not the dashboard), always follow up with an explicit redeploy and verify with a live request before assuming the change took effect.

### 22.4 Cloudinary `Invalid Signature` on Product/Invoice Upload
**Symptom:** admin panel showed `Invalid Signature ...` errors when adding a new product (image upload) — a Cloudinary-specific HMAC signature mismatch error.
**Diagnosis process:** compared the local, known-working `CLOUDINARY_API_SECRET` value against what Render actually had stored via Render's API — they were different strings entirely, despite `CLOUDINARY_API_KEY` and `CLOUDINARY_CLOUD_NAME` matching correctly.
**Root cause:** the deployed Render environment had a stale/incorrect Cloudinary secret, unrelated to any change made during the Tally work — a pre-existing configuration drift discovered incidentally while debugging in the same session.
**Solution:** updated Render's `CLOUDINARY_API_SECRET` to the correct value and redeployed (same env-var-then-redeploy pattern as §22.3).

### 22.5 Admin Panel "Failed to Fetch" Against Production
**Symptom:** local admin-panel dev server showed `TypeError: Failed to fetch` on every API call, with the network tab showing `net::ERR_CONNECTION_REFUSED` to `localhost:3000`.
**Root cause:** a leftover `.env.local` file (created earlier for local testing against a temporary local backend) was still overriding `VITE_API_BASE_URL` to `localhost:3000`, and no local backend was running anymore.
**Solution:** deleted the stale `.env.local` override, restarted the dev server (Vite only reads `.env*` files at startup, not live) — it then correctly used the production `VITE_API_BASE_URL` from the committed `.env`.
**Prevention:** always remember to remove any temporary `.env.local` override created for local testing before assuming a "connects to production" test is representative.

### 22.6 GitHub Push Authentication Failures
**Symptom:** `git push` to the backend/admin repos failed with `Permission to ... denied` (403), then with `Invalid username or token. Password authentication is not supported for Git operations.` even after providing a fresh-looking classic PAT via a credential-helper override.
**Root cause:** the stored Windows Git Credential Manager cache was stale/lacked permission; separately, the credential-helper shell-function approach had some quoting/escaping issue in this specific Git Bash environment that caused the token to not be transmitted correctly.
**Solution:** embedding the token directly in the remote URL (`https://x-access-token:<TOKEN>@github.com/...`) for a one-off push worked reliably where the credential-helper approach didn't. For a later push, the user logging into git via their own CLI tooling and then re-running a plain `git push origin main` also worked using the now-cached correct credentials.
**Prevention:** if a credential-helper override fails ambiguously, try the direct-embedded-token-in-URL form as a more reliable fallback; be aware that raw token strings in shell commands may also be blocked by an environment's own safety/permission classifier (encountered once during this project) and may need to be run by the human directly instead.

### 22.7 Product `tallyStockItemSynced` Flag Stuck in a Perpetual "Pending" Loop
**Symptom:** the Tally bridge kept re-syncing the same products on every single poll cycle, forever, even immediately after a successful sync acknowledgement.
**Diagnosis process:** inspected the acknowledgement endpoint's Mongoose update call and noticed it used the model's default `{ timestamps: true }` behavior, which bumps `updatedAt` on every write — including the ack write itself.
**Root cause:** the "is this product pending sync?" check compares `updatedAt > tallySyncedAt`. Because the acknowledgement update itself set `tallySyncedAt` *and* (via default Mongoose timestamp behavior) bumped `updatedAt` to a value at or after that same instant, the product would immediately re-qualify as "updated since last sync" on the very next poll.
**Solution:** passed `{ timestamps: false }` explicitly to the `findByIdAndUpdate` call inside `tallyController.ackProduct`, so acknowledging a sync doesn't itself count as a product update.
**Prevention:** whenever a write operation's own side effect could re-trigger the exact condition it's meant to resolve, explicitly disable automatic timestamp bumping for that specific write.

### 22.8 Duplicate/Stray Background Bridge Processes
**Symptom:** an earlier version of a Stock Item kept syncing with an old, already-fixed-in-code-but-not-in-the-running-process bug (stale HSN default value), even after the source file had clearly been corrected.
**Root cause:** Node.js does not hot-reload — an already-running `node src/index.js` process keeps the exact in-memory code it loaded at startup. Multiple background bridge instances had been started at different points across a long debugging session, and not all of them were reliably stopped before starting the next one, so an old process with stale code kept quietly winning races against newer, correct ones.
**Solution:** used process-listing tools (`Get-CimInstance Win32_Process`) to find and explicitly kill every stray `node src/index.js`/`npm start` process before starting a fresh one; established a habit of confirming zero stray processes before attributing a result to "the current code."
**Prevention:** always fully restart (not just re-run in a new terminal) a long-running Node process after any source-file edit, and verify no duplicate instance is still running in the background.

### 22.9 Tally Educational Edition Blocks Manual Export
**Symptom:** attempting to export a Stock Item master from Tally's UI silently failed with no useful error ("IT WONT LET ME EXPORT ITEM").
**Root cause:** Tally Prime **Educational edition** disables the manual Export feature entirely as an anti-piracy restriction — this is a licensing limitation, not a UI mistake or a bug in this project's code.
**Workaround:** used detailed screenshots of the Stock Item Alteration screen to extract real field values manually where Export wasn't available; later discovered that **Sales Voucher export specifically still worked** even under the Educational edition (the restriction apparently applies to Masters export, not Transactions export), which produced the single most valuable reference artifact of the whole integration (see [§20.6](#206-xmlapi-architecture-basics)).

### 22.10 Tally XML Master-Identity Tag Confusion (`STOCKITEMNAME` vs `NAME`)
See [§20.13](#2013-every-real-blocker-encountered-summary--full-detail-in-22), row 2. **Diagnosis technique:** Tally's raw HTTP response gave only an opaque `EXCEPTIONS: 1` with no message; importing the exact same XML manually via Tally's own **Import → Masters** UI surfaced a detailed exception screen reading "Master name is missing," which was the crucial clue — despite the master clearly having a `NAME` attribute *on the tag itself*, Tally's master-creation schema specifically requires the identity to also be repeated as a `<NAME>` child element, not `<STOCKITEMNAME>` (which is the correct tag only when *referencing* an existing item elsewhere, e.g. inside a voucher's inventory entry).

### 22.11 Implicit Stock Group Assumption Was Wrong
See [§20.13](#2013-every-real-blocker-encountered-summary--full-detail-in-22), row 3. Account Groups have a genuinely implicit reserved root (e.g. `Sundry Debtors` always exists), which led to a reasonable-but-wrong assumption that Stock Groups would behave the same way. They don't — this company's Tally installation had **zero** pre-existing Stock Groups at the point this was tested, and any `PARENT` reference to a non-existent group failed with a clear `Stock Group 'X' does not exist!` error (this one *did* surface a clear message via plain HTTP, unlike §22.10).

### 22.12 OTP Delivered by Email, Not SMS
**Context, not a bug:** the customer login OTP flow sends the one-time code via email (Brevo) rather than SMS. This is a deliberate interim decision, noted directly in the code (`customerAuthController.js`), because SMS delivery in India requires DLT (Distributed Ledger Technology) template registration with a telecom-approved SMS gateway, which was not set up for this project. Flagged here so a future maintainer doesn't assume SMS delivery is silently broken — it was never implemented in the first place.

### 22.13 Tally XML Import Silent Failures — General Diagnostic Technique
**Recurring pattern across §22.10, §22.11, and the voucher-date issue below:** Tally's HTTP-API `<RESPONSE>` block frequently reports only `EXCEPTIONS: 1` or `ERRORS: 1` with **no descriptive message at all**, making blind XML tweaking extremely inefficient. The single most effective debugging technique discovered across this entire integration was: **write the exact failing XML to a file, and have someone with Tally UI access import it manually via Gateway of Tally → Import → Masters/Transactions**. This route surfaces Tally's real, human-readable "Import Exceptions" screen (e.g. "Master name is missing," "Voucher date is missing," "Mismatch in total amount between Credit and Debit entries") that the same XML posted over raw HTTP never reveals. This should be the **first** troubleshooting step for any future opaque Tally-integration failure, not a last resort.

### 22.14 Tally Educational Edition Voucher Date Restriction
See [§20.13](#2013-every-real-blocker-encountered-summary--full-detail-in-22), row 4. Notably, this was misdiagnosed at least twice before the real cause was found — first suspected to be a date-format problem (tried `YYYYMMDD`, `DD-Mon-YYYY`, `YYYY-MM-DD`, all failed identically), then suspected to be a Company-configuration or license-tier restriction on voucher creation in general (a reasonable hypothesis given the Export-blocking precedent in §22.9) — before the business owner directly identified, from independent knowledge of Tally Educational edition's known limitations, that only the 1st, 2nd, and last day of each month are accepted for voucher dates. This was confirmed empirically by testing a date on the 2nd of the month, which succeeded immediately where every other date had failed with an identical "Voucher date is missing" message regardless of format.

### 22.15 CGST/SGST Rounding Bug Hidden by Round Test Numbers
See [§20.13](#2013-every-real-blocker-encountered-summary--full-detail-in-22), row 5. Worth calling out specifically as a **testing methodology lesson**: every test performed with round prices (₹1000, ₹3000 per item) passed cleanly because a 5% tax on a round number happens to split evenly in half. The bug only surfaced once tested against a real, non-round saree price (₹4599), which produces a tax amount with an odd number of paise. **Lesson for future test-writing on this codebase:** always include at least one non-round monetary test value, since round numbers can mask rounding/precision bugs entirely.

### 22.16 Voucher-Level vs. Ledger-Level GST Fields
See [§20.13](#2013-every-real-blocker-encountered-summary--full-detail-in-22), row 6. The fix (adding address/state/pincode/registration-type fields directly to the voucher XML, not just the ledger) was discovered by manually inspecting Tally's GST **Tax Analysis** screen (accessible from within the voucher itself) and comparing it against a correctly-resolving real reference voucher — a useful general technique: when a Tally-computed field looks wrong, open that same field's dedicated analysis/drill-down screen in Tally's UI rather than guessing from the plain ledger entry list.

### 22.17 HSN/GST Not Following Per-Item Override
See [§20.7](#207-the-real-mechanism-stock-group-inheritance) and [§20.13](#2013-every-real-blocker-encountered-summary--full-detail-in-22), row 7. This was the most persistent single blocker in the entire integration — multiple attempted fixes (`HSNSOURCETYPE="Stock Item"`, later `HSNSOURCETYPE="Specify Details Here"`, various `GSTDETAILS.LIST` shapes) all failed to change Tally's displayed behavior, until the business owner independently discovered — by manually creating a test item directly under one of the company's real pre-existing Stock Groups in Tally's UI — that HSN is inherited from the **Stock Group**, not settable per-item via the XML import path at all. This is the clearest example in the whole project of a case where **live, hands-on exploration of Tally's own UI by someone with direct access was more effective than any number of XML-tweaking iterations** — a lesson worth remembering for any future Tally-adjacent debugging.

### 22.18 Dashboard `recentProducts` Missing a `.slice()`
**Symptom (code-review finding, not a reported incident):** `dashboardController.getDashboard`'s `recentProducts` field is documented in the frontend/admin UI as showing "5 recent products," but the backend code sorts the full product list and never actually slices it to 5 — it returns every product. Flagged in [§14](#14-dashboard) and here for a future fix; not confirmed to have caused a user-visible incident, but is a genuine discrepancy between intended and actual behavior.

### 22.19 Missing Modules / Dead Code
- `services/delhivery.js` is a completely empty file, despite `shipmentController.js` clearly being written as if such a service module should exist (see [§19.4](#194-delhivery)).
- `nodemailer` is a declared dependency and `SMTP_*` env vars exist, but no code path anywhere uses them — all email actually goes through Brevo's HTTP API (see [§12.1](#121-provider)).
- Three email templates (`paymentSuccess.js`, `delivered.js`, `invoiceEmail.js`) are empty files with zero references anywhere in the codebase (see [§12.3](#123-templates-and-their-triggers)).
- `server.js` instantiates its own unused `Razorpay` client and `multer` upload instance at the top level, and imports `Order`/`Setting`/`Product`/`qs`/`buildShipment` without using them directly in that file — all dead/leftover code from earlier iterations.

### 22.20 Route Ordering
Checked directly during this documentation pass: `routes/adminCustomerRoutes.js` and `routes/orderRoutes.js` both correctly register their more-specific `/export` routes *before* their generic `/:id` route, avoiding the classic Express bug where `/:id` would greedily match the literal string `"export"` as an `:id` value. No route-ordering bugs were found in the current codebase.

---

## 23. Code Standards

*(Descriptive — the following patterns are what's actually followed in this codebase today; not all of them are best practices, and gaps are called out explicitly.)*

- **File naming:** singular for model files (`Product.js`, `Order.js`), camelCase for everything else (`productController.js`, `authMiddleware.js`).
- **Controller design:** one file per resource, `exports.functionName = async (req, res) => {...}` pattern throughout; most functions wrap their body in `try/catch` returning `{error: err.message}` on failure — though this is not universal (some functions, e.g. in `tallyController.js`, don't wrap in try/catch at all and rely on Express 5's native async error propagation).
- **Route design:** flat files under `routes/`, each exporting an `express.Router()`, manually `require`d and `app.use()`-mounted in `server.js` with no central route index/registry.
- **Middleware chains:** consistently ordered `auth` (or `customerAuth`/`bridgeAuth`) → `requirePermission`/`requireAdminRole` → (optional `multer` upload) → controller function.
- **Validation:** minimal and manual — most controllers check for required fields with plain `if (!field) return res.status(400)...` rather than a schema-validation library (no `joi`/`zod`/`express-validator` in use). Mongoose's own schema-level `required`/`enum` constraints provide a second layer of validation at the database-write step.
- **Error handling:** inconsistent HTTP status code usage in places (some validation failures return 400, others 500 even for client-caused errors) — no centralized error-handling middleware exists; each controller handles its own errors inline.
- **Logging:** plain `console.log`/`console.error` throughout, no structured logging library (e.g. `winston`, `pino`). Some logging is genuinely excessive/sensitive for production (see [§22](#22-problems-faced--debugging-handbook) and [§6.4](#64-security-notes) — `authMiddleware.js` logging full tokens and decoded JWT payloads).
- **API responses:** generally `res.json(data)` on success, `res.status(code).json({error: message})` on failure — no consistent envelope (e.g. no universal `{success, data, error}` shape across every endpoint; some endpoints return the raw resource directly, others wrap in `{success, ...}`).
- **Git practices:** descriptive commit messages with a short summary line + a longer body explaining *why* (see [§21](#21-development-timeline) for real examples); commits are created per logical feature, not per file; secrets (`.env`) unfortunately are tracked (see [§22.1](#221-backend-env-tracked-in-git-security)) — this should not be treated as an example to follow, but rather the clearest concrete case for adopting a stricter `.gitignore` policy going forward.
- **Documentation standard going forward:** this document (`docs/ENGINEERING_DOCUMENTATION.md`) should be kept up to date as the single source of truth; when a future change contradicts something written here, update this document in the same change, not as a follow-up "someday" task.

---

## 24. Future Roadmap

| Feature / Fix | Priority | Estimated Complexity | Suggested Approach |
|---|---|---|---|
| Razorpay webhook | 🔴 High | Medium | Add a `POST /webhooks/razorpay` route, verify Razorpay's webhook signature (different scheme from the client-side signature check), and update `Order.payment`/`paymentStatus` server-side as the source of truth, independent of whether the client's `verify-payment` call ever arrives. This closes the single most consequential correctness gap in the system ([§10.6](#106-known-gaps)). |
| Remove `.env` from git, rotate all secrets | 🔴 High | Low | `git rm --cached .env`, add to `.gitignore`, rotate every credential in [§17](#17-environment-variables), update Render's dashboard with the new values. |
| Fix `dashboardController` `recentProducts` missing `.slice()` | 🟡 Medium | Trivial | One-line fix — see [§22.18](#2218-dashboard-recentproducts-missing-a-slice). |
| Build out (or remove) `services/delhivery.js` | 🟡 Medium | Medium | Consolidate the currently-duplicated inline `axios` Delhivery calls (in `shipmentController.js` and `server.js`) into one real wrapper module, normalizing request encoding (currently inconsistent JSON vs. form-encoded across different Delhivery endpoints). |
| Remove unused code (`nodemailer`, empty email templates, dead `server.js` imports) | 🟢 Low | Trivial | Straightforward cleanup pass. |
| Reduce `authMiddleware.js` sensitive logging | 🟡 Medium | Trivial | Remove or gate behind a debug flag the `console.log`s of the raw Authorization header, token, and decoded JWT payload. |
| Restrict CORS to known origins | 🟡 Medium | Low | Replace `app.use(cors())` with an explicit origin allow-list (`silkwaves` and `silkwaves-admin`'s Netlify URLs). |
| Cart/checkout stock reservation (avoid overselling the last unit under concurrent checkouts) | 🟡 Medium | Medium–High | Requires either a short-lived stock hold at order-creation time or a transactional decrement at payment-verification time (MongoDB multi-document transactions). |
| Coupons / discount codes | 🟢 Low (business-priority-dependent) | Medium | New `Coupon` model, applied server-side during order creation/payment verification. |
| Returns / refund workflow | 🟢 Low | Medium | Formalize the currently-manual `Order.payment="Refunded"` path with an actual controller function and Razorpay refund API integration. |
| Product reviews | 🟢 Low | Medium | New `Review` model (`ref` to Product and Customer), moderation flow in admin. |
| Customer notifications (order status push/SMS) | 🟢 Low | Medium–High (SMS requires DLT registration, see [§22.12](#2212-otp-delivered-by-email-not-sms)) | Could reuse the existing email-template pattern for more triggers before investing in SMS. |
| Advanced/paginated Dashboard & Reports (avoid loading full collections into memory) | 🟡 Medium (grows more urgent with order volume) | Medium | Replace in-memory JS aggregation with MongoDB aggregation-pipeline queries and date-range-scoped queries rather than `Model.find()` with no filter. |
| Redis caching layer | 🟢 Low (not yet needed at current scale) | Medium | Cache `GET /products` and dashboard aggregates with a short TTL if traffic grows. |
| Docker / containerization | 🟢 Low | Low–Medium | Would simplify local dev parity with Render's environment; not currently blocking anything. |
| CI/CD (automated tests on push, not just auto-deploy) | 🟡 Medium | Medium | The bridge repo already has a `test/run.js` unit-test suite that could be wired into a GitHub Actions workflow; the main backend has no automated test suite at all yet. |
| Rate limiting | 🟡 Medium | Low | Particularly relevant for the unauthenticated `POST /orders`, `POST /create-payment`, `POST /customer/auth/request-otp` (OTP-spam risk), and `GET /invoices/:orderId` (PII exposure risk) endpoints. |
| Monitoring / APM | 🟢 Low | Low–Medium | Render's built-in logs are the only current visibility; a dedicated error-tracking tool (e.g. Sentry) would surface production errors proactively rather than requiring manual log review. |
| Tally: license upgrade + removal of the date-pinning workaround | 🔴 High (blocks true daily-batch automation) | N/A (business/licensing decision, not engineering) | Once ATHARV FASHION moves to a licensed Tally Prime, remove `getAllowedVoucherDate()`'s pinning logic in `poller.js` and post the real order date directly. |
| Tally: bridge auto-start as a real background service | 🟡 Medium | Low–Medium | Windows Task Scheduler "at logon" trigger or an installed Node-Windows service, replacing the current manual `npm start`/`launch.bat` workflow. |
| Tally: production deployment to the actual shop PC | 🔴 High (currently blocking real automated use) | Low (a checklist already exists, see [§20.14](#2014-current-status)) | Execute the prepared setup checklist once the developer/owner has access to the actual Tally machine. |
| Tally: Credit Note automation | 🟢 Low (explicitly deferred) | Medium | Mirror the Sales Voucher builder pattern for credit notes/returns. |
| Tally: barcode printing automation | 🟢 Low (explicitly deferred) | Unknown (not yet scoped) | Not investigated at all yet. |

---

## 25. Project Summary

### 25.1 Current Completion Percentage

Estimated at a **functional-MVP-plus level**: the core storefront-to-payment-to-fulfillment loop is fully built and in production use, and the Tally accounting integration — the most recently completed and most technically involved piece — is fully implemented, live-tested end-to-end, and confirmed working by the business owner. The gaps documented in this report (Razorpay webhook, git-tracked secrets, several dead-code items) are real but do not block day-to-day store operation today.

### 25.2 Production Readiness

- **Storefront checkout → payment → order management → shipping:** ✅ production-ready, actively used.
- **Admin tooling (products, orders, customers, employees, reports, settings):** ✅ production-ready.
- **Tally sync:** ✅ functionally complete and tested against the real local Tally instance; ⚠️ still constrained by the Educational-edition voucher-date limitation and not yet deployed to the actual production shop PC (currently only run/tested from a development machine).
- **Security posture:** ⚠️ needs attention before considering this "hardened" — see [§22.1](#221-backend-env-tracked-in-git-security), [§6.4](#64-security-notes) (credential logging), and [§2.3](#23-authentication--security) (open CORS).

### 25.3 Scalability

Reasonable for the store's current scale; the Dashboard/Reports endpoints loading full collections into memory ([§14](#14-dashboard), [§18.4](#184-scaling-considerations)) are the clearest first bottleneck if order/product volume grows significantly — addressed in [§24](#24-future-roadmap).

### 25.4 Security

The most important outstanding items are the git-tracked `.env` (all secrets currently in repo history — [§22.1](#221-backend-env-tracked-in-git-security)), open CORS ([§2.3](#23-authentication--security)), sensitive auth logging ([§6.4](#64-security-notes)), and the unauthenticated invoice-download endpoint exposing customer PII to anyone who knows/guesses an order ID ([§7.7](#77-invoice-routes--mounted-at-invoices)).

### 25.5 Performance

No performance issues have been reported in practice at current traffic levels; the architectural choices that would become performance-relevant at higher scale are already identified in [§24](#24-future-roadmap).

### 25.6 Maintainability

Codebase is consistent in style and conventions ([§23](#23-code-standards)), but lacks automated tests for the core backend (the Tally bridge is the only part of the system with a real test suite), a centralized constants module (permission sections, order/payment enums are duplicated by convention rather than shared — [§4.1](#41-backend-folder-tree)), and has a handful of confirmed dead-code artifacts ([§22.19](#2219-missing-modules--dead-code)) that should be cleaned up to reduce confusion for the next engineer.

### 25.7 Known Limitations (Consolidated)

1. No Razorpay webhook — payment state can desync from reality if the client-side confirmation call never arrives.
2. `.env` (all secrets) and `node_modules` are tracked in git.
3. No stock reservation — theoretical overselling race condition on the last unit of a product under concurrent checkouts.
4. Dashboard/Reports load entire collections into memory rather than querying with server-side aggregation/pagination.
5. `services/delhivery.js` is an empty placeholder; real Delhivery calls are duplicated inline elsewhere.
6. Three email templates are defined but never implemented/used.
7. Tally voucher automation is currently pinned to a fixed day-of-month due to the Educational Tally license; requires a licensed Tally Prime to fully resolve.
8. Tally bridge has not yet been deployed to the actual production shop PC.
9. `GET /invoices/:orderId` and a couple of debug routes (`/test-awb`, `/email/test`) are unauthenticated and should be removed or protected before a security-hardening pass.

### 25.8 Recommended Next Steps

In priority order: (1) rotate secrets and stop tracking `.env`/`node_modules` in git, (2) implement the Razorpay webhook, (3) deploy the Tally bridge to the real shop PC and set up auto-start, (4) clean up the confirmed dead code and the `recentProducts` slice bug, (5) tackle the rest of [§24](#24-future-roadmap) as business priorities dictate.

---

*End of document. This is intended to be a living document — update it in the same change as any future architectural decision, new integration, or significant bug fix, so it remains the accurate single source of truth for this project.*
