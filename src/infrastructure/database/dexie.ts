import Dexie, { type Table } from 'dexie';

export interface OfflineQueueItem {
  id?: number;
  table_name: string;
  action: 'insert' | 'update' | 'delete';
  record_id: string;
  data: any;
  timestamp: number;
}

class ERPDatabase extends Dexie {
  offline_queue!: Table<OfflineQueueItem, number>;
  users!: Table<any, string>;
  roles!: Table<any, string>;
  permissions!: Table<any, string>;
  role_permissions!: Table<any, string>;
  customers!: Table<any, string>;
  suppliers!: Table<any, string>;
  warehouses!: Table<any, string>;
  units!: Table<any, string>;
  unit_conversions!: Table<any, string>;
  settings!: Table<any, string>;
  items!: Table<any, string>;
  price_lists!: Table<any, string>;
  item_recipes!: Table<any, string>;
  production_batches!: Table<any, string>;
  production_consumptions!: Table<any, string>;
  stock_movements!: Table<any, string>;
  sales_invoices!: Table<any, string>;
  sales_invoice_lines!: Table<any, string>;
  sales_returns!: Table<any, string>;
  sales_return_lines!: Table<any, string>;
  purchase_invoices!: Table<any, string>;
  purchase_invoice_lines!: Table<any, string>;
  purchase_returns!: Table<any, string>;
  purchase_return_lines!: Table<any, string>;
  receipt_vouchers!: Table<any, string>;
  payment_vouchers!: Table<any, string>;
  accounts!: Table<any, string>;
  account_transactions!: Table<any, string>;
  fixed_assets!: Table<any, string>;
  expenses!: Table<any, string>;
  employees!: Table<any, string>;
  attendance!: Table<any, string>;
  payroll_runs!: Table<any, string>;
  audit_log!: Table<any, string>;
  user_locations!: Table<any, string>;
  tasks!: Table<any, string>;
  employee_reports!: Table<any, string>;
  bonuses!: Table<any, string>;
  punishments!: Table<any, string>;
  rep_stock_ledger!: Table<any, string>;
  rep_cash_ledger!: Table<any, string>;
  rep_closeout_sessions!: Table<any, string>;
  production_requests!: Table<any, string>;
  distribution_orders!: Table<any, string>;
  distribution_order_lines!: Table<any, string>;
  production_lines!: Table<any, string>;
  cash_vouchers!: Table<any, string>;
  approval_rules!: Table<any, string>;
  approval_rule_log!: Table<any, string>;
  fraud_flags!: Table<any, string>;
  return_writeoff_requests!: Table<any, string>;
  stock_count_sessions!: Table<any, string>;
  stock_count_lines!: Table<any, string>;
  internal_notifications!: Table<any, string>;
  rep_stock_requests!: Table<any, string>;
  rep_stock_request_lines!: Table<any, string>;

  constructor() {
    super('ERPDatabase');
    this.version(1).stores({
      offline_queue: '++id, table_name, action, record_id, timestamp',
      users: 'id, email, role_id',
      roles: 'id, name',
      permissions: 'id, module, action',
      role_permissions: 'id, role_id, permission_id',
      customers: 'id, name, phone',
      suppliers: 'id, name, phone',
      warehouses: 'id, name',
      units: 'id, name',
      unit_conversions: 'id, from_unit_id, to_unit_id',
      settings: 'id, key',
      items: 'id, name, type',
      price_lists: 'id, customer_id, item_id',
      item_recipes: 'id, parent_item_id, component_item_id',
      production_batches: 'id, batch_no, item_id, status',
      production_consumptions: 'id, batch_id, raw_item_id',
      stock_movements: 'id, item_id, warehouse_id',
      sales_invoices: 'id, invoice_no, customer_id, status',
      sales_invoice_lines: 'id, invoice_id, item_id',
      sales_returns: 'id, return_no, invoice_id',
      sales_return_lines: 'id, return_id, item_id',
      purchase_invoices: 'id, invoice_no, supplier_id, status',
      purchase_invoice_lines: 'id, invoice_id, item_id',
      purchase_returns: 'id, return_no, invoice_id',
      purchase_return_lines: 'id, return_id, item_id',
      receipt_vouchers: 'id, voucher_no, customer_id',
      payment_vouchers: 'id, voucher_no, supplier_id',
      accounts: 'id, code, name, category',
      account_transactions: 'id, account_id',
      fixed_assets: 'id, name',
      expenses: 'id, category_id',
      employees: 'id, name',
      attendance: 'id, employee_id, date',
      payroll_runs: 'id, month, employee_id',
      audit_log: 'id, user_id, table_name'
    });

    // v2: indexed lookup fields for barcode scanning (unit + carton barcodes on items)
    this.version(2).stores({
      items: 'id, name, type, barcode, carton_barcode'
    });

    // v3: GPS location pings for rep/user tracking (foreground-only)
    this.version(3).stores({
      user_locations: 'id, user_id, recorded_at'
    });

    // v4: Task management system (tasks, employee_reports, bonuses, punishments)
    this.version(4).stores({
      tasks: 'id, employee_id, status, due_date',
      employee_reports: 'id, reporter_id, reported_employee_id, status',
      bonuses: 'id, employee_id, date',
      punishments: 'id, employee_id, date'
    });

    // v5: Rep stock/cash-in-hand ledger + daily close-out sessions
    this.version(5).stores({
      rep_stock_ledger: 'id, rep_user_id, item_id, closeout_session_id',
      rep_cash_ledger: 'id, rep_user_id, closeout_session_id',
      rep_closeout_sessions: 'id, rep_user_id, warehouse_id, session_date, status'
    });

    // v6: Production requests (factory employee -> purchasing manager approval)
    this.version(6).stores({
      production_requests: 'id, item_id, requested_by, status'
    });

    // v7: Main-to-branch distribution orders
    this.version(7).stores({
      distribution_orders: 'id, order_no, from_warehouse_id, to_warehouse_id, status',
      distribution_order_lines: 'id, order_id, item_id'
    });

    // v8: Production lines (item commercial fields + analytics)
    this.version(8).stores({
      production_lines: 'id, name'
    });

    // v9: Generic cash vouchers (branch-scoped accounting)
    this.version(9).stores({
      cash_vouchers: 'id, warehouse_id, account_id, date'
    });

    // v10: Approval-tier rules engine + fraud detection flags
    this.version(10).stores({
      approval_rules: 'id, movement_type',
      approval_rule_log: 'id, actor_id, movement_type',
      fraud_flags: 'id, status, actor_id'
    });

    // v11: QC hold, returns/write-offs, physical stock count sessions
    this.version(11).stores({
      return_writeoff_requests: 'id, status, requested_by, item_id',
      stock_count_sessions: 'id, warehouse_id, status',
      stock_count_lines: 'id, session_id, item_id'
    });

    // v12: Internal staff notifications
    this.version(12).stores({
      internal_notifications: 'id, user_id, role_id, is_read'
    });

    // v13: Rep stock requests (rep -> branch keeper dual sign-off before van load)
    this.version(13).stores({
      rep_stock_requests: 'id, rep_user_id, warehouse_id, status',
      rep_stock_request_lines: 'id, request_id, item_id'
    });
  }
}

export const db = new ERPDatabase();
