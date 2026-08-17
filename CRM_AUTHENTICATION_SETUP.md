# CRM Client Authentication Setup Guide

## Overview

The CRM authentication system now uses **client_id-only authentication**. Clients no longer need email/password to log in - they only need their client ID (e.g., `CLI-ABC12345`).

## Database Schema Changes

### New Migration: `0005_add_crm_user_link.sql`

This migration adds:
- `user_id` column to `customers` table (links to Supabase auth user)
- Indexes for faster lookups by `user_id` and `client_id`
- Helper functions for admin setup

### Required Columns on `customers` table:
- `client_id` (unique text, format: `CLI-XXXXXXXX`) - Auto-generated
- `user_id` (uuid, nullable) - Links to Supabase auth user
- `is_active` (boolean) - Controls client access
- `email` (text) - Contact email (not used for auth)

## Admin Setup Process

When creating a new customer who needs CRM access:

### Step 1: Create Customer in ERP
1. Go to Sales → Customers
2. Create new customer record
3. System auto-generates `client_id` (e.g., `CLI-ABC12345`)
4. Copy the `client_id` to share with the customer

### Step 2: Create Supabase Auth User
**In Supabase Dashboard → Authentication → Users:**
1. Click "Add user"
2. Email: Use customer's email OR a placeholder like `CLI-ABC12345@company.com`
3. Password: **Use the client_id** (e.g., `CLI-ABC12345`)
4. Auto-confirm email: Yes (recommended)
5. Click "Create user"

### Step 3: Assign Client Portal Role
**In Supabase Dashboard → SQL Editor:**
```sql
-- Get the user ID from the newly created user
-- Then assign the client_portal role
UPDATE public.users 
SET role_id = (SELECT id FROM public.roles WHERE name = 'client_portal')
WHERE email = 'CLI-ABC12345@company.com'; -- or customer's actual email
```

### Step 4: Link User to Customer
**Option A: Using SQL:**
```sql
UPDATE public.customers 
SET user_id = '<user_uuid_from_step_2>'
WHERE client_id = 'CLI-ABC12345';
```

**Option B: Using the helper function:**
```sql
SELECT public.link_auth_user_to_customer(
  '<customer_uuid>',
  '<user_uuid>'
);
```

### Step 5: Share Client ID with Customer
1. Copy the `client_id` from the customer record
2. Share it via WhatsApp or email
3. Tell the customer: "Use this ID to log in to the CRM portal - no password needed"

## Client Login Process

1. Customer goes to CRM portal URL
2. Enters only their `client_id` (e.g., `CLI-ABC12345`)
3. System:
   - Looks up customer by `client_id`
   - Verifies customer is active
   - Authenticates using linked user account (with client_id as password)
   - Creates session and redirects to CRM dashboard

## Security Notes

- **Password = Client ID**: The Supabase auth user's password is set to the client_id
- **Single Use**: Each client has a unique client_id
- **Revocable**: Admin can revoke access by:
  - Setting `customers.is_active = false`
  - Deleting the linked user account
  - Changing the user's role
- **No Password Management**: Clients never need to reset passwords - the ID is their credential

## Troubleshooting

### "No account linked to this client ID"
- Cause: `customers.user_id` is NULL
- Fix: Complete Step 4 to link the auth user

### "Authentication failed"
- Cause: Supabase auth user doesn't exist or password doesn't match client_id
- Fix: Ensure auth user was created with password = client_id

### "Invalid client ID or client not active"
- Cause: Client ID doesn't exist or `is_active = false`
- Fix: Check customer record, ensure `is_active = true`

## Migration Checklist

- [ ] Run migration `0005_add_crm_user_link.sql` in Supabase
- [ ] Verify `customers.user_id` column exists
- [ ] Verify indexes are created
- [ ] Test with a sample customer
- [ ] Document the process for your team

## API Changes

### Removed:
- Automatic CRM account creation in `SalesService.createCustomer()`
- Password generation and sharing

### Added:
- `SalesService.linkCrmUserToCustomer()` for manual user linking
- `CRMService.authenticateByClientId()` for client_id-only auth
- Helper SQL functions for admin setup
