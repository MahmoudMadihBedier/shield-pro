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
  }
}

export const db = new ERPDatabase();
