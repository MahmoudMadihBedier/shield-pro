// Sequence configuration for auto-generated numbers
export const SEQUENCE_PREFIXES: { [key: string]: string } = {
  sales_invoices: 'INV',
  purchase_invoices: 'PUR',
  sales_returns: 'SRT',
  purchase_returns: 'PRT',
  receipt_vouchers: 'REC',
  payment_vouchers: 'PAY',
  production_batches: 'BAT',
  distribution_orders: 'DIST'
};

export const AUDIT_EXCLUDED_TABLES = new Set(['audit_log', 'offline_queue']);

export const SYNC_TABLES = [
  'roles', 'users', 'permissions', 'role_permissions', 'customers',
  'suppliers', 'warehouses', 'units', 'unit_conversions', 'settings',
  'items', 'price_lists', 'item_recipes', 'production_batches',
  'production_consumptions', 'stock_movements', 'sales_invoices',
  'sales_invoice_lines', 'sales_returns', 'sales_return_lines',
  'purchase_invoices', 'purchase_invoice_lines', 'purchase_returns',
  'purchase_return_lines', 'accounts', 'account_transactions',
  'receipt_vouchers', 'payment_vouchers', 'fixed_assets', 'expenses',
  'employees', 'attendance', 'payroll_runs', 'tasks', 'employee_reports',
  'bonuses', 'punishments', 'audit_log', 'user_locations',
  'rep_stock_ledger', 'rep_cash_ledger', 'rep_closeout_sessions',
  'production_requests', 'distribution_orders', 'distribution_order_lines',
  'production_lines', 'cash_vouchers',
  'approval_rules', 'approval_rule_log', 'fraud_flags',
  'return_writeoff_requests', 'stock_count_sessions', 'stock_count_lines'
];
