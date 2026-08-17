import { BaseEntity } from '../types/index';

// Re-export BaseEntity for convenience
export type { BaseEntity } from '../types/index';

// These entity shapes are checked against the live Supabase schema (via
// mcp__supabase__list_tables), not just against what any one component
// happens to write — Dexie tables are untyped (Table<any>), so a field-name
// or enum-value mismatch here doesn't fail at compile time, it fails at
// sync time (PostgREST rejects unknown columns / check-constraint violations).

// User and Authentication
export interface User extends BaseEntity {
  email: string;
  name: string;
  role_id: string | null;
  // Derived client-side (joined from roles/role_permissions), not real
  // columns on public.users — never send these on a write.
  role_name?: string;
  permissions?: { [key: string]: { view: boolean; add: boolean; edit: boolean; delete: boolean } };
  app_version?: string;
  platform?: string;
  last_seen_at?: string;
}

export interface Role extends BaseEntity {
  name: string;
}

export interface Permission extends BaseEntity {
  module: string;
  action: 'view' | 'add' | 'edit' | 'delete';
}

export interface RolePermission extends BaseEntity {
  role_id: string;
  permission_id: string;
}

// Inventory Entities
export interface Item extends BaseEntity {
  name: string;
  type: 'raw_material' | 'packaging' | 'intermediate' | 'finished_good';
  reorder_level: number;
  uom_id: string;
  expiry_tracking_enabled: boolean;
  default_price: number;
  // Not yet live columns on public.items (BarcodeScanInput/Sales.tsx already
  // read/write these locally; syncing them needs a follow-up migration).
  barcode?: string;
  carton_barcode?: string;
  carton_pack_size?: number;
}

export interface Unit extends BaseEntity {
  name: string;
}

export interface UnitConversion extends BaseEntity {
  from_unit_id: string;
  to_unit_id: string;
  factor: number;
}

export interface Warehouse extends BaseEntity {
  name: string;
  location?: string;
  is_active: boolean;
}

export interface StockMovement extends BaseEntity {
  item_id: string;
  warehouse_id: string;
  qty: number;
  // Matches the live public.stock_movements check constraint exactly.
  movement_type:
    | 'purchase_in'
    | 'sale_out'
    | 'production_consumption'
    | 'production_output'
    | 'sales_return_in'
    | 'purchase_return_out'
    | 'manual_adjustment'
    | 'transfer_out'
    | 'transfer_in';
  ref_table?: string;
  ref_id?: string;
  moved_at?: string;
  batch_no?: string;
}

// Sales Entities
export interface Customer extends BaseEntity {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  opening_balance: number;
  credit_limit?: number;
  client_id?: string;
  company_name?: string;
  tax_id?: string;
  website?: string;
  is_active?: boolean;
  credit_status?: string;
  user_id?: string;
  crm_credentials?: { tempPassword: string };
}

export interface SalesInvoice extends BaseEntity {
  invoice_no: string;
  customer_id: string;
  // Not a column on public.sales_invoices — the warehouse only matters for
  // the stock_movement rows created alongside the invoice, never stored on
  // the invoice itself.
  date: string;
  payment_method: 'cash' | 'credit' | 'bank';
  status: 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
}

