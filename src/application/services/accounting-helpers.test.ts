import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted above this file's imports/consts, so the mock fn itself
// has to be created inside vi.hoisted() to survive the hoist.
const { queueOfflineWrite } = vi.hoisted(() => ({
  queueOfflineWrite: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../infrastructure/sync/sync-service', () => ({ queueOfflineWrite }));

import { postDoubleEntry } from './accounting-helpers';

describe('postDoubleEntry', () => {
  beforeEach(() => {
    queueOfflineWrite.mockClear();
  });

  it('writes one debit row and one credit row for the same amount, both tagged with the reference', async () => {
    await postDoubleEntry({
      refTable: 'sales_invoices',
      refId: 'inv-1',
      debitAccountId: 'cash-acc',
      creditAccountId: 'revenue-acc',
      amount: 150,
      date: '2026-08-02',
    });

    expect(queueOfflineWrite).toHaveBeenCalledTimes(2);

    const [debitCall, creditCall] = queueOfflineWrite.mock.calls;
    const [debitTable, debitAction, , debitData] = debitCall;
    const [creditTable, creditAction, , creditData] = creditCall;

    expect(debitTable).toBe('account_transactions');
    expect(creditTable).toBe('account_transactions');
    expect(debitAction).toBe('insert');
    expect(creditAction).toBe('insert');

    expect(debitData).toMatchObject({
      account_id: 'cash-acc',
      ref_table: 'sales_invoices',
      ref_id: 'inv-1',
      debit: 150,
      credit: 0,
      date: '2026-08-02',
    });
    expect(creditData).toMatchObject({
      account_id: 'revenue-acc',
      ref_table: 'sales_invoices',
      ref_id: 'inv-1',
      debit: 0,
      credit: 150,
      date: '2026-08-02',
    });
  });

  it('defaults date to today when not provided', async () => {
    await postDoubleEntry({
      refTable: 'receipt_vouchers',
      refId: 'v-1',
      debitAccountId: 'a',
      creditAccountId: 'b',
      amount: 10,
    });
    const today = new Date().toISOString().split('T')[0];
    const [, , , debitData] = queueOfflineWrite.mock.calls[0];
    expect(debitData.date).toBe(today);
  });
});
