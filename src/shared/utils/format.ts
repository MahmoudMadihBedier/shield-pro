// Shared display formatters, replacing the ad hoc `toFixed(2)` / 'ج.م' /
// `toLocaleDateString('ar-EG')` repeated across every business component
// (some of which had drifted — e.g. a couple of spots showing 'ر.s' instead
// of the currency suffix used everywhere else).

const CURRENCY_SUFFIX = 'ج.م';

export function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} ${CURRENCY_SUFFIX}`;
}

export function formatNumber(amount: number, decimals = 2): string {
  return amount.toFixed(decimals);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString('ar-EG');
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString('ar-EG');
}

// A quantity: trims trailing zeros so "5.00" shows as "5" but "2.5" stays,
// with an optional unit suffix ("50 جم").
export function formatQty(value: number, unit?: string): string {
  const n = Number(value);
  const s = Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : '0';
  return unit ? `${s} ${unit}` : s;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${Number(value).toFixed(decimals)}%`;
}

// "2026-08" or a Date -> "أغسطس 2026"
export function formatMonth(value: string | Date): string {
  const date = typeof value === 'string'
    ? new Date(value.length === 7 ? `${value}-01` : value)
    : value;
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
}

// Turn a (ref_table, ref_id) pair into something a person can read instead
// of a raw table name + UUID. `label` is an already-resolved human name when
// the caller has one (e.g. an invoice_no).
const REF_TABLE_LABELS: Record<string, string> = {
  sales_invoices: 'فاتورة مبيعات',
  purchase_invoices: 'فاتورة مشتريات',
  sales_returns: 'مرتجع مبيعات',
  purchase_returns: 'مرتجع مشتريات',
  receipt_vouchers: 'إيصال استلام فلوس',
  payment_vouchers: 'إيصال صرف فلوس',
  cash_vouchers: 'سند نقدي',
  production_batches: 'دفعة إنتاج',
  production_requests: 'أمر تشغيل',
  distribution_orders: 'تحويل مخزني',
  rep_stock_requests: 'طلب صرف عهدة',
  rep_closeout_sessions: 'تقفيل يوم',
  branch_cash_settlements: 'توريد خزينة',
  stock_movements: 'حركة مخزون',
  expenses: 'مصروف',
  payroll_runs: 'مسير رواتب',
  fixed_assets: 'أصل ثابت',
  opening_balance: 'رصيد أول المدة',
};

export function humanRef(refTable?: string | null, label?: string | null): string {
  const base = refTable ? (REF_TABLE_LABELS[refTable] ?? 'مستند') : 'مستند';
  return label ? `${base} ${label}` : base;
}
