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
}

export async function postDoubleEntry({
  refTable,
  refId,
  debitAccountId,
  creditAccountId,
  amount,
  date,
}: DoubleEntryParams): Promise<void> {
  const txDate = date ?? new Date().toISOString().split('T')[0];

  const debitId = crypto.randomUUID();
  await queueOfflineWrite('account_transactions', 'insert', debitId, {
    id: debitId,
    account_id: debitAccountId,
    ref_table: refTable,
    ref_id: refId,
    debit: amount,
    credit: 0,
    date: txDate,
  });

  const creditId = crypto.randomUUID();
  await queueOfflineWrite('account_transactions', 'insert', creditId, {
    id: creditId,
    account_id: creditAccountId,
    ref_table: refTable,
    ref_id: refId,
    debit: 0,
    credit: amount,
    date: txDate,
  });
}
