-- ============================================================================
-- 0005_add_crm_user_link.sql
--
-- Add user_id column to customers table for CRM authentication
-- This links a customer to a Supabase auth user account
-- 
-- For client_id-only authentication to work:
-- 1. Admin creates a customer record (client_id is auto-generated)
-- 2. Admin manually creates a Supabase auth user with:
--    - email: customer.email or a placeholder like CLI-XXX@company.com
--    - password: the client_id (e.g., CLI-ABC12345)
-- 3. Admin links the auth user to the customer by setting customers.user_id
-- 4. Client can then login using only their client_id
-- ============================================================================

-- Add user_id column to customers table if it doesn't exist
alter table public.customers
  add column if not exists user_id uuid references public.users(id) on delete set null;

-- Create index for faster lookups by user_id
create index if not exists customers_user_id_idx on public.customers(user_id);

-- Create index for faster lookups by client_id
create index if not exists customers_client_id_idx on public.customers(client_id);

-- Add comment to document the relationship
comment on column public.customers.user_id is 'Link to Supabase auth user for CRM portal access. Used for client_id-only authentication.';
comment on column public.customers.client_id is 'Public-facing unique identifier for CRM client authentication. Format: CLI-XXXXXXXX';

-- Helper function to create and link a CRM user account for a customer
-- This can be called by the admin to set up client authentication
create or replace function public.setup_crm_user_for_customer(p_customer_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id text;
  v_user_id uuid;
  v_role_id uuid;
begin
  -- Get the customer's client_id
  select client_id into v_client_id
  from public.customers
  where id = p_customer_id;
  
  if v_client_id is null then
    raise exception 'Customer does not have a client_id';
  end if;
  
  -- Get the client_portal role
  select id into v_role_id
  from public.roles
  where name = 'client_portal';
  
  if v_role_id is null then
    raise exception 'client_portal role not found';
  end if;
  
  -- Create the auth user (this will be done manually via Supabase dashboard)
  -- Then insert into public.users
  -- For now, we just return the client_id to use as password
  return v_client_id::uuid;
end;
$$;

-- Helper function to link an existing auth user to a customer
create or replace function public.link_auth_user_to_customer(p_customer_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customers
  set user_id = p_user_id
  where id = p_customer_id;
  
  return true;
end;
$$;
