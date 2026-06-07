# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server with auto-reload (nodemon)
npm start            # Start production server (node server.js)
npm run test-cj-api  # Test CJ Dropshipping API integration
node test-retouren-email.js  # Test return/refund email flow
```

No build step — frontend assets (HTML, CSS, JS) are served statically by Express. There is no transpilation or bundling in production.

## Architecture

**Stack:** Express.js backend + vanilla JS frontend + SQLite database. No frontend framework.

**Entry points:**
- `server.js` — Express server, all API routes, Stripe webhook handler
- `app.js` — Main frontend logic (192KB), loaded by `index.html`
- `database.js` — SQLite schema initialization and query helpers
- `products.json` — Product catalog (source of truth for colors, SKUs, pricing, bundles)

**Order flow:**
```
Customer adds to cart (localStorage) → Stripe Checkout → 
Stripe webhook (server.js) → SQLite order record → 
PDF receipt (receipt-generator.js) → Email (resend-service.js) → 
CJ Dropshipping order (cj-dropshipping-api.js) → Tracking
```

**Frontend state:** Cart and wishlist stored in `localStorage`. No session management. Multi-currency pricing is computed client-side using exchange rates fetched from `exchange-rate-service.js`.

**Routing:** File-based HTML pages (`index.html`, `cart.html`, `success.html`, `tracking.html`, `wishlist.html`, `gutscheine.html`). Order tracking uses query param `?order=ORD-XXXXX`.

**Product pages:** Individual HTML files in `produkte/` (produkt-10.html through produkt-51.html). Color variant images are managed by `color-image-selection.js`.

## Key Integrations

| Service | File | Purpose |
|---|---|---|
| Stripe | `server.js` | Payment processing + webhook |
| CJ Dropshipping | `cj-dropshipping-api.js` | Supplier order automation |
| Resend | `resend-service.js` | Transactional emails (primary) |
| ExchangeRate-API | `exchange-rate-service.js` | Real-time multi-currency |
| PDFKit | `receipt-generator.js` | PDF invoice generation |

**CJ Dropshipping** has a fallback system (`cj-fallback-system.js`) for API failures. The token refresh logic is in `get-cj-token.js`.

## Environment Variables

All secrets live in `.env`. Required keys: Stripe secret/webhook keys, Resend API key, CJ Dropshipping email/password/API key, SMTP credentials (Nodemailer fallback), ExchangeRate API key. See `README.md` for the full list.

## Database

SQLite file at `database/orders.db` (also `orders.db` at root — test vs. production). Schema is initialized in `database.js`. No migrations system; schema changes require manual `ALTER TABLE` or dropping and recreating the DB.

## Deployment

Hosted on Netlify. Config in `netlify.toml`. Node version pinned to 18.18.0 (`.nvmrc`). API routes are redirected through Netlify's proxy config in `netlify.toml`.
