-- ============================================================================
-- 0004_crm_client_portal_integration.sql
--
-- Complete CRM Client Portal Integration for ERP System
--
-- This migration enables:
-- 1. Client authentication with unique client IDs
-- 2. Client portal access to orders, invoices, deliveries
-- 3. Order request workflow from CRM to ERP
-- 4. Client-specific financial views
-- 5. Enhanced delivery tracking
-- 6. Real-time order notifications
-- 7. Comprehensive RLS policies for client data isolation
-- ============================================================================

-- 0. Create CRM tables if they don't exist ------------------------------------

-- CRM Orders table for client order requests
create table if not exists public.crm_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  client_id text references public.customers(client_id) on delete set null,
  order_number text unique,
  customer_reference text,
  order_date timestamptz not null default now(),
  requested_delivery_date date,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  priority text default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  payment_method text default 'credit' check (payment_method in ('credit', 'cash', 'bank_transfer', 'online')),
  payment_status text default 'pending' check (payment_status in ('pending', 'paid', 'partial', 'overdue')),
  total_amount numeric not null default 0,
  internal_notes text,
  delivery_address text,
  converted_to_invoice_id uuid references public.sales_invoices(id) on delete set null,
  converted_at timestamptz,
  converted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CRM Order Lines table
create table if not exists public.crm_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.crm_orders(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  item_name text,
  item_sku text,
  qty numeric not null,
  unit_price numeric not null,
  discount_percent numeric default 0,
  discount_amount numeric default 0,
  tax_amount numeric default 0,
  tax_rate numeric default 0,
  line_total numeric not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deliveries table for tracking order deliveries
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.crm_orders(id) on delete set null,
  tracking_number text unique,
  status text not null default 'pending' check (status in ('pending', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
  carrier text,
  estimated_delivery_date date,
  actual_delivery_date timestamptz,
  delivery_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Client Notifications table
create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  type text not null check (type in ('order_status', 'delivery_update', 'payment', 'promotion', 'system')),
  title text not null,
  message text not null,
  data jsonb,
  read boolean default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Create indexes for performance
create index if not exists crm_orders_customer_id_idx on public.crm_orders(customer_id);
create index if not exists crm_orders_status_idx on public.crm_orders(status);
create index if not exists crm_orders_order_date_idx on public.crm_orders(order_date);
create index if not exists crm_order_lines_order_id_idx on public.crm_order_lines(order_id);
create index if not exists crm_order_lines_item_id_idx on public.crm_order_lines(item_id);
create index if not exists deliveries_order_id_idx on public.deliveries(order_id);
create index if not exists deliveries_status_idx on public.deliveries(status);
create index if not exists client_notifications_customer_id_idx on public.client_notifications(customer_id);
create index if not exists client_notifications_read_idx on public.client_notifications(read);

-- Enable RLS on CRM tables
alter table public.crm_orders enable row level security;
alter table public.crm_order_lines enable row level security;
alter table public.deliveries enable row level security;
alter table public.client_notifications enable row level security;

-- 1. Client Authentication System ----------------------------------------------

-- Add unique client_id to customers table (public-facing identifier)
alter table public.customers 
  add column if not exists client_id text unique;

-- Add client portal specific fields
alter table public.customers
  add column if not exists company_name text,
  add column if not exists tax_id text,
  add column if not exists website text,
  add column if not exists is_active boolean default true,
  add column if not exists credit_status text default 'good' check (credit_status in ('good', 'warning', 'blocked')),
  add column if not exists last_order_date date,
  add column if not exists total_orders integer default 0,
  add column if not exists total_purchased numeric default 0;

-- Create client portal role for customer users
insert into public.roles (id, name) 
values (
  gen_random_uuid(),
  'client_portal'
) on conflict (name) do nothing;

-- Add CRM-specific permissions
insert into public.permissions (module, action) values
  ('crm_portal', 'view'),
  ('crm_portal', 'order'),
  ('crm_portal', 'track_delivery'),
  ('crm_portal', 'view_invoices'),
  ('crm_portal', 'view_payments')
on conflict do nothing;

-- Assign permissions to client_portal role
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'client_portal' and p.module = 'crm_portal'
on conflict do nothing;

-- Add password reset and verification fields to users
alter table public.users
  add column if not exists phone_verified boolean default false,
  add column if not exists email_verified boolean default false,
  add column if not exists reset_token text,
  add column if not exists reset_token_expires timestamptz,
  add column if not exists verification_token text,
  add column if not exists verification_token_expires timestamptz;

-- 2. Enhanced CRM Orders and ERP Integration ---------------------------------

-- Note: Tables were created in section 0 with all required columns
-- These ALTER TABLE statements are kept for backward compatibility with existing databases
-- where tables may already exist without these columns

-- Enhance crm_orders table for better workflow (if columns don't exist)
alter table public.crm_orders
  add column if not exists client_id text references public.customers(client_id),
  add column if not exists order_number text unique,
  add column if not exists customer_reference text,
  add column if not exists requested_delivery_date date,
  add column if not exists priority text default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists payment_method text default 'credit' check (payment_method in ('credit', 'cash', 'bank_transfer', 'online')),
  add column if not exists payment_status text default 'pending' check (payment_status in ('pending', 'paid', 'partial', 'overdue')),
  add column if not exists internal_notes text,
  add column if not exists converted_to_invoice_id uuid references public.sales_invoices(id),
  add column if not exists converted_at timestamptz,
  add column if not exists converted_by uuid references public.users(id);

-- Add indexes for performance (if they don't exist)
create index if not exists crm_orders_client_id_idx on public.crm_orders(client_id);
create index if not exists crm_orders_status_idx on public.crm_orders(status);
create index if not exists crm_orders_order_date_idx on public.crm_orders(order_date);

-- Enhance crm_order_lines (if columns don't exist)
alter table public.crm_order_lines
  add column if not exists item_name text, -- Store item name for historical reference
  add column if not exists item_sku text,
  add column if not exists discount_percent numeric default 0,
  add column if not exists discount_amount numeric default 0,
  add column if not exists tax_amount numeric default 0,
  add column if not exists tax_rate numeric default 0,
  add column if not exists notes text;

-- 3. Delivery Tracking Enhancement -------------------------------------------

-- Enhance deliveries table with client-facing information (if columns don't exist)
alter table public.deliveries
  add column if not exists order_id uuid references public.crm_orders(id),
  add column if not exists tracking_number text unique,
  add column if not exists estimated_delivery_date date,
  add column if not exists actual_delivery_date date,
  add column if not exists delivery_time_slot text,
  add column if not exists recipient_name text,
  add column if not exists recipient_phone text,
  add column if not exists delivery_instructions text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists signed_by text,
  add column if not exists delivery_photo_url text,
  add column if not exists driver_name text,
  add column if not exists driver_phone text;

-- Add delivery status tracking
alter table public.deliveries
  add column if not exists status_history jsonb default '[]'::jsonb;

-- Add indexes
create index if not exists deliveries_tracking_number_idx on public.deliveries(tracking_number);
create index if not exists deliveries_order_id_idx on public.deliveries(order_id);
create index if not exists deliveries_status_idx on public.deliveries(status);

-- 4. Client Notifications System --------------------------------------------

-- Create notifications table for real-time updates
create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  type text not null check (type in ('order_status', 'payment_received', 'delivery_update', 'invoice_generated', 'low_stock', 'promotion')),
  title text not null,
  message text not null,
  data jsonb default '{}'::jsonb,
  is_read boolean default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists client_notifications_customer_id_idx on public.client_notifications(customer_id);
create index if not exists client_notifications_is_read_idx on public.client_notifications(is_read);
create index if not exists client_notifications_type_idx on public.client_notifications(type);

-- 5. Client-Specific Financial Views ----------------------------------------

-- Create client financial summary view
create or replace view public.client_financial_summary as
select 
  c.id as customer_id,
  c.client_id,
  c.name as customer_name,
  c.opening_balance,
  c.credit_limit,
  coalesce(si.total_amount, 0) as total_invoiced,
  coalesce(rv.total_amount, 0) as total_paid,
  coalesce(si.total_amount, 0) - coalesce(rv.total_amount, 0) as current_balance,
  c.credit_status,
  c.last_order_date,
  c.total_orders,
  c.total_purchased
from public.customers c
left join (
  select customer_id, sum(total_amount) as total_amount
  from public.sales_invoices
  where status != 'cancelled'
  group by customer_id
) si on c.id = si.customer_id
left join (
  select customer_id, sum(amount) as total_amount
  from public.receipt_vouchers
  where status = 'posted'
  group by customer_id
) rv on c.id = rv.customer_id;

-- Create client order history view
create or replace view public.client_order_history as
select 
  co.id as order_id,
  co.order_number,
  co.client_id,
  c.name as customer_name,
  co.order_date,
  co.requested_delivery_date,
  co.status,
  co.total_amount,
  co.payment_status,
  co.priority,
  co.delivery_address,
  di.tracking_number,
  di.status as delivery_status,
  di.estimated_delivery_date,
  di.actual_delivery_date
from public.crm_orders co
join public.customers c on co.customer_id = c.id
left join public.deliveries di on di.order_id = co.id;

-- Create client invoice view
create or replace view public.client_invoices as
select 
  si.id as invoice_id,
  si.invoice_no,
  c.client_id,
  c.name as customer_name,
  si.invoice_date,
  si.due_date,
  si.total_amount,
  si.paid_amount,
  si.status,
  di.tracking_number,
  di.status as delivery_status
from public.sales_invoices si
join public.customers c on si.customer_id = c.id
left join public.deliveries di on di.invoice_id = si.id;

-- 6. Helper Functions for Client Portal -------------------------------------

-- Function to get current client ID from authenticated user
create or replace function public.current_client_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.customers where user_id = auth.uid() limit 1;
$$;

-- Function to generate unique client ID
create or replace function public.generate_client_id()
returns text
language sql volatile
set search_path = public
as $$
  select 'CLI-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));
$$;

-- Function to generate order number
create or replace function public.generate_crm_order_number()
returns text
language sql volatile
set search_path = public
as $$
  select 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
$$;

-- Function to generate tracking number
create or replace function public.generate_tracking_number()
returns text
language sql volatile
set search_path = public
as $$
  select 'TRK-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 12));
$$;

-- Trigger to auto-generate client_id
create or replace function public.auto_generate_client_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.client_id is null then
    new.client_id := public.generate_client_id();
  end if;
  return new;
end;
$$;

drop trigger if exists auto_generate_client_id on public.customers;
create trigger auto_generate_client_id
  before insert on public.customers
  for each row execute function public.auto_generate_client_id();

-- Trigger to auto-generate order number
create or replace function public.auto_generate_order_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.order_number is null then
    new.order_number := public.generate_crm_order_number();
  end if;
  return new;
end;
$$;

drop trigger if exists auto_generate_order_number on public.crm_orders;
create trigger auto_generate_order_number
  before insert on public.crm_orders
  for each row execute function public.auto_generate_order_number();

-- Trigger to auto-generate tracking number
create or replace function public.auto_generate_tracking_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tracking_number is null then
    new.tracking_number := public.generate_tracking_number();
  end if;
  return new;
end;
$$;

drop trigger if exists auto_generate_tracking_number on public.deliveries;
create trigger auto_generate_tracking_number
  before insert on public.deliveries
  for each row execute function public.auto_generate_tracking_number();

-- 7. Enhanced RLS Policies for Client Portal ---------------------------------

-- Customers: Clients can only see their own data
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select to authenticated
  using (
    id = public.current_client_id() or 
    public.has_permission('sales', 'view')
  );

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated 
  with check (public.has_permission('sales', 'add'));

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers for update to authenticated
  using (
    id = public.current_client_id() or 
    public.has_permission('sales', 'edit')
  )
  with check (
    id = public.current_client_id() or 
    public.has_permission('sales', 'edit')
  );

-- CRM Orders: Clients can see and create their own orders
drop policy if exists crm_orders_select on public.crm_orders;
create policy crm_orders_select on public.crm_orders for select to authenticated
  using (
    customer_id = public.current_client_id() or 
    public.has_permission('sales', 'view')
  );

drop policy if exists crm_orders_insert on public.crm_orders;
create policy crm_orders_insert on public.crm_orders for insert to authenticated
  with check (
    customer_id = public.current_client_id() or 
    public.has_permission('sales', 'add')
  );

drop policy if exists crm_orders_update on public.crm_orders;
create policy crm_orders_update on public.crm_orders for update to authenticated
  using (
    customer_id = public.current_client_id() or 
    public.has_permission('sales', 'edit')
  )
  with check (
    customer_id = public.current_client_id() or 
    public.has_permission('sales', 'edit')
  );

-- CRM Order Lines: Inherit order permissions
drop policy if exists crm_order_lines_select on public.crm_order_lines;
create policy crm_order_lines_select on public.crm_order_lines for select to authenticated
  using (
    exists (
      select 1 from public.crm_orders 
      where crm_orders.id = crm_order_lines.order_id 
      and crm_orders.customer_id = public.current_client_id()
    ) or public.has_permission('sales', 'view')
  );

drop policy if exists crm_order_lines_insert on public.crm_order_lines;
create policy crm_order_lines_insert on public.crm_order_lines for insert to authenticated
  with check (
    exists (
      select 1 from public.crm_orders 
      where crm_orders.id = crm_order_lines.order_id 
      and crm_orders.customer_id = public.current_client_id()
    ) or public.has_permission('sales', 'add')
  );

-- Deliveries: Clients can track their own deliveries
drop policy if exists deliveries_select on public.deliveries;
create policy deliveries_select on public.deliveries for select to authenticated
  using (
    exists (
      select 1 from public.crm_orders 
      where crm_orders.id = deliveries.order_id 
      and crm_orders.customer_id = public.current_client_id()
    ) or 
    exists (
      select 1 from public.sales_invoices si
      join public.customers c on si.customer_id = c.id
      where si.id = deliveries.invoice_id 
      and c.id = public.current_client_id()
    ) or
    public.has_permission('sales', 'view')
  );

-- Client Notifications: Clients can only see their own notifications
drop policy if exists client_notifications_select on public.client_notifications;
create policy client_notifications_select on public.client_notifications for select to authenticated
  using (customer_id = public.current_client_id());

drop policy if exists client_notifications_update on public.client_notifications;
create policy client_notifications_update on public.client_notifications for update to authenticated
  using (customer_id = public.current_client_id())
  with check (customer_id = public.current_client_id());

-- Views: Grant access to authenticated users for client views
grant select on public.client_financial_summary to authenticated;
grant select on public.client_order_history to authenticated;
grant select on public.client_invoices to authenticated;

-- 8. Order Status Workflow Triggers -----------------------------------------

-- Function to update delivery status history
create or replace function public.update_delivery_status_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.status_history := coalesce(old.status_history, '[]'::jsonb) || 
      jsonb_build_array(
        jsonb_build_object(
          'status', new.status,
          'timestamp', now(),
          'updated_by', auth.uid()
        )
      );
  end if;
  return new;
end;
$$;

drop trigger if exists update_delivery_status_history on public.deliveries;
create trigger update_delivery_status_history
  before update on public.deliveries
  for each row execute function public.update_delivery_status_history();

-- Function to create notification on order status change
create or replace function public.notify_order_status_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  notification_title text;
  notification_message text;
begin
  if new.status is distinct from old.status then
    notification_title := 'Order Status Update';
    notification_message := 'Your order ' || new.order_number || ' status is now: ' || new.status;
    
    insert into public.client_notifications (customer_id, type, title, message, data)
    values (
      new.customer_id,
      'order_status',
      notification_title,
      notification_message,
      jsonb_build_object(
        'order_id', new.id,
        'order_number', new.order_number,
        'old_status', old.status,
        'new_status', new.status
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_order_status_change on public.crm_orders;
create trigger notify_order_status_change
  after update on public.crm_orders
  for each row execute function public.notify_order_status_change();

-- 9. Data Integrity and Validation -------------------------------------------

-- Add constraint to ensure customer user_id links to valid user
alter table public.customers 
  add constraint if not exists customers_user_id_fkey 
  foreign key (user_id) references public.users(id) on delete set null;

-- Add constraint for positive amounts
alter table public.crm_orders 
  add constraint if not exists crm_orders_total_amount_positive 
  check (total_amount >= 0);

-- Add constraint for valid delivery dates
alter table public.crm_orders 
  add constraint if not exists crm_orders_delivery_date_future 
  check (requested_delivery_date is null or requested_delivery_date >= order_date);

-- 10. Performance Optimization ------------------------------------------------

-- Create composite indexes for common queries
create index if not exists crm_orders_customer_status_idx on public.crm_orders(customer_id, status);
create index if not exists crm_orders_date_status_idx on public.crm_orders(order_date desc, status);
create index if not exists deliveries_customer_status_idx on public.deliveries(status) 
  include (tracking_number);

-- 11. Initial Data Setup ------------------------------------------------------

-- Function to create a client portal user for existing customers
create or replace function public.setup_client_portal_for_customer(p_customer_id uuid, p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_client_role_id uuid;
begin
  -- Get client portal role
  select id into v_client_role_id from public.roles where name = 'client_portal';
  
  -- Create user account
  insert into public.users (id, email, name, role_id)
  values (gen_random_uuid(), p_email, split_part(p_email, '@', 1), v_client_role_id)
  returning id into v_user_id;
  
  -- Link user to customer
  update public.customers 
  set user_id = v_user_id,
      email = p_email
  where id = p_customer_id;
  
  return v_user_id;
end;
$$;

-- Grant execute on setup function
grant execute on function public.setup_client_portal_for_customer to authenticated;

-- ============================================================================
-- End of Migration
-- ============================================================================