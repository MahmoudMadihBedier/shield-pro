# ERP System Engineering Prompt
## Tire Instant-Adhesive Manufacturing Business — Full-Stack Web App

**Stack:** React (frontend) + Supabase (backend/DB/auth) + Vercel (hosting)
**UI Language:** Arabic (RTL) for ALL user-facing text, labels, buttons, messages, reports
**Target users:** Small manufacturing business, expected to scale up over time

---

## 1. Business Context

The client manufactures an instant adhesive for tire/rim sealing, packaged in 600ml bottles. This is the first product; the system must support adding new products in the future, each with its own recipe/BOM (Bill of Materials), without code changes — fully data-driven.

**Current product example:**
- Finished good: "Tire Instant Adhesive 600ml"
- Liquid formula per batch: needs verification — client-stated percentages summed to 102.5%, not 100%. **Before building the costing engine, get corrected percentages from the client.** Store the formula as a flexible recipe (ingredient + percentage or ingredient + fixed quantity per batch size), not hardcoded.
- Batch size reference: 20kg of PVA raw material per batch (confirm total batch weight once percentages are corrected).
- Packaging consumed per finished unit (in addition to liquid): sticker (ستيكر), cap (غطاء), empty bottle (عبوة فارغة), seal/cap-liner (برشامة) — confirm exact meaning of "برشامة" with client (induction seal, tamper seal, or cap liner) so the item is named precisely in inventory.

This means the system needs a **two-level BOM**:
1. **Batch recipe** (raw materials → intermediate product = bulk liquid, measured in kg/liters)
2. **Packaging BOM** (bulk liquid portion + packaging components → 1 finished sellable unit)

---

## 2. Clarifications → Built as Editable Settings (Not Hardcoded)

The original spec had 12 open points. Instead of baking in fixed defaults, **every one of these must be a live, user-editable setting inside the app itself** (in an "الإعدادات / Settings" module, restricted to master admin / users with Settings permission), so the business owner can change behavior anytime without asking a developer to touch code. Each row below states: the open question, the setting(s) to expose in the UI, and where it plugs into the rest of the system.

| # | Point | Editable Setting(s) in UI | Where it's used |
|---|---|---|---|
| 1 | Formula percentages didn't sum to 100% | Recipe editor shows a **live running total** next to each ingredient row as the owner types percentages/quantities; Save button is disabled (with a clear Arabic warning) until the total = 100% (or matches the declared batch weight, if using fixed quantities instead of %). Owner can switch a recipe between "percentage mode" and "fixed quantity mode" per product. | Manufacturing module (§3.3), Recipe/BOM screens |
| 2 | No waste/yield % | Each batch recipe has an editable **"نسبة الفاقد المتوقعة %"** field (default 0, owner sets it per product/recipe). A second, optional field lets them enter the **actual** waste after a real batch finishes, so planned vs. actual cost can be compared over time. | Production cost calculation, production batch screen |
| 3 | VAT not addressed | Global setting: **"تفعيل ضريبة القيمة المضافة"** (on/off) + **default VAT %** in Settings. If on, every new invoice pre-fills that %, but the % stays editable per invoice in case of exceptions. | Sales & Purchase invoice screens |
| 4 | Pricing/discount policy unclear | Per-item **default selling price** (editable), optional **per-customer price list** (override), plus invoice-level and line-level **discount fields** (choice of % or fixed amount) — all editable at invoice-entry time regardless of defaults. A setting toggles whether line-level discounts are allowed at all, for owners who want tighter control. | Sales invoice screen, Customers master data |
| 5 | No partial payment mechanism | Receipt Voucher (سند قبض) and Payment Voucher (سند صرف) screens where the owner picks the customer/supplier, optionally links to one or more open invoices, and enters any amount (not forced to match the invoice total). Each invoice shows a live **"المتبقي / Balance Due"** that updates as vouchers are applied. | Accounting module (§3.7) |
| 6 | Permissions too generic | Settings → "الأدوار والصلاحيات": a matrix UI (modules as rows, View/Add/Edit/Delete as columns, checkboxes) that the master admin edits per role or per individual user. Roles are just named presets (e.g. "محاسب", "مندوب مبيعات") the owner can create/rename/delete freely — not fixed in code. | Auth & Authorization (§3.1) |
| 7 | No low-stock alerting | Each item has an editable **"حد إعادة الطلب"** (reorder level) field, plus a global setting for whether alerts show as dashboard banners, a badge count, or (later) notifications. | Inventory module (§3.4), Dashboard |
| 8 | No batch/expiry tracking | Global setting: **"تفعيل تتبع تاريخ الصلاحية"** per item type (owner may want it for raw chemicals but not for stickers/caps). When enabled, production batch entry requires a batch number + optional expiry date, and reports can filter/flag near-expiry stock. | Manufacturing (§3.3), Inventory (§3.4) |
| 9 | Single vs multi-warehouse | Warehouses are a normal master-data list (add/rename/deactivate) from day one; a setting **"استخدام أكثر من مخزن"** just controls whether the warehouse picker appears on every screen or is hidden/defaulted when the owner only has one. No code change needed to add a second warehouse later. | Master Data (§3.2), all stock/invoice screens |
| 10 | Printing/export needs | Settings → "طباعة وتصدير": upload a logo, edit company name/address/tax number shown on printed invoices, choose default print size (A4 / thermal receipt), toggle PDF/Excel export buttons on report and invoice screens. | All invoice & report screens |
| 11 | No audit trail | Always-on by default (not optional, for financial integrity), but Settings lets the owner choose **retention period** and who (which roles) can view the Audit Log screen. | System-wide, Settings module |
| 12 | Offline vs cached-only ambiguity | Confirmed with client as **full offline-first** (create/edit data with no internet, auto-sync on reconnect) — see §5. A Settings toggle lets the owner see **sync history** (what was pushed, when, by whom) for troubleshooting. | Offline/PWA layer (§5) |

