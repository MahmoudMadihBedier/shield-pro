-- ============================================================================
-- 0001_enable_rls.sql
--
-- Context: this repo had NO migrations at all — the live Supabase schema was
-- created by hand and every table currently has RLS disabled, so anyone
-- holding the public anon key (which ships inside the deployed frontend
-- bundle by design) can read and write every table with no login at all.
-- This migration:
--   1. Creates `user_locations` (used by the new GPS rep-tracking feature —
--      it didn't exist yet, which was silently breaking the offline sync
--      queue for any user with location tracking turned on).
--   2. Enables RLS on every table.
--   3. Adds policies that mirror the permission matrix the frontend already
--      enforces in the UI (modules x view/add/edit/delete), so the backend
--      actually enforces what the UI only pretended to enforce before.
--
-- Idempotent: safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

-- 1. Missing table for GPS tracking ------------------------------------------

create table if not exists public.user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists user_locations_user_id_recorded_at_idx
  on public.user_locations (user_id, recorded_at);

-- 2. Helper functions ---------------------------------------------------------
-- security definer so they can read users/role_permissions/permissions
-- regardless of the calling user's own row-level visibility into those tables.

create or replace function public.current_role_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select role_id from public.users where id = auth.uid();
$$;

create or replace function public.is_master_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_role_id()::text, '') = '88888888-8888-8888-8888-888888888888';
$$;

