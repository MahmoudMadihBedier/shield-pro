import { BaseEntity } from '../types/index';

// Re-export BaseEntity for convenience
export type { BaseEntity } from '../types/index';

// User and Authentication
export interface User extends BaseEntity {
  email: string;
  name: string;
  role_id: string | null;
  role_name?: string;
  permissions?: { [key: string]: { view: boolean; add: boolean; edit: boolean; delete: boolean } };
  app_version?: string;
  platform?: string;
  last_seen_at?: string;
}

export interface Role extends BaseEntity {
  name: string;
  description?: string;
}

export interface Permission extends BaseEntity {
  module: string;
  action: 'view' | 'add' | 'edit' | 'delete';
  description?: string;
}

export interface RolePermission extends BaseEntity {
  role_id: string;
  permission_id: string;
}

// Inventory Entities
export interface Item extends BaseEntity {
  name: string;
  type: 'raw_material' | 'finished_good' | 'packaging' | 'consumable';
  reorder_level: number;
  uom_id: string;
  expiry_tracking_enabled: boolean;
  default_price: number;
  barcode?: string;
  carton_barcode?: string;
  carton_pack_size?: number;
}

export interface Unit extends BaseEntity {
  name: string;
  symbol: string;
}

export interface UnitConversion extends BaseEntity {
  from_unit_id: string;
  to_unit_id: string;
  conversion_factor: number;
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
  // 'sale_out' / 'purchase_in' are the literal strings the real Sales.tsx /
  // Purchases.tsx invoice-save flows already write to stock_movements.
  movement_type: 'receipt' | 'issue' | 'transfer' | 'adjustment' | 'consumption' | 'production' | 'sale_out' | 'purchase_in';
  reference_id?: string;
  reference_type?: string;
  batch_no?: string;
  notes?: string;
}

// Sales Entities
export interface Customer extends BaseEntity {
  name: string;
  phone?: string;
  address?: string;
  opening_balance: number;
}

export interface SalesInvoice extends BaseEntity {
  invoice_no: string;
  customer_id: string;
  warehouse_id: string;
  payment_method: 'cash' | 'credit' | 'bank';
  // 'paid' / 'unpaid' / 'partially_paid' are the literal statuses the real
  // Sales.tsx invoice-save / receipt-voucher flows actually write.
  status: 'draft' | 'posted' | 'cancelled' | 'paid' | 'unpaid' | 'partially_paid';
  subtotal: number;
  discount: number;
  vat_amount: number;
  total: number;
  date?: string;
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
  invoice_id: string;
  customer_id: string;
  status: 'draft' | 'posted' | 'cancelled';
  total: number;
  notes?: string;
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
  warehouse_id: string;
  payment_method?: 'cash' | 'credit' | 'bank';
  // 'paid' / 'unpaid' / 'partially_paid' are the literal statuses the real
  // Purchases.tsx invoice-save / payment-voucher flows actually write.
  status: 'draft' | 'posted' | 'cancelled' | 'paid' | 'unpaid' | 'partially_paid';
  subtotal: number;
  discount: number;
  vat_amount: number;
  total: number;
  date?: string;
  notes?: string;
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
  category: 'cash' | 'bank' | 'receivable' | 'payable' | 'expense' | 'revenue' | 'equity';
  parent_id?: string;
  opening_balance: number;
}

export interface AccountTransaction extends BaseEntity {
  account_id: string;
  debit: number;
  credit: number;
  reference_id?: string;
  reference_type?: string;
  // The real journal-entry code (postDoubleEntry, and every module's inline
  // debit/credit pair before it) always stamps a business date on the row.
  date?: string;
  notes?: string;
}

export interface ReceiptVoucher extends BaseEntity {
  voucher_no: string;
  customer_id: string;
  account_id: string;
  amount: number;
  date?: string;
  invoice_id?: string | null;
  notes?: string;
}

export interface PaymentVoucher extends BaseEntity {
  voucher_no: string;
  supplier_id: string;
  account_id: string;
  amount: number;
  date?: string;
  invoice_id?: string | null;
  notes?: string;
}

// Manufacturing Entities
export interface ItemRecipe extends BaseEntity {
  parent_item_id: string;
  component_item_id: string;
  qty: number;
  recipe_type: 'packaging' | 'production';
}

export interface ProductionBatch extends BaseEntity {
  batch_no: string;
  item_id: string;
  warehouse_id: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  planned_qty: number;
  actual_qty?: number;
  notes?: string;
}

export interface ProductionConsumption extends BaseEntity {
  batch_id: string;
  raw_item_id: string;
  planned_qty: number;
  actual_qty: number;
}

// HR Entities
export interface Employee extends BaseEntity {
  name: string;
  position?: string;
  department?: string;
  hire_date?: string;
  salary?: number;
}

export interface Attendance extends BaseEntity {
  employee_id: string;
  date: string;
  check_in?: string;
  check_out?: string;
  status: 'present' | 'absent' | 'late' | 'half_day';
}

export interface PayrollRun extends BaseEntity {
  month: string;
  employee_id: string;
  basic_salary: number;
  deductions: number;
  bonuses: number;
  net_salary: number;
}

// System Entities
export interface Setting extends BaseEntity {
  key: string;
  value: string;
  scope: 'global' | 'user';
}

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
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy?: number;
}