**Implementation note:** back this with a single flexible `settings` table (key/value pairs, scoped globally or per-warehouse where relevant) plus the specific structured tables noted in each row (e.g. `item.reorder_level`, `item.expiry_tracking_enabled`, `roles`/`role_permissions`, `price_lists`). Avoid hardcoding any of the above as constants in the frontend code — every one of them must be readable/writable through a Settings screen so the business owner is never blocked waiting on a developer to change a number or toggle a behavior.

---

## 3. Functional Modules

### 3.1 Authentication & Authorization
- Supabase Auth (email/password), master admin account created first
- Master admin creates sub-users, assigns a role or custom permission set
- Permission matrix: per module (Sales, Purchases, Inventory, Manufacturing, Accounting, HR/Payroll, Attendance, Reports, Settings) × per action (View/Add/Edit/Delete)
- Session must work both online and offline (cached auth token, revalidate on reconnect)
- Enforce permissions both in UI (hide/disable) AND in Supabase Row Level Security policies (never trust frontend-only checks)

### 3.2 Master Data
- **Items/Products**: type = Raw Material / Packaging Material / Intermediate (bulk liquid) / Finished Good
- **Units of Measure** with conversion table (kg ↔ g, liter ↔ ml, piece)
- **BOM/Recipe management**:
  - Batch recipe: list of raw materials + % or quantity per batch size, output = intermediate liquid quantity
  - Finished good BOM: quantity of intermediate liquid + packaging components per 1 unit
  - Editable per product, supports adding new products with their own recipes without code change
- **Customers** (name, phone, address, opening balance, credit limit optional)
- **Suppliers** (same structure)
- **Warehouses**
- **Chart of Accounts** (Cash, Bank(s), Capital, Fixed Assets, AR, AP, Revenue, COGS, Expenses categories)
- **Employees** (name, role, salary structure, join date)

### 3.3 Manufacturing / Production
- Create a **Production Order**: select product + batch recipe → system calculates required raw materials automatically from recipe × batch multiplier
- On confirmation: deduct raw materials from stock, add produced quantity of intermediate liquid to stock, assign batch number + date
- **Filling/Packaging Order**: convert intermediate liquid + packaging components into finished goods (deduct liquid + packaging stock, add finished goods stock)
- Real production cost = (raw materials cost + packaging cost + optional labor/overhead allocation) ÷ units produced, accounting for waste %
- View production history per batch number

### 3.4 Inventory Management
- Real-time stock levels per item per warehouse
- Stock movements log: Purchase In, Sale Out, Production Consumption, Production Output, Sales Return In, Purchase Return Out, Manual Adjustment, Transfer
- **Item Card (كارت صنف)**: full movement history for any item within a chosen date range — every invoice/production event that touched it, running balance
- Reorder level alerts