export interface SalesInvoiceLine extends BaseEntity {
  invoice_id: string;
  item_id: string;
  qty: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

export interface SalesReturn extends BaseEntity {
  return_no: string;
  invoice_id?: string;
  customer_id: string;
  date: string;
  total: number;
}

export interface SalesReturnLine extends BaseEntity {
  return_id: string;
  item_id: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

// Purchase Entities
export interface Supplier extends BaseEntity {
  name: string;
  phone?: string;
  address?: string;
  opening_balance: number;
}

export interface PurchaseInvoice extends BaseEntity {
  invoice_no: string;
  supplier_id: string;
  date: string;
  payment_method: 'cash' | 'credit' | 'bank';
  status: 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export interface PurchaseInvoiceLine extends BaseEntity {
  invoice_id: string;
  item_id: string;
  qty: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

// Accounting Entities
export interface Account extends BaseEntity {
  code: string;
  name: string;
  // Matches the live public.accounts check constraint exactly.
  category: 'cash' | 'bank' | 'capital' | 'fixed_assets' | 'ar' | 'ap' | 'revenue' | 'cogs' | 'expense';
  is_active?: boolean;
}

export interface AccountTransaction extends BaseEntity {
  account_id: string;
  debit: number;
  credit: number;
  ref_table?: string;
  ref_id?: string;
  date: string;
}

export interface ReceiptVoucher extends BaseEntity {
  voucher_no: string;
  customer_id: string;
  account_id: string;
  amount: number;
  date: string;
  invoice_id?: string | null;
}

export interface PaymentVoucher extends BaseEntity {
  voucher_no: string;
  supplier_id: string;
  account_id: string;
  amount: number;
  date: string;
  invoice_id?: string | null;
}

// Manufacturing Entities
export interface ItemRecipe extends BaseEntity {
  parent_item_id: string;
  component_item_id: string;
  quantity_or_percentage: number;
  // Matches the live public.item_recipes check constraint exactly — 'batch'
  // is the bulk/intermediate-production BOM stage, 'packaging' is the
  // fill/pack stage. There is no 'production' value.
  recipe_type: 'batch' | 'packaging';
  mode: 'percentage' | 'fixed_qty';
}

export interface ProductionBatch extends BaseEntity {
  batch_no: string;
  item_id: string;
  planned_qty: number;
  actual_qty?: number | null;
  expected_waste_pct?: number;
  actual_waste_pct?: number | null;
  expiry_date?: string | null;
  status: 'draft' | 'confirmed' | 'completed';
  produced_at?: string;
}

export interface ProductionConsumption extends BaseEntity {
  batch_id: string;
  raw_item_id: string;
  qty_consumed: number;
}

// HR Entities
export interface Employee extends BaseEntity {
  name: string;
  // The system account that owns this employee profile. This is optional while
  // existing records are being linked by an administrator.
  user_id?: string | null;
  role?: string;
  base_salary: number;
  allowances: number;
  deductions: number;
  join_date?: string;
}

export interface Attendance extends BaseEntity {
  employee_id: string;
  date: string;
  check_in?: string;
  check_out?: string;
}

export interface PayrollRun extends BaseEntity {
  month: string;
  employee_id: string;
  base: number;
  allowances: number;
  deductions: number;
  net_pay: number;
}

// System Entities
export interface Setting extends BaseEntity {
  key: string;
  value: string;
  scope: 'global' | 'user';
  scope_id?: string;
}

// Out of scope for today's pass (audit-service.ts / audit-log-repository.ts
// predate it and aren't touched here) — left as before.
export interface AuditLog extends BaseEntity {
  user_id: string;
  table_name: string;
  record_id: string;
  action: 'insert' | 'update' | 'delete';
  old_value?: string;
  new_value?: string;
}

export interface UserLocation extends BaseEntity {
  user_id: string;
  lat: number;
  lng: number;
  accuracy?: number;
  recorded_at: string;
}

// Task Management Entities
export interface Task extends BaseEntity {
  employee_id: string;
  title: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  feedback?: string;
  created_by?: string;
}

export interface EmployeeReport extends BaseEntity {
  reporter_id: string;
  reported_employee_id: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  reviewed_by?: string;
  reviewed_at?: string;
  resolution_notes?: string;
}

export interface Bonus extends BaseEntity {
  employee_id: string;
  amount: number;
  reason?: string;
  given_by?: string;
  date: string;
}

export interface Punishment extends BaseEntity {
  employee_id: string;
  amount: number;
  reason: string;
  given_by?: string;
  date: string;
}

// CRM Client Portal Entities
export interface CrmOrder extends BaseEntity {
  client_id?: string;
  order_number?: string;
  customer_id: string;
  customer_reference?: string;
  order_date: string;
  requested_delivery_date?: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  payment_method: 'credit' | 'cash' | 'bank_transfer' | 'online';
  payment_status: 'pending' | 'paid' | 'partial' | 'overdue';
  total_amount: number;
  internal_notes?: string;
  delivery_address?: string;
  converted_to_invoice_id?: string;
  converted_at?: string;
  converted_by?: string;
}

export interface CrmOrderLine extends BaseEntity {
  order_id: string;
  item_id: string;
  item_name?: string;
  item_sku?: string;
  qty: number;
  unit_price: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_amount?: number;
  tax_rate?: number;
  line_total: number;
  notes?: string;
}

export interface Delivery extends BaseEntity {
  order_id?: string;
  tracking_number?: string;
  status: 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  carrier?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  delivery_address?: string;
  notes?: string;
}

export interface ClientNotification extends BaseEntity {
  customer_id: string;
  type: 'order_status' | 'delivery_update' | 'payment' | 'promotion' | 'system';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  read_at?: string;
}

export interface ClientFinancialSummary extends BaseEntity {
  customer_id: string;
  client_id?: string;
  customer_name?: string;
  opening_balance: number;
  credit_limit?: number;
  total_invoiced: number;
  total_paid: number;
  current_balance: number;
  credit_status: 'good' | 'warning' | 'blocked';
  last_order_date?: string;
  total_orders?: number;
  total_purchased?: number;
}
