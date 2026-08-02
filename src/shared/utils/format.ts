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
