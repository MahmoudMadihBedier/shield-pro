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
  // Branch assignment — admin-only (enforced by a DB trigger, see
  // branch_hierarchy_and_scoping migration). Drives RLS row-scoping: a user
  // with no branch sees only rows they created themselves.
  warehouse_id?: string | null;
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
  // Computed client-side (sum of stock_movements) by InventoryService/
  // DashboardService's low-stock queries, never a real column — never send on a write.
  currentStock?: number;
  // Commercial fields: default_price is the selling price; discount_percent
  // is the standard discount applied at point of sale; cost_price feeds
  // profit-margin reporting; production_line_id attributes finished goods to
  // a line for qty-sold-by-line analytics.
  discount_percent?: number;
  cost_price?: number | null;
  production_line_id?: string | null;
}

export interface ProductionLine extends BaseEntity {
  name: string;
  is_active: boolean;
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
  // 'main' — exactly one may exist, enforced by a partial unique index.
  // 'branch' — a sub-warehouse; parent_warehouse_id is informational only
  // (RLS scoping uses users.warehouse_id / customers.warehouse_id directly,
  // not the parent link).
  type: 'main' | 'branch';
  parent_warehouse_id?: string | null;
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
    | 'transfer_in'
    | 'rep_issue'
    | 'rep_return';
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
  // Branch assignment — admin-only (enforced by a DB trigger). A rep-created
  // customer is left unassigned (null) until an admin approves/assigns it;
  // an admin-created customer can be assigned directly.
  warehouse_id?: string | null;
  // 'approved' by default (admin-created customers, and all pre-existing
  // rows). Set to 'pending' by SalesService.createCustomer specifically when
  // the actor is a sales rep, not an admin.
  approval_status?: 'approved' | 'pending';
  lat?: number | null;
  lng?: number | null;
  // SHA-256 hash of the client portal PIN — the actual second factor for
  // portal login (client_id alone is not a secret). Never store/compare the
  // plaintext PIN; see shared/utils/pin-hash.ts and verify_portal_pin RPC.
  portal_pin_hash?: string | null;
}

export interface SalesInvoice extends BaseEntity {
  invoice_no: string;
  customer_id: string;
  // The branch this invoice was sold from — required (NOT NULL), drives RLS
  // row-scoping the same way warehouse_id does on customers/users. Also used
  // for the stock_movement rows created alongside the invoice.
  warehouse_id: string;
  date: string;
  payment_method: 'cash' | 'credit' | 'bank';
  status: 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
  // Captured from the rep's device at the moment of sale (browser
  // geolocation) — nullable, since not every sale is field/rep-driven.
  lat?: number | null;
  lng?: number | null;
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
  // Nullable — head-office/company-level transactions (capital, some
  // expenses) stay unscoped; branch-driven ones (sales) are tagged so a
  // branch accountant's view can filter to just their own branch.
  warehouse_id?: string | null;
}

// Generic cash movement independent of a specific customer/supplier invoice
// — daily disbursements/receipts with a free-text reason (petty cash, misc
// income, owner drawings, etc.), the gap ReceiptVoucher/PaymentVoucher (both
// tied to a specific AR/AP document) don't cover.
export interface CashVoucher extends BaseEntity {
  voucher_type: 'receipt' | 'disbursement';
  amount: number;
  account_id: string;
  warehouse_id?: string | null;
  reason: string;
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
  // 'pending_qc'/'released'/'rejected' — Phase 2.7: output isn't sellable
  // stock until QC releases it, by someone other than whoever produced it.
  status: 'draft' | 'confirmed' | 'completed' | 'pending_qc' | 'released' | 'rejected';
  produced_at?: string;
  // Set when this batch originated from an approved ProductionRequest — its
  // raw materials were already withdrawn at request-approval time, so
  // completeBatch must not post a second consumption deduction for them.
  production_request_id?: string | null;
  qc_released_by?: string | null;
  qc_released_at?: string | null;
  qc_rejection_reason?: string | null;
}

// Phase 2.8 — formal return/write-off instead of goods silently
// "disappearing" from the books. Segregation of duties: requester != approver.
export interface ReturnWriteoffRequest extends BaseEntity {
  request_type: 'customer_return' | 'damage_writeoff';
  item_id: string;
  warehouse_id: string;
  qty: number;
  customer_id?: string | null;
  reason: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
}

// Phase 2.9 — physical stock count vs. system-recorded stock, the
// real-world check on whether the traceability chain matches reality.
export interface StockCountSession extends BaseEntity {
  warehouse_id: string;
  status: 'open' | 'submitted' | 'signed_off';
  counted_by?: string | null;
  submitted_at?: string | null;
  signed_off_by?: string | null;
  signed_off_at?: string | null;
  notes?: string;
}

export interface StockCountLine extends BaseEntity {
  session_id: string;
  item_id: string;
  expected_qty: number;
  counted_qty?: number | null;
  variance?: number | null;
}

export interface ProductionConsumption extends BaseEntity {
  batch_id: string;
  raw_item_id: string;
  qty_consumed: number;
}

