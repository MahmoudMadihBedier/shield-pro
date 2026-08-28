import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';

// One balanced debit/credit pair against public.account_transactions, the
// shape every module's journal-entry code (sales, purchases, vouchers,
// payroll) already builds by hand in two separate queueOfflineWrite calls.
export interface DoubleEntryParams {
  refTable: string;
  refId: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  date?: string;
  // Tags both legs with the branch this transaction belongs to (e.g. the
  // warehouse a sale was made from) — nullable, most journal entries (a
  // purchase, payroll) stay company-level/unscoped.
  warehouseId?: string | null;
}

export async function postDoubleEntry({
  refTable,
  refId,
  debitAccountId,
  creditAccountId,
  amount,
  date,
  warehouseId,
}: DoubleEntryParams): Promise<void> {
  const txDate = date ?? new Date().toISOString().split('T')[0];

  const debitId = crypto.randomUUID();
  const debitResult = await queueOfflineWrite('account_transactions', 'insert', debitId, {
    id: debitId,
    account_id: debitAccountId,
    ref_table: refTable,
    ref_id: refId,
    debit: amount,
    credit: 0,
    date: txDate,
    warehouse_id: warehouseId ?? null,
  });
  if (!debitResult.success) {
    throw new Error(`فشل تسجيل القيد المدين لـ ${refTable}/${refId}: ${debitResult.error ?? 'خطأ غير معروف'}`);
  }

  const creditId = crypto.randomUUID();
  const creditResult = await queueOfflineWrite('account_transactions', 'insert', creditId, {
    id: creditId,
    account_id: creditAccountId,
    ref_table: refTable,
    ref_id: refId,
    debit: 0,
    credit: amount,
    date: txDate,
    warehouse_id: warehouseId ?? null,
  });
  if (!creditResult.success) {
    // The debit leg above already succeeded -- surface this loudly rather
    // than leaving an unbalanced ledger with no error anywhere.
    throw new Error(
      `فشل تسجيل القيد الدائن لـ ${refTable}/${refId}: ${creditResult.error ?? 'خطأ غير معروف'} ` +
      `(تنبيه: تم تسجيل القيد المدين ${debitId} بدون القيد الدائن المقابل)`
    );
  }
}
