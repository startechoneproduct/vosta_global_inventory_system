# Stacey POS & Inventory Management System — Handover Documentation

**Prepared:** 2026-08-03
**Repo:** `stacey` (backend: Node/Express/MongoDB · frontend: React/Vite)

This document is a complete handover reference: what the system does, how it's built, every feature and who can use it, and how to log in to try it out.

---

## 1. What This System Is

A multi-store Point-of-Sale + inventory/operations management system built for **Stacey Enterprises**, covering two distinct business units that share one platform:

| Store | Type | What it does |
|---|---|---|
| **Stacey Fountain** | `fountain` | Bottled & sachet water production and sales. Tracks raw materials (preforms, caps, labels, nylon rolls), production batches, finished-goods inventory, and equipment maintenance. |
| **Stacey Farm** | `farm` | Poultry operation. Sells eggs (by crate/unit), live birds, and chicken droppings. Tracks vaccinations/medication instead of production/equipment. |

Both stores share the same codebase, database, and login system — the UI and available features adapt automatically based on which store's data a user is looking at (`store.type === 'fountain' | 'farm'`).

---

## 2. Tech Stack

**Backend** (`/backend`)
- Node.js + Express
- MongoDB via Mongoose
- JWT authentication (access + refresh tokens, httpOnly cookies)
- `bcryptjs` for password hashing
- `nodemailer` for transactional email (staff onboarding, password resets)
- `node-cron` for scheduled jobs (exchange rate refresh, equipment service checks)
- OpenStreetMap Nominatim for geocoding (driver GPS ↔ addresses)
- `open.er-api.com` for live NGN→EUR exchange rate

**Frontend** (`/client`)
- React 18 + Vite
- React Router v6
- Tailwind CSS
- `recharts` for dashboard/analytics charts
- `i18next` / `react-i18next` for localization (English / German)
- `axios` with an interceptor that silently refreshes the access token

---

## 3. Architecture Basics