create or replace function public.has_permission(p_module text, p_action text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    public.is_master_admin()
    or exists (
      select 1
      from public.role_permissions rp
      join public.permissions p on p.id = rp.permission_id
      where rp.role_id::text = public.current_role_id()::text
        and p.module = p_module
        and p.action = p_action
    );
$$;

-- 3. Enable RLS on every table -------------------------------------------------

alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.warehouses enable row level security;
alter table public.units enable row level security;
alter table public.unit_conversions enable row level security;
alter table public.settings enable row level security;
alter table public.items enable row level security;
alter table public.price_lists enable row level security;
alter table public.item_recipes enable row level security;
alter table public.production_batches enable row level security;
alter table public.production_consumptions enable row level security;
alter table public.stock_movements enable row level security;
alter table public.sales_invoices enable row level security;
alter table public.sales_invoice_lines enable row level security;
alter table public.sales_returns enable row level security;
alter table public.sales_return_lines enable row level security;
alter table public.purchase_invoices enable row level security;
alter table public.purchase_invoice_lines enable row level security;
alter table public.purchase_returns enable row level security;
alter table public.purchase_return_lines enable row level security;
alter table public.receipt_vouchers enable row level security;
alter table public.payment_vouchers enable row level security;
alter table public.accounts enable row level security;
alter table public.account_transactions enable row level security;
alter table public.fixed_assets enable row level security;
alter table public.expenses enable row level security;
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.audit_log enable row level security;
alter table public.user_locations enable row level security;

-- 4. Policies -------------------------------------------------------------------
-- Pattern per business-data table: SELECT needs <module>:view, INSERT needs
-- <module>:add, UPDATE needs <module>:edit, DELETE needs <module>:delete.
-- Master Admin always passes (has_permission() bypasses internally).

-- users: readable by any logged-in user (the app needs this to list users,
-- and to safely count total users during first-signup bootstrap); a user may
-- always insert/update their OWN row (login profile creation, app-version /
-- last-seen heartbeat); broader mutation needs 'user_tracking' permission.
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated using (true);

drop policy if exists users_insert on public.users;
create policy users_insert on public.users for insert to authenticated
  with check (id = auth.uid() or public.has_permission('user_tracking', 'add'));

drop policy if exists users_update on public.users;
create policy users_update on public.users for update to authenticated
  using (id = auth.uid() or public.has_permission('user_tracking', 'edit'))
  with check (id = auth.uid() or public.has_permission('user_tracking', 'edit'));

drop policy if exists users_delete on public.users;
create policy users_delete on public.users for delete to authenticated
  using (public.has_permission('user_tracking', 'delete'));

-- roles / permissions / role_permissions: every logged-in user needs to read
-- these to build their own permission set at login; only 'settings' holders
-- (or Master Admin) can change them.
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles for select to authenticated using (true);
drop policy if exists roles_insert on public.roles;
create policy roles_insert on public.roles for insert to authenticated with check (public.has_permission('settings', 'add'));
drop policy if exists roles_update on public.roles;
create policy roles_update on public.roles for update to authenticated using (public.has_permission('settings', 'edit')) with check (public.has_permission('settings', 'edit'));
drop policy if exists roles_delete on public.roles;
create policy roles_delete on public.roles for delete to authenticated using (public.has_permission('settings', 'delete'));

drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions for select to authenticated using (true);
drop policy if exists permissions_insert on public.permissions;
create policy permissions_insert on public.permissions for insert to authenticated with check (public.has_permission('settings', 'add'));
drop policy if exists permissions_update on public.permissions;
create policy permissions_update on public.permissions for update to authenticated using (public.has_permission('settings', 'edit')) with check (public.has_permission('settings', 'edit'));
drop policy if exists permissions_delete on public.permissions;
create policy permissions_delete on public.permissions for delete to authenticated using (public.has_permission('settings', 'delete'));

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
drop policy if exists role_permissions_insert on public.role_permissions;
create policy role_permissions_insert on public.role_permissions for insert to authenticated with check (public.has_permission('settings', 'add'));
drop policy if exists role_permissions_update on public.role_permissions;
create policy role_permissions_update on public.role_permissions for update to authenticated using (public.has_permission('settings', 'edit')) with check (public.has_permission('settings', 'edit'));
drop policy if exists role_permissions_delete on public.role_permissions;
create policy role_permissions_delete on public.role_permissions for delete to authenticated using (public.has_permission('settings', 'delete'));

-- settings (key/value store): every logged-in user needs to read these
-- (VAT %, currency, print options, etc. are used all over the UI); only
-- 'settings' holders can change them.
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to authenticated using (true);
drop policy if exists settings_insert on public.settings;
create policy settings_insert on public.settings for insert to authenticated with check (public.has_permission('settings', 'add'));
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings for update to authenticated using (public.has_permission('settings', 'edit')) with check (public.has_permission('settings', 'edit'));
drop policy if exists settings_delete on public.settings;
create policy settings_delete on public.settings for delete to authenticated using (public.has_permission('settings', 'delete'));

-- audit_log: append-only from any logged-in user (every write across every
-- module auto-logs here); viewing is restricted to 'settings' holders per
-- the spec; no update/delete policy at all — audit history must stay immutable.
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated using (public.has_permission('settings', 'view'));
drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert to authenticated with check (true);

-- user_locations: a user can always insert their own location ping; viewing
-- is restricted to 'gps_tracking' holders (or the user's own history); no
-- update; delete restricted to 'gps_tracking' holders for retention cleanup.
drop policy if exists user_locations_select on public.user_locations;
create policy user_locations_select on public.user_locations for select to authenticated
  using (user_id = auth.uid() or public.has_permission('gps_tracking', 'view'));
drop policy if exists user_locations_insert on public.user_locations;
create policy user_locations_insert on public.user_locations for insert to authenticated
  with check (user_id = auth.uid() or public.has_permission('gps_tracking', 'add'));
drop policy if exists user_locations_delete on public.user_locations;
create policy user_locations_delete on public.user_locations for delete to authenticated
  using (public.has_permission('gps_tracking', 'delete'));

-- Generic per-module business-data tables ---------------------------------
-- helper macro pattern repeated per table: view/add/edit/delete on <module>

-- sales
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select to authenticated using (public.has_permission('sales', 'view'));
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated with check (public.has_permission('sales', 'add'));
drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers for update to authenticated using (public.has_permission('sales', 'edit')) with check (public.has_permission('sales', 'edit'));
drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers for delete to authenticated using (public.has_permission('sales', 'delete'));

drop policy if exists sales_invoices_select on public.sales_invoices;
create policy sales_invoices_select on public.sales_invoices for select to authenticated using (public.has_permission('sales', 'view'));
drop policy if exists sales_invoices_insert on public.sales_invoices;
create policy sales_invoices_insert on public.sales_invoices for insert to authenticated with check (public.has_permission('sales', 'add'));
drop policy if exists sales_invoices_update on public.sales_invoices;
create policy sales_invoices_update on public.sales_invoices for update to authenticated using (public.has_permission('sales', 'edit')) with check (public.has_permission('sales', 'edit'));
drop policy if exists sales_invoices_delete on public.sales_invoices;
create policy sales_invoices_delete on public.sales_invoices for delete to authenticated using (public.has_permission('sales', 'delete'));

drop policy if exists sales_invoice_lines_select on public.sales_invoice_lines;
create policy sales_invoice_lines_select on public.sales_invoice_lines for select to authenticated using (public.has_permission('sales', 'view'));
drop policy if exists sales_invoice_lines_insert on public.sales_invoice_lines;
create policy sales_invoice_lines_insert on public.sales_invoice_lines for insert to authenticated with check (public.has_permission('sales', 'add'));
drop policy if exists sales_invoice_lines_update on public.sales_invoice_lines;
create policy sales_invoice_lines_update on public.sales_invoice_lines for update to authenticated using (public.has_permission('sales', 'edit')) with check (public.has_permission('sales', 'edit'));
drop policy if exists sales_invoice_lines_delete on public.sales_invoice_lines;
create policy sales_invoice_lines_delete on public.sales_invoice_lines for delete to authenticated using (public.has_permission('sales', 'delete'));

drop policy if exists sales_returns_select on public.sales_returns;
create policy sales_returns_select on public.sales_returns for select to authenticated using (public.has_permission('sales', 'view'));
drop policy if exists sales_returns_insert on public.sales_returns;
create policy sales_returns_insert on public.sales_returns for insert to authenticated with check (public.has_permission('sales', 'add'));
drop policy if exists sales_returns_update on public.sales_returns;
create policy sales_returns_update on public.sales_returns for update to authenticated using (public.has_permission('sales', 'edit')) with check (public.has_permission('sales', 'edit'));
drop policy if exists sales_returns_delete on public.sales_returns;
create policy sales_returns_delete on public.sales_returns for delete to authenticated using (public.has_permission('sales', 'delete'));

drop policy if exists sales_return_lines_select on public.sales_return_lines;
create policy sales_return_lines_select on public.sales_return_lines for select to authenticated using (public.has_permission('sales', 'view'));
drop policy if exists sales_return_lines_insert on public.sales_return_lines;
create policy sales_return_lines_insert on public.sales_return_lines for insert to authenticated with check (public.has_permission('sales', 'add'));
drop policy if exists sales_return_lines_update on public.sales_return_lines;
create policy sales_return_lines_update on public.sales_return_lines for update to authenticated using (public.has_permission('sales', 'edit')) with check (public.has_permission('sales', 'edit'));
drop policy if exists sales_return_lines_delete on public.sales_return_lines;
create policy sales_return_lines_delete on public.sales_return_lines for delete to authenticated using (public.has_permission('sales', 'delete'));

drop policy if exists receipt_vouchers_select on public.receipt_vouchers;
create policy receipt_vouchers_select on public.receipt_vouchers for select to authenticated using (public.has_permission('sales', 'view'));
drop policy if exists receipt_vouchers_insert on public.receipt_vouchers;
create policy receipt_vouchers_insert on public.receipt_vouchers for insert to authenticated with check (public.has_permission('sales', 'add'));
drop policy if exists receipt_vouchers_update on public.receipt_vouchers;
create policy receipt_vouchers_update on public.receipt_vouchers for update to authenticated using (public.has_permission('sales', 'edit')) with check (public.has_permission('sales', 'edit'));
drop policy if exists receipt_vouchers_delete on public.receipt_vouchers;
create policy receipt_vouchers_delete on public.receipt_vouchers for delete to authenticated using (public.has_permission('sales', 'delete'));

-- purchases
drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers for select to authenticated using (public.has_permission('purchases', 'view'));
drop policy if exists suppliers_insert on public.suppliers;
create policy suppliers_insert on public.suppliers for insert to authenticated with check (public.has_permission('purchases', 'add'));
drop policy if exists suppliers_update on public.suppliers;
create policy suppliers_update on public.suppliers for update to authenticated using (public.has_permission('purchases', 'edit')) with check (public.has_permission('purchases', 'edit'));
drop policy if exists suppliers_delete on public.suppliers;
create policy suppliers_delete on public.suppliers for delete to authenticated using (public.has_permission('purchases', 'delete'));

drop policy if exists purchase_invoices_select on public.purchase_invoices;
create policy purchase_invoices_select on public.purchase_invoices for select to authenticated using (public.has_permission('purchases', 'view'));
drop policy if exists purchase_invoices_insert on public.purchase_invoices;
create policy purchase_invoices_insert on public.purchase_invoices for insert to authenticated with check (public.has_permission('purchases', 'add'));
drop policy if exists purchase_invoices_update on public.purchase_invoices;
create policy purchase_invoices_update on public.purchase_invoices for update to authenticated using (public.has_permission('purchases', 'edit')) with check (public.has_permission('purchases', 'edit'));
drop policy if exists purchase_invoices_delete on public.purchase_invoices;
create policy purchase_invoices_delete on public.purchase_invoices for delete to authenticated using (public.has_permission('purchases', 'delete'));

drop policy if exists purchase_invoice_lines_select on public.purchase_invoice_lines;
create policy purchase_invoice_lines_select on public.purchase_invoice_lines for select to authenticated using (public.has_permission('purchases', 'view'));
drop policy if exists purchase_invoice_lines_insert on public.purchase_invoice_lines;
create policy purchase_invoice_lines_insert on public.purchase_invoice_lines for insert to authenticated with check (public.has_permission('purchases', 'add'));
drop policy if exists purchase_invoice_lines_update on public.purchase_invoice_lines;
create policy purchase_invoice_lines_update on public.purchase_invoice_lines for update to authenticated using (public.has_permission('purchases', 'edit')) with check (public.has_permission('purchases', 'edit'));
drop policy if exists purchase_invoice_lines_delete on public.purchase_invoice_lines;
create policy purchase_invoice_lines_delete on public.purchase_invoice_lines for delete to authenticated using (public.has_permission('purchases', 'delete'));

drop policy if exists purchase_returns_select on public.purchase_returns;
create policy purchase_returns_select on public.purchase_returns for select to authenticated using (public.has_permission('purchases', 'view'));
drop policy if exists purchase_returns_insert on public.purchase_returns;
create policy purchase_returns_insert on public.purchase_returns for insert to authenticated with check (public.has_permission('purchases', 'add'));
drop policy if exists purchase_returns_update on public.purchase_returns;
create policy purchase_returns_update on public.purchase_returns for update to authenticated using (public.has_permission('purchases', 'edit')) with check (public.has_permission('purchases', 'edit'));
drop policy if exists purchase_returns_delete on public.purchase_returns;
create policy purchase_returns_delete on public.purchase_returns for delete to authenticated using (public.has_permission('purchases', 'delete'));

drop policy if exists purchase_return_lines_select on public.purchase_return_lines;
create policy purchase_return_lines_select on public.purchase_return_lines for select to authenticated using (public.has_permission('purchases', 'view'));
drop policy if exists purchase_return_lines_insert on public.purchase_return_lines;
create policy purchase_return_lines_insert on public.purchase_return_lines for insert to authenticated with check (public.has_permission('purchases', 'add'));
drop policy if exists purchase_return_lines_update on public.purchase_return_lines;
create policy purchase_return_lines_update on public.purchase_return_lines for update to authenticated using (public.has_permission('purchases', 'edit')) with check (public.has_permission('purchases', 'edit'));
drop policy if exists purchase_return_lines_delete on public.purchase_return_lines;
create policy purchase_return_lines_delete on public.purchase_return_lines for delete to authenticated using (public.has_permission('purchases', 'delete'));

drop policy if exists payment_vouchers_select on public.payment_vouchers;
create policy payment_vouchers_select on public.payment_vouchers for select to authenticated using (public.has_permission('purchases', 'view'));
drop policy if exists payment_vouchers_insert on public.payment_vouchers;
create policy payment_vouchers_insert on public.payment_vouchers for insert to authenticated with check (public.has_permission('purchases', 'add'));
drop policy if exists payment_vouchers_update on public.payment_vouchers;
create policy payment_vouchers_update on public.payment_vouchers for update to authenticated using (public.has_permission('purchases', 'edit')) with check (public.has_permission('purchases', 'edit'));
drop policy if exists payment_vouchers_delete on public.payment_vouchers;
create policy payment_vouchers_delete on public.payment_vouchers for delete to authenticated using (public.has_permission('purchases', 'delete'));

-- inventory
drop policy if exists items_select on public.items;
create policy items_select on public.items for select to authenticated using (public.has_permission('inventory', 'view'));
drop policy if exists items_insert on public.items;
create policy items_insert on public.items for insert to authenticated with check (public.has_permission('inventory', 'add'));
drop policy if exists items_update on public.items;
create policy items_update on public.items for update to authenticated using (public.has_permission('inventory', 'edit')) with check (public.has_permission('inventory', 'edit'));
drop policy if exists items_delete on public.items;
create policy items_delete on public.items for delete to authenticated using (public.has_permission('inventory', 'delete'));

drop policy if exists warehouses_select on public.warehouses;
create policy warehouses_select on public.warehouses for select to authenticated using (public.has_permission('inventory', 'view'));
drop policy if exists warehouses_insert on public.warehouses;
create policy warehouses_insert on public.warehouses for insert to authenticated with check (public.has_permission('inventory', 'add'));
drop policy if exists warehouses_update on public.warehouses;
create policy warehouses_update on public.warehouses for update to authenticated using (public.has_permission('inventory', 'edit')) with check (public.has_permission('inventory', 'edit'));
drop policy if exists warehouses_delete on public.warehouses;
create policy warehouses_delete on public.warehouses for delete to authenticated using (public.has_permission('inventory', 'delete'));

drop policy if exists units_select on public.units;
create policy units_select on public.units for select to authenticated using (public.has_permission('inventory', 'view'));
drop policy if exists units_insert on public.units;
create policy units_insert on public.units for insert to authenticated with check (public.has_permission('inventory', 'add'));
drop policy if exists units_update on public.units;
create policy units_update on public.units for update to authenticated using (public.has_permission('inventory', 'edit')) with check (public.has_permission('inventory', 'edit'));
drop policy if exists units_delete on public.units;
create policy units_delete on public.units for delete to authenticated using (public.has_permission('inventory', 'delete'));

drop policy if exists unit_conversions_select on public.unit_conversions;
create policy unit_conversions_select on public.unit_conversions for select to authenticated using (public.has_permission('inventory', 'view'));
drop policy if exists unit_conversions_insert on public.unit_conversions;
create policy unit_conversions_insert on public.unit_conversions for insert to authenticated with check (public.has_permission('inventory', 'add'));
drop policy if exists unit_conversions_update on public.unit_conversions;
create policy unit_conversions_update on public.unit_conversions for update to authenticated using (public.has_permission('inventory', 'edit')) with check (public.has_permission('inventory', 'edit'));
drop policy if exists unit_conversions_delete on public.unit_conversions;
create policy unit_conversions_delete on public.unit_conversions for delete to authenticated using (public.has_permission('inventory', 'delete'));

drop policy if exists price_lists_select on public.price_lists;
create policy price_lists_select on public.price_lists for select to authenticated using (public.has_permission('inventory', 'view'));
drop policy if exists price_lists_insert on public.price_lists;
create policy price_lists_insert on public.price_lists for insert to authenticated with check (public.has_permission('inventory', 'add'));
drop policy if exists price_lists_update on public.price_lists;
create policy price_lists_update on public.price_lists for update to authenticated using (public.has_permission('inventory', 'edit')) with check (public.has_permission('inventory', 'edit'));
drop policy if exists price_lists_delete on public.price_lists;
create policy price_lists_delete on public.price_lists for delete to authenticated using (public.has_permission('inventory', 'delete'));

drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select to authenticated using (public.has_permission('inventory', 'view'));
drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_insert on public.stock_movements for insert to authenticated with check (
  public.has_permission('inventory', 'add') or public.has_permission('sales', 'add') or
  public.has_permission('purchases', 'add') or public.has_permission('manufacturing', 'add')
);
drop policy if exists stock_movements_update on public.stock_movements;
create policy stock_movements_update on public.stock_movements for update to authenticated using (public.has_permission('inventory', 'edit')) with check (public.has_permission('inventory', 'edit'));
drop policy if exists stock_movements_delete on public.stock_movements;
create policy stock_movements_delete on public.stock_movements for delete to authenticated using (public.has_permission('inventory', 'delete'));

-- manufacturing
drop policy if exists item_recipes_select on public.item_recipes;
create policy item_recipes_select on public.item_recipes for select to authenticated using (public.has_permission('manufacturing', 'view'));
drop policy if exists item_recipes_insert on public.item_recipes;
create policy item_recipes_insert on public.item_recipes for insert to authenticated with check (public.has_permission('manufacturing', 'add'));
drop policy if exists item_recipes_update on public.item_recipes;
create policy item_recipes_update on public.item_recipes for update to authenticated using (public.has_permission('manufacturing', 'edit')) with check (public.has_permission('manufacturing', 'edit'));
drop policy if exists item_recipes_delete on public.item_recipes;
create policy item_recipes_delete on public.item_recipes for delete to authenticated using (public.has_permission('manufacturing', 'delete'));

drop policy if exists production_batches_select on public.production_batches;
create policy production_batches_select on public.production_batches for select to authenticated using (public.has_permission('manufacturing', 'view'));
drop policy if exists production_batches_insert on public.production_batches;
create policy production_batches_insert on public.production_batches for insert to authenticated with check (public.has_permission('manufacturing', 'add'));
drop policy if exists production_batches_update on public.production_batches;
create policy production_batches_update on public.production_batches for update to authenticated using (public.has_permission('manufacturing', 'edit')) with check (public.has_permission('manufacturing', 'edit'));
drop policy if exists production_batches_delete on public.production_batches;
create policy production_batches_delete on public.production_batches for delete to authenticated using (public.has_permission('manufacturing', 'delete'));

drop policy if exists production_consumptions_select on public.production_consumptions;
create policy production_consumptions_select on public.production_consumptions for select to authenticated using (public.has_permission('manufacturing', 'view'));
drop policy if exists production_consumptions_insert on public.production_consumptions;
create policy production_consumptions_insert on public.production_consumptions for insert to authenticated with check (public.has_permission('manufacturing', 'add'));
drop policy if exists production_consumptions_update on public.production_consumptions;
create policy production_consumptions_update on public.production_consumptions for update to authenticated using (public.has_permission('manufacturing', 'edit')) with check (public.has_permission('manufacturing', 'edit'));
drop policy if exists production_consumptions_delete on public.production_consumptions;
create policy production_consumptions_delete on public.production_consumptions for delete to authenticated using (public.has_permission('manufacturing', 'delete'));

-- accounting
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts for select to authenticated using (public.has_permission('accounting', 'view'));
drop policy if exists accounts_insert on public.accounts;
create policy accounts_insert on public.accounts for insert to authenticated with check (public.has_permission('accounting', 'add'));
drop policy if exists accounts_update on public.accounts;
create policy accounts_update on public.accounts for update to authenticated using (public.has_permission('accounting', 'edit')) with check (public.has_permission('accounting', 'edit'));
drop policy if exists accounts_delete on public.accounts;
create policy accounts_delete on public.accounts for delete to authenticated using (public.has_permission('accounting', 'delete'));

drop policy if exists account_transactions_select on public.account_transactions;
create policy account_transactions_select on public.account_transactions for select to authenticated using (public.has_permission('accounting', 'view'));
drop policy if exists account_transactions_insert on public.account_transactions;
create policy account_transactions_insert on public.account_transactions for insert to authenticated with check (
  public.has_permission('accounting', 'add') or public.has_permission('sales', 'add') or public.has_permission('purchases', 'add')
);
drop policy if exists account_transactions_update on public.account_transactions;
create policy account_transactions_update on public.account_transactions for update to authenticated using (public.has_permission('accounting', 'edit')) with check (public.has_permission('accounting', 'edit'));
drop policy if exists account_transactions_delete on public.account_transactions;
create policy account_transactions_delete on public.account_transactions for delete to authenticated using (public.has_permission('accounting', 'delete'));

drop policy if exists fixed_assets_select on public.fixed_assets;
create policy fixed_assets_select on public.fixed_assets for select to authenticated using (public.has_permission('accounting', 'view'));
drop policy if exists fixed_assets_insert on public.fixed_assets;
create policy fixed_assets_insert on public.fixed_assets for insert to authenticated with check (public.has_permission('accounting', 'add'));
drop policy if exists fixed_assets_update on public.fixed_assets;
create policy fixed_assets_update on public.fixed_assets for update to authenticated using (public.has_permission('accounting', 'edit')) with check (public.has_permission('accounting', 'edit'));
drop policy if exists fixed_assets_delete on public.fixed_assets;
create policy fixed_assets_delete on public.fixed_assets for delete to authenticated using (public.has_permission('accounting', 'delete'));

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated using (public.has_permission('accounting', 'view'));
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated with check (public.has_permission('accounting', 'add'));
drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated using (public.has_permission('accounting', 'edit')) with check (public.has_permission('accounting', 'edit'));
drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete to authenticated using (public.has_permission('accounting', 'delete'));

-- hr
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select to authenticated using (public.has_permission('hr', 'view'));
drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees for insert to authenticated with check (public.has_permission('hr', 'add'));
drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees for update to authenticated using (public.has_permission('hr', 'edit')) with check (public.has_permission('hr', 'edit'));
drop policy if exists employees_delete on public.employees;
create policy employees_delete on public.employees for delete to authenticated using (public.has_permission('hr', 'delete'));

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select to authenticated using (public.has_permission('hr', 'view'));
drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance for insert to authenticated with check (public.has_permission('hr', 'add'));
drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance for update to authenticated using (public.has_permission('hr', 'edit')) with check (public.has_permission('hr', 'edit'));
drop policy if exists attendance_delete on public.attendance;
create policy attendance_delete on public.attendance for delete to authenticated using (public.has_permission('hr', 'delete'));

drop policy if exists payroll_runs_select on public.payroll_runs;
create policy payroll_runs_select on public.payroll_runs for select to authenticated using (public.has_permission('hr', 'view'));
drop policy if exists payroll_runs_insert on public.payroll_runs;
create policy payroll_runs_insert on public.payroll_runs for insert to authenticated with check (public.has_permission('hr', 'add'));
drop policy if exists payroll_runs_update on public.payroll_runs;
create policy payroll_runs_update on public.payroll_runs for update to authenticated using (public.has_permission('hr', 'edit')) with check (public.has_permission('hr', 'edit'));
drop policy if exists payroll_runs_delete on public.payroll_runs;
create policy payroll_runs_delete on public.payroll_runs for delete to authenticated using (public.has_permission('hr', 'delete'));