// A factory employee requests production of an already-defined product; the
// purchasing warehouse manager reviews and either withdraws the required raw
// materials (approving) or rejects it. Only once approved can the actual
// ProductionBatch be created. Segregation of duties (requester != approver)
// enforced server-side by enforce_production_request_segregation_of_duties.
export interface ProductionRequest extends BaseEntity {
  item_id: string;
  requested_qty: number;
  requested_by: string;
  raw_material_warehouse_id: string;
  status: 'pending_materials' | 'materials_approved' | 'rejected' | 'in_production' | 'completed';
  material_approved_by?: string | null;
  material_approved_at?: string | null;
  rejection_reason?: string | null;
  production_batch_id?: string | null;
  notes?: string;
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
  // GPS stamp captured at clock-in/out time — enforced server-side
  // (enforce_self_attendance) to be the employee's own action, not entered
  // on their behalf by anyone with hr:add.
  check_in_lat?: number | null;
  check_in_lng?: number | null;
  check_out_lat?: number | null;
  check_out_lng?: number | null;
}

export interface PayrollRun extends BaseEntity {
  month: string;
  employee_id: string;
  base: number;
  allowances: number;
  deductions: number;
  net_pay: number;
  // Folded into net_pay (base + allowances - deductions + bonuses - punishments)
  // — broken out here so the run itself shows what was applied.
  bonuses_total?: number;
  punishments_total?: number;
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

// Main-warehouse-manager-initiated, admin-approved stock distribution to a
// branch. Segregation of duties enforced server-side: requester != approver,
// sender != receiver.
export interface DistributionOrder extends BaseEntity {
  order_no: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  requested_by: string;
  status:
    | 'pending_approval'
    | 'approved'
    | 'rejected'
    | 'in_transit'
    | 'received_matched'
    | 'received_discrepancy'
    | 'discrepancy_resolved';
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  shipped_at?: string | null;
  received_by?: string | null;
  received_at?: string | null;
  discrepancy_notes?: string | null;
  discrepancy_resolved_by?: string | null;
  discrepancy_resolved_at?: string | null;
  notes?: string;
}

export interface DistributionOrderLine extends BaseEntity {
  order_id: string;
  item_id: string;
  requested_qty: number;
  received_qty?: number | null;
}

// Phase 2.2/2.3 — tiered auto-approval rules + round-tripping detection.
// Advisory in this pass: evaluated and logged, but does not itself bypass
// the segregation-of-duties triggers on distribution_orders/production_requests.
export interface ApprovalRule extends BaseEntity {
  movement_type: string;
  auto_approve_threshold_qty: number;
  repeat_window_hours: number;
  repeat_max_count: number;
  is_active: boolean;
}

export interface ApprovalRuleLog extends BaseEntity {
  movement_type: string;
  actor_id?: string | null;
  item_id?: string | null;
  qty?: number | null;
  rule_matched?: string | null;
  outcome: 'would_auto_approve' | 'manual_review_required';
  ref_table?: string;
  ref_id?: string;
}

export interface FraudFlag extends BaseEntity {
  flag_type: 'round_tripping' | 'high_reversal_ratio' | 'repeated_request_pattern';
  actor_id?: string | null;
  item_id?: string | null;
  details?: Record<string, unknown> | null;
  status: 'open' | 'reviewed' | 'dismissed';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

// Rep stock/cash-in-hand ledger + daily close-out (Phase 2.4 — the highest
// fraud-prevention-value control per the business docs: every rep is a mini
// warehouse and mini cash register with a running balance that must
// reconcile to zero, or be explained, at day's end).
export interface RepStockLedger extends BaseEntity {
  rep_user_id: string;
  item_id: string;
  warehouse_id: string;
  // Positive = issued to the rep, negative = sold/returned/adjusted out.
  qty: number;
  movement_type: 'issued' | 'sold' | 'returned' | 'adjustment';
  ref_table?: string;
  ref_id?: string;
  closeout_session_id?: string | null;
  moved_at?: string;
}

export interface RepCashLedger extends BaseEntity {
  rep_user_id: string;
  // Positive = collected from a customer, negative = handed in to the branch.
  amount: number;
  payment_type: 'cash' | 'bank';
  ref_table?: string;
  ref_id?: string;
  closeout_session_id?: string | null;
  moved_at?: string;
}

export interface RepCloseoutSession extends BaseEntity {
  rep_user_id: string;
  warehouse_id: string;
  session_date: string;
  status: 'open' | 'submitted' | 'confirmed' | 'variance_flagged';
  expected_cash: number;
  actual_cash_counted?: number | null;
  cash_variance?: number | null;
  stock_variance?: { [itemId: string]: { expected: number; counted: number; diff: number } } | null;
  notes?: string;
  submitted_at?: string | null;
  submitted_by?: string | null;
  // Segregation of duties: confirmed_by must never equal rep_user_id —
  // enforced server-side by enforce_closeout_segregation_of_duties trigger.
  confirmed_at?: string | null;
  confirmed_by?: string | null;
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