### Authentication
- Login issues a short-lived **access token** (default 300 seconds, `JWT_EXPIRE_SECONDS`) and a 7-day **refresh token**, both set as httpOnly cookies (and the access token is also returned in the JSON body for the `Authorization: Bearer` header path).
- The frontend (`client/src/services/api.js`) transparently calls `POST /api/auth/refresh` when a request 401s, so users aren't forced to re-login every 5 minutes.
- Failed logins lock the account for 15 minutes after 5 attempts (`User.incLoginAttempts`).
- New staff accounts are created with a **generated temporary password** and `mustChangePassword: true` — the frontend blocks all navigation and forces a password change on first login (`ChangePassword.jsx`, `App.jsx`'s `ProtectedRoute`).

### Multi-Store Scoping
- Every data-bearing request runs through `resolveStoreScope` middleware (`backend/src/middleware/auth.js`):
  - **Owner**: can pass `?storeId=` to operate on any store in their `accessibleStoreIds` (empty list = access to all stores). This powers the store-switcher dropdown in the header.
  - **Everyone else**: hard-locked to their own `storeId`; attempts to pass a different one are rejected.

### Roles
Defined in the `User` schema enum: `owner, general_manager, accountant, clerical, driver, security, manager, supervisor, staff, secretary`.

In practice, the application logic and UI actively use: **owner, general_manager, manager, supervisor, accountant, driver**. `clerical`, `security`, `staff`, and `secretary` exist in the schema but have no dedicated dashboard/menu/permission logic wired up yet — they fall back to the generic dashboard-only view.

`owner` and `general_manager` are treated as functionally identical ("GM-equivalent") everywhere in the backend via `user.isGmEquivalent()` / `authorizeGm()` — the **only** difference is that `owner` can switch between stores.

---

## 4. Role Permission Matrix

| Feature | Owner / GM | Manager / Supervisor | Accountant | Driver |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✅ (full) | ✅ (ops view) | ✅ (ops view) | ✅ (driver view) |
| Products — view | ✅ | ✅ | ✅ | — |
| Products — create/edit details | ✅ | — | ✅ | — |
| Products — **edit price** | ✅ only | ❌ | ❌ | — |
| Sales (POS) | ✅ | ✅ | ✅ | — |
| Sales — override price at checkout | ✅ | ❌ | ❌ | — |
| Inventory (stock in/out) | ✅ | ❌ | ✅ | — |
| Inventory Movement ledger | ✅ only | ❌ | ❌ | ❌ |
| Expenses — record | ✅ | ✅ | ✅ | — |
| Expenses — approve | ✅ / Manager | — | — | — |
| Returns | ✅ | ✅ | — | ✅ (own only) |
| Damages / write-offs | ✅ | ✅ | — | — |
| Customers & token rewards | ✅ (all) | — | — | ✅ (own only) |
| Activity Log | ✅ (everyone's) | ✅ (own only) | ✅ (own only) | ✅ (own only) |
| Equipment (Fountain) | ✅ only | — | — | — |
| Driver Tracking (view live map) | ✅ only | — | — | ✅ (self-report) |
| Production (Fountain) | ✅ | ✅ | ✅ | — |
| Vaccination/Medication (Farm) | ✅ | ✅ | ✅ | — |
| Raw Materials — restock/record | — | ✅ / Accountant | ✅ | — |
| Staff Management | ✅ only | — | — | — |
| Store config / switching | ✅ only | — | — | — |

---

## 5. Feature Walkthrough

### 5.1 Authentication & Account Security
- Email/password login, 15-minute lockout after 5 failed attempts.
- Forced password change flow for GM-created staff accounts (temp password emailed on creation).
- Self-service password change (`/change-password`).

### 5.2 Dashboard (role-aware)
One endpoint (`GET /api/dashboard/summary?period=`), three different payloads depending on role:
- **Owner/GM**: today's sales, sales trend chart, total stock, low-stock alerts, best sellers, stock health by product, full profit breakdown (revenue, COGS, write-offs, approved expenses, gross/net profit), expense pie chart, and (Fountain only) a production/raw-materials summary.
- **Manager/Accountant/Supervisor**: a lighter operational view — today's sales, stock trend, total stock, write-off count, production summary.
- **Driver**: customers they've added, units sold (week/month/year), distance covered (week/month/year), and their return count.

Fountain vs Farm dashboards use the same shape but label things differently (e.g. "Returns Value" for Fountain vs "Damage Write-Off" for Farm) since Fountain tracks customer *returns* while Farm tracks *damages* as its main loss category.

### 5.3 Products
- Full catalog CRUD, auto-generated SKUs (`FTN-XXXXXX` / `FRM-XXXXXX`).
- Store-type-aware unit validation: Farm products must use `crate`, `unit`, `bag`, or `bird`; `bird` products additionally require a `layer`/`broiler` category.
- **Price changes are audit-locked** to Owner/GM only via a dedicated `PUT /:productId/price` endpoint — everyone else's product edits go through a separate endpoint that cannot touch price.
- `costPerUnit` (true cost, distinct from sale price) is editable by Accountant/GM — used for profit/COGS calculations.
- Soft-delete only (`isActive: false`) so historical sales/logs never point at a deleted product.

### 5.4 Sales (Point of Sale)
- Cart-based sale creation; server is the source of truth for price (prevents client-side tampering) unless the user is Owner/GM, who may override the line price (flagged as `priceOverridden` for audit).
- Validates stock availability per line item before committing.
- Deducts stock, writes a `StockMovement` (`type: 'sale'`) per line, and an `ActivityLog` entry per product sold.
- If tied to a `customerId`, feeds the customer token-rewards engine automatically.
- Triggers a fire-and-forget low-stock check/notification after the sale.
- Analytics endpoint: revenue/profit/avg sale value, daily sales trend, top & bottom 5 sellers, transaction count by product, revenue by category.

### 5.5 Inventory / Stock Management
- Manual **Stock In** / **Stock Out** with notes (Owner/GM/Accountant only).
- **Manual Past-Sale Entry**: backfill historical sales that were never recorded through the POS (e.g. paper records being digitized), tagged with a distinct movement type so it doesn't distort the live ledger.
- Inventory analytics: stock health (healthy / low_stock / out_of_stock), total units, per-product breakdown, and a stock-in/out/turnover overview for a selected period.

### 5.6 Inventory Movement Ledger (Owner/GM only)
A single append-only ledger view across **every** stock-affecting event — `in`, `out`, `sale`, `return_in`, `damage_out`, `production_in`, `manual_past_sale` — each with a `balanceAfter` snapshot, so the running stock balance never has to be re-derived from history. Filterable by product, type, and date range.

### 5.7 Expenses
- Store-type-specific category lists (Fountain: Fuel, Caps, Bottle Preforms, Nylon, Filters, AEDC, Labels, plus shared Salaries/Maintenance/Misc. Farm: Layer/Grower Mash & Feed Bags, Feeds, Vaccination, Medication, Day-Old Chicks, plus shared).
- **Auto-approval**: expenses at or below the store's configured `expenseApprovalThreshold` (₦50,000 for Fountain, ₦100,000 for Farm by default) are auto-approved; above it, they sit `pending` until a Manager/GM/Owner approves.
- Analytics: profit margin %, spend by category with % of total, sales-vs-expense comparison for the period.

### 5.8 Returns (Fountain-facing loss category)
- Record a customer return with reason, optional restock-to-inventory, optional customer link.
- Snapshots the product's price at time of return so historical write-off values don't drift if the product's price changes later.
- Notifies store leadership.

### 5.9 Damages (write-offs)
- Record broken/cracked/rotten/contaminated/other stock losses, deducts stock immediately, computes cost value from `costPerUnit`, logs to the Inventory Movement ledger (`damage_out`) and Activity Log, and notifies leadership.

### 5.10 Customers & Token Rewards
- Drivers add customers they serve; GM/Manager/Accountant see the full store customer list, drivers only see their own.
- **Token rewards engine**: configurable per store (default: 2 sachet bags = 1 token, 5 tokens = 1 free pack). Tokens accrue automatically whenever a purchase is recorded for a customer (either via a driver logging a purchase, or a POS sale tagged with that customer). Redeemable via a dedicated endpoint that converts available tokens into free packs.
- **Supply schedules**: set a recurring delivery cadence (daily/weekly/biweekly/monthly) per customer; a dedicated endpoint buckets customers into *overdue*, *due today*, and *upcoming*, and "mark as supplied" automatically rolls the next due date forward.

### 5.11 Activity Log
Full audit trail of `sold` / `returned` / `stock_in` / `stock_out` events. Owner/GM sees everyone's activity; every other role only sees their own.

### 5.12 Equipment Maintenance (Fountain only, Owner/GM only)
- Track machines (Filling Machine, Sealing Machine, Generator, etc.) with a service interval; `nextServiceDue` is auto-computed on save.
- A helper (`checkEquipmentServiceDue`, intended to run on a schedule) flags equipment `due_for_service` within a 3-day warning window and notifies leadership once per cycle (won't spam repeatedly for the same due date).

### 5.13 Driver Tracking
- Drivers "ping" their GPS location; the server reverse-geocodes it to a human-readable address server-side (frontend never handles raw coordinates for display), and accumulates distance covered.
- Drivers set daily delivery **target locations** by typing an address (e.g. "Wuse Market, Abuja") — the server forward-geocodes it, so drivers never enter coordinates.
- Owner/GM get a live map/table of all drivers' latest known address + targets.
- Drivers get their own distance-covered stats (week/month/year).

### 5.14 Raw Materials & Production (Stacey Fountain only)
- Raw materials tracked in purchase units (bag, roll, bundle) with a configurable pieces-per-unit yield: **Preform 21kg/19kg bags, Caps, Labels, Nylon rolls**.
- **Bottled water production**: input bottle count + preform leakage count → consumes preforms (bottles + leakage), caps, and labels; outputs finished packs (12 bottles/pack) added straight to product stock.
- **Sachet water production**: input sachet count + leakage count → consumes nylon film; outputs finished bags (20 sachets/bag) added to product stock.
- Every batch snapshots exactly what was consumed (immune to later edits of yield ratios) and creates a `StockMovement` + `RawMaterialMovement` + `ActivityLog` entry, plus a leadership notification.
- Restocking raw materials is a separate endpoint with its own ledger and low-stock flagging.

### 5.15 Vaccination / Medication Records (Stacey Farm only)
Log vaccinations and medications administered to flocks — type, name, batch/flock label, dosage, date administered, next due date. Available to Owner/GM/Manager/Supervisor/Accountant (not drivers).

### 5.16 Staff Management (Owner/GM only)
- Create staff accounts (`general_manager, manager, accountant, driver, supervisor`) with an auto-generated temporary password, emailed to the new hire, forcing a password change on first login.
- Update role/name/phone/active status; reset password on demand (regenerates + re-emails).

### 5.17 Store Switching & Configuration
- Owner accounts have an `accessibleStoreIds` list; the store-switcher dropdown in the header only appears for owners with access to more than one store.
- Store config (expense approval threshold, min stock threshold, reward rules, currency) is editable by Owner only.

### 5.18 Notifications
In-app + email notifications (mirrored) fire for: low stock, equipment service due, expense pending, return recorded, production recorded, and general events — sent to store leadership (and managers where relevant).

### 5.19 Localization
Full English/German UI toggle via `i18next`, switchable from the header at any time (`client/src/i18n/`, `LanguageContext.jsx`).

### 5.20 Currency Display
Live NGN → EUR exchange rate, fetched on boot and refreshed every 6 hours via cron, served from an in-memory cache (public endpoint, no auth required, with a hardcoded fallback rate if the upstream API is ever down).

### 5.21 Keep-Alive
In production, the server self-pings its own `/keep-alive` endpoint every 14 minutes to prevent the host (Render free tier) from spinning down due to inactivity.

---

## 6. Environment Variables Reference

(Values live in `backend/.env` and `client/.env` — not reproduced here since they contain live secrets. Names only, for anyone setting up a new environment.)

**Backend**
| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Signs access & refresh tokens |
| `JWT_EXPIRE_SECONDS` | Access token lifetime (default 300s) |
| `REFRESH_TOKEN_EXPIRE` | Refresh token lifetime (default `7d`) |
| `BCRYPT_ROUNDS` | Password hashing cost (default 12) |
| `NODE_ENV` | `development` / `production` |
| `PORT` | Server port (default 5000) |
| `KEEP_ALIVE`, `KEEP_ALIVE_URL` | Self-ping config for production hosting |
| `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASS` | SMTP for staff onboarding/password-reset emails (falls back to console logging if unset) |

**Client**
- Standard Vite `.env` — check `client/src/services/api.js` for the API base URL variable it reads.

---

## 7. Running It Locally

```bash
# Backend
cd backend
npm install
npm run seed      # wipes DB and loads full demo dataset (see credentials below)
npm run dev        # nodemon, http://localhost:5000

# Frontend
cd client
npm install
npm run dev        # http://localhost:5173
```

Other backend scripts:
- `npm run reset` — wipes all transactional data (sales, stock, expenses, customers, etc.) and **all staff except the owner**, but preserves/recreates the two stores. Pass `--wipe-stores` to also blank the stores themselves. Useful for resetting a demo/staging environment without a full re-seed. This script's owner account is a **separate fixed login**, distinct from the seeded one (see below).

---

## 8. Demo Login Credentials

### From `npm run seed` (`backend/scripts/seed.js`) — full demo dataset

This is the standard demo dataset: both stores, sample products, equipment, and raw materials for Stacey Fountain, and four Stacey Fountain user accounts:

| Role | Email | Password | Notes |
|---|---|---|---|
| **Owner** | `owner@stacey.com` | `SecuredLink` | Full access, can switch between Stacey Fountain and Stacey Farm |
| Manager | `manager@fountain.com` | `Password@123` | Stacey Fountain only |
| Accountant | `accountant@fountain.com` | `Password@123` | Stacey Fountain only |
| Driver | `driver@fountain.com` | `Password@123` | Stacey Fountain only |

> Note: the seed script only creates staff for **Stacey Fountain** — Stacey Farm has products but no dedicated demo users. Log in as the Owner and use the store switcher to view Stacey Farm.

### From `npm run reset` (`backend/scripts/resetData.js`) — clean-slate owner login

A separate, permanent fallback login used when wiping a staging environment back to empty. This account is preserved even after a reset:

| Role | Email | Password |
|---|---|---|
| Owner | `admin@vostaglobal.org` | `SecuredLink` |

**These are two different credential sets — don't confuse them.** `owner@stacey.com` comes from a fresh `seed`, and only exists if the seed script has been run. `admin@vostaglobal.org` is the one guaranteed to survive a `reset`.

⚠️ Both are demo/default credentials with weak, publicly-documented passwords. Rotate them (or disable these accounts and create real ones via Staff Management) before this system is used with real data in a production environment accessible outside the team.

---

## 9. Things Worth Knowing for Whoever Picks This Up

- **Role enum has unused entries.** `clerical`, `security`, `staff`, `secretary` are valid in the `User` schema but have no menu items or route permissions built for them yet — they'd currently just get the bare dashboard-only fallback view.
- **`owner` vs `general_manager`** are permission-identical everywhere except store switching. If a "GM" needs to manage more than one store, they need `role: 'owner'` with a scoped `accessibleStoreIds`, not `general_manager`.
- **Fountain and Farm are structurally different**, not just re-skinned — Production/Raw Materials/Equipment are Fountain-only; Vaccination is Farm-only; "loss" means Returns on Fountain but Damages on Farm throughout the dashboard/analytics code.
- **Price changes are intentionally audit-locked** to Owner/GM via a separate endpoint from general product edits — this is a deliberate control, not an oversight, if it comes up in a bug report about managers "not being able to edit price."
- **Two independent demo/reset scripts exist** (`seed.js` full demo data, `resetData.js` clean-slate) with two different owner logins — see section 8.