### 3.5 Sales
- Sales Invoice: customer, date, invoice number (auto-sequenced), payment method (Cash/Credit/Bank Transfer), line items (item, qty, unit price, discount), auto-calculated subtotal/tax/total
- On save: deduct finished goods stock, update customer balance
- Sales Return: linked to original invoice or standalone, reverses stock and balance
- Customer Statement of Account: filterable by date range, shows every invoice/return/payment, running balance, opening/closing balance

### 3.6 Purchases
- Purchase Invoice: supplier, date, items (raw materials/packaging), cost per unit, payment method
- On save: increase raw material/packaging stock, update supplier balance
- Purchase Return: reverses stock and balance
- Supplier Statement of Account: same structure as customer statement

### 3.7 Accounting & Finance
- Cash account & Bank account(s) ledgers
- Receipt Vouchers (سند قبض) — collect from customer, can be applied against specific invoice(s) or as general payment
- Payment Vouchers (سند صرف) — pay to supplier
- Fixed Assets register (name, value, purchase date, optional depreciation)
- Capital account
- Expenses module: category + amount + date + linked cash/bank account
- Real-time "actual capital / liquidity" dashboard: Cash + Bank + AR - AP + Inventory value - Fixed liabilities

### 3.8 Payroll & Attendance
- Employee salary structure (base salary, allowances, deductions)
- Monthly payroll run generates expense entries
- Attendance: check-in/check-out per employee per day (manual entry or simple time clock UI), monthly attendance summary feeding into payroll (absence deductions optional)

### 3.9 Settings (الإعدادات) — controls everything in Section 2
- Access restricted to master admin / users with Settings permission
- Sub-sections: General (company info, logo, VAT toggle/default %), Roles & Permissions (matrix editor), Warehouses (list + multi-warehouse toggle), Pricing (per-customer price lists, discount rules toggle), Inventory (per-item reorder level, expiry-tracking toggle by item type), Printing & Export (invoice template, print size, PDF/Excel toggles), Audit Log (retention period, viewer roles), Sync (offline sync history/status)
- Every field here is read/write through the UI — nothing in this list should be a hardcoded constant in the codebase

### 3.10 Reports (all filterable by custom date range / month / quarter)
- Profit & Loss statement
- Accounts Receivable / Accounts Payable aging (دائنون / مدينون)
- Inventory valuation report
- Production cost report per batch
- Cash flow / liquidity summary
- Sales by customer / by product
- Item Card report (per item, date range)

---

## 4. Suggested Database Schema (Supabase / PostgreSQL)

High-level tables (add columns as needed; all tables get `created_at`, `created_by`, `updated_at`):

```
users, roles, permissions, role_permissions
customers, suppliers, warehouses
units, unit_conversions
settings (key, value, scope: global|warehouse, scope_id) -- generic key/value store backing Section 2 toggles (vat_enabled, default_vat_pct, multi_warehouse_enabled, discount_lines_enabled, audit_log_retention_days, etc.)
items (type: raw_material | packaging | intermediate | finished_good, reorder_level, uom_id, expiry_tracking_enabled, default_price)
price_lists (customer_id, item_id, price) -- optional per-customer price overrides
item_recipes (parent_item_id, component_item_id, quantity_or_percentage, recipe_type: batch|packaging, mode: percentage|fixed_qty)
production_batches (batch_no, item_id, planned_qty, actual_qty, expected_waste_pct, actual_waste_pct, expiry_date, status, produced_at)
production_consumptions (batch_id, raw_item_id, qty_consumed)
stock_movements (item_id, warehouse_id, batch_no, movement_type, qty, ref_table, ref_id, moved_at)
sales_invoices (invoice_no, customer_id, date, payment_method, subtotal, discount, tax, total, status)
sales_invoice_lines (invoice_id, item_id, qty, unit_price, discount, line_total)
sales_returns (return_no, invoice_id, customer_id, date, total)
sales_return_lines (...)
purchase_invoices (invoice_no, supplier_id, date, payment_method, total)
purchase_invoice_lines (...)
purchase_returns / purchase_return_lines (...)
receipt_vouchers (customer_id, invoice_id (nullable), amount, date, account_id)
payment_vouchers (supplier_id, invoice_id (nullable), amount, date, account_id)
accounts (chart of accounts: cash, bank, capital, fixed_assets, revenue, expense categories)
account_transactions (account_id, ref_table, ref_id, debit, credit, date)
fixed_assets (name, value, purchase_date, depreciation_rate)
expenses (category, amount, date, account_id, notes)
employees (name, role, base_salary, join_date)
attendance (employee_id, date, check_in, check_out)
payroll_runs (month, employee_id, base, allowances, deductions, net_pay)
audit_log (user_id, table_name, record_id, action, old_value, new_value, timestamp)
```

Enforce **Row Level Security (RLS)** on every table based on the permission matrix — never rely solely on frontend checks.

---

## 5. Offline-First Strategy (Critical Technical Requirement)

Since the client needs full functionality with or without internet, on mobile or laptop:

1. Build the frontend as a **Progressive Web App (PWA)** — installable, works offline via Service Worker.
2. Use a local-first data layer (e.g., IndexedDB via a library like Dexie.js, or Supabase's local cache) to store master data + recent transactions on-device.
3. Writes made offline (new invoice, stock movement, etc.) queue locally with a unique client-generated UUID and a `synced: false` flag.
4. On reconnect, a sync engine pushes queued writes to Supabase in order, then pulls latest server state.
5. **Conflict resolution**: since invoice numbers and stock levels are sensitive, use server-side sequence generation confirmed only after sync (show invoices as "Pending Sync" until confirmed) to avoid duplicate invoice numbers or double stock deduction.
6. Clearly show sync status in the UI (Online / Offline / Syncing / X items pending).

This is the most technically demanding part of the project — treat it as its own implementation phase, and test thoroughly with airplane-mode scenarios (create invoice offline → reconnect → verify stock & balances match).

---

## 6. UI/UX Requirements

- Full Arabic RTL layout, Arabic labels/messages/reports/error messages throughout
- Modern, clean dashboard with cards showing: today's sales, cash & bank balance, low stock alerts, pending sync items
- Sidebar navigation grouped by module (المبيعات، المشتريات، المخزون، التصنيع، الحسابات، الموظفين، التقارير، الإعدادات)
- Data tables with search/filter/date-range pickers on every list screen
- Forms validate before submit (e.g., recipe percentages must total 100%, invoice must have at least one line)
- Mobile-responsive (client explicitly needs mobile + laptop access)
- Use a clean component library compatible with RTL (e.g., MUI or Chakra with RTL plugin, or Tailwind with `dir="rtl"` + a component kit)

---

## 7. Implementation Phases

**Phase 1 — Foundation**
- Supabase project setup, auth, roles/permissions schema, RLS policies
- React app scaffold, RTL layout, routing, base UI kit
- Master data screens: items, units, warehouses, customers, suppliers, chart of accounts

**Phase 2 — Inventory & Manufacturing**
- Recipe/BOM management UI
- Production batch flow (raw material consumption → intermediate output)
- Packaging/filling flow (intermediate + packaging → finished goods)
- Stock movement engine + Item Card report

**Phase 3 — Sales & Purchases**
- Sales invoices, returns, customer statements
- Purchase invoices, returns, supplier statements
- Receipt/payment vouchers, partial payment handling

**Phase 4 — Accounting & Reports**
- Cash/bank ledgers, fixed assets, capital
- P&L, AR/AP aging, liquidity dashboard, production cost reports
- PDF/Excel export, print layouts

**Phase 5 — HR**
- Employees, attendance, payroll run, expense linkage

**Phase 6 — Offline/PWA & Polish**
- Service worker, local cache, sync engine, conflict handling
- Audit log, low-stock alerts, final UI polish, testing

**Phase 7 — Deployment**
- Deploy to Vercel, connect Supabase production project, set up environment variables, final QA with real business data

---

## 8. Non-Functional Requirements
- All monetary calculations done with fixed-point/decimal precision (avoid float rounding errors) — use `numeric` type in Postgres
- Daily automated Supabase backups
- HTTPS everywhere (Vercel default)
- Rate limiting / basic protection on auth endpoints
- Environment-based config (dev/staging/prod) before going live with real financial data
