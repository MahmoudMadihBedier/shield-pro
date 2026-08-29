import { IAccountingService } from '../../core/interfaces/services';
import { Account, AccountTransaction, CashVoucher, BranchCashSettlement } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter, ProfitLoss } from '../../core/types';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';
import { postDoubleEntry } from './accounting-helpers';
import { assertSegregationOfDuties } from './segregation-of-duties-guard';

export class AccountingService implements IAccountingService {
  private accountRepository = RepositoryFactory.getAccountRepository();
  private accountTransactionRepository = RepositoryFactory.getAccountTransactionRepository();
  private cashVoucherRepository = RepositoryFactory.getCashVoucherRepository();
  private branchCashSettlementRepository = RepositoryFactory.getBranchCashSettlementRepository();

  async getAccounts(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Account>> {
    return await this.accountRepository.findAll(filter, params);
  }

  async createAccount(account: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Promise<Account> {
    const newAccount = await this.accountRepository.create(account);
    await queueOfflineWrite('accounts', 'insert', newAccount.id, newAccount);
    return newAccount;
  }

  async getAccountBalance(accountId: string): Promise<number> {
    return await this.accountTransactionRepository.calculateBalance(accountId);
  }

  async getTransactions(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<AccountTransaction>> {
    return await this.accountTransactionRepository.findAll(filter, params);
  }

  async createTransaction(transaction: Omit<AccountTransaction, 'id' | 'created_at' | 'updated_at'>): Promise<AccountTransaction> {
    const newTransaction = await this.accountTransactionRepository.create(transaction);
    await queueOfflineWrite('account_transactions', 'insert', newTransaction.id, newTransaction);
    return newTransaction;
  }

  async getCashBankBalance(): Promise<number> {
    const cashAccounts = await this.accountRepository.findByCategory('cash');
    const bankAccounts = await this.accountRepository.findByCategory('bank');
    const accounts = [...cashAccounts, ...bankAccounts];

    let total = 0;
    for (const account of accounts) {
      total += await this.accountTransactionRepository.calculateBalance(account.id);
    }
    return total;
  }

  async getProfitLoss(startDate: string, endDate: string): Promise<ProfitLoss> {
    // Mirrors the inline P&L calculation in Reports.tsx (getPnlRevenue /
    // calculateCategoryBalance): revenue accounts increase with credit,
    // expense accounts increase with debit. Transactions are filtered by
    // their `date` field where present (the shape actually written by
    // Sales.tsx/Purchases.tsx/Accounting.tsx), falling back to created_at
    // since the AccountTransaction entity type doesn't declare `date`.
    const revenueAccounts = await this.accountRepository.findByCategory('revenue');
    const expenseAccounts = await this.accountRepository.findByCategory('expense');

    const inRange = (tx: AccountTransaction): boolean => tx.date >= startDate && tx.date <= endDate;

    let revenue = 0;
    for (const account of revenueAccounts) {
      const txs = await this.accountTransactionRepository.findByAccountId(account.id);
      revenue += txs
        .filter(inRange)
        .reduce((sum, tx) => sum + Number(tx.credit) - Number(tx.debit), 0);
    }

    let expenses = 0;
    for (const account of expenseAccounts) {
      const txs = await this.accountTransactionRepository.findByAccountId(account.id);
      expenses += txs
        .filter(inRange)
        .reduce((sum, tx) => sum + Number(tx.debit) - Number(tx.credit), 0);
    }

    return {
      revenue,
      expenses,
      netProfit: revenue - expenses
    };
  }

  // Branch-scoped P&L for a branch accountant — same computation as
  // getProfitLoss, filtered to transactions tagged with this warehouse (or
  // unscoped/company-level ones when warehouseId is null, matching the RLS
  // predicate that already governs what a branch accountant can even read).
  async getProfitLossForWarehouse(startDate: string, endDate: string, warehouseId: string | null): Promise<ProfitLoss> {
    const revenueAccounts = await this.accountRepository.findByCategory('revenue');
    const expenseAccounts = await this.accountRepository.findByCategory('expense');

    const inScope = (tx: AccountTransaction): boolean =>
      tx.date >= startDate && tx.date <= endDate && (warehouseId === null || tx.warehouse_id === warehouseId);

    let revenue = 0;
    for (const account of revenueAccounts) {
      const txs = await this.accountTransactionRepository.findByAccountId(account.id);
      revenue += txs.filter(inScope).reduce((sum, tx) => sum + Number(tx.credit) - Number(tx.debit), 0);
    }

    let expenses = 0;
    for (const account of expenseAccounts) {
      const txs = await this.accountTransactionRepository.findByAccountId(account.id);
      expenses += txs.filter(inScope).reduce((sum, tx) => sum + Number(tx.debit) - Number(tx.credit), 0);
    }

    return { revenue, expenses, netProfit: revenue - expenses };
  }

  // Branch-scoped daily cash position: cash/bank account_transactions tagged
  // to this warehouse, plus this branch's cash_vouchers (receipts add,
  // disbursements subtract).
  async getDailyCashPositionForWarehouse(date: string, warehouseId: string | null): Promise<number> {
    const cashAccounts = await this.accountRepository.findByCategory('cash');
    const bankAccounts = await this.accountRepository.findByCategory('bank');
    const accountIds = new Set([...cashAccounts, ...bankAccounts].map((a) => a.id));

    let total = 0;
    for (const accountId of accountIds) {
      const txs = await this.accountTransactionRepository.findByAccountId(accountId);
      total += txs
        .filter((tx) => tx.date === date && (warehouseId === null || tx.warehouse_id === warehouseId))
        .reduce((sum, tx) => sum + Number(tx.debit) - Number(tx.credit), 0);
    }

    const vouchers = await this.cashVoucherRepository.findByDateRange(date, date);
    for (const v of vouchers) {
      if (warehouseId !== null && (v.warehouse_id || null) !== warehouseId) continue;
      total += v.voucher_type === 'receipt' ? Number(v.amount) : -Number(v.amount);
    }

    return total;
  }

  async getCashVouchers(warehouseId: string | null): Promise<CashVoucher[]> {
    return warehouseId === null
      ? (await this.cashVoucherRepository.findAll(undefined, { page: 1, limit: Number.MAX_SAFE_INTEGER })).data
      : await this.cashVoucherRepository.findByWarehouseId(warehouseId);
  }

  // Generic receipt/disbursement with a free-text reason, independent of any
  // specific customer/supplier invoice (petty cash, misc income, owner
  // drawings...) — posts a real double-entry so it still shows up in P&L/cash
  // balance queries, not just the cash_vouchers list.
  async createCashVoucher(
    voucherType: 'receipt' | 'disbursement',
    amount: number,
    accountId: string,
    reason: string,
    warehouseId: string | null,
    date?: string
  ): Promise<CashVoucher> {
    const txDate = date ?? new Date().toISOString().split('T')[0];
    const newVoucher = await this.cashVoucherRepository.create({
      voucher_type: voucherType,
      amount,
      account_id: accountId,
      warehouse_id: warehouseId,
      reason,
      date: txDate
    });
    await queueOfflineWrite('cash_vouchers', 'insert', newVoucher.id, newVoucher);

    // Receipt: debit the cash/bank account, credit a generic "other income"
    // style offset (capital); disbursement: the reverse. Falls back to the
    // same account on both legs (net zero net-worth effect, just recorded)
    // if no capital account exists, so this never blocks the voucher itself.
    const capitalAcc = (await this.accountRepository.findByCategory('capital'))[0]?.id || accountId;
    await postDoubleEntry({
      refTable: 'cash_vouchers',
      refId: newVoucher.id,
      debitAccountId: voucherType === 'receipt' ? accountId : capitalAcc,
      creditAccountId: voucherType === 'receipt' ? capitalAcc : accountId,
      amount,
      date: txDate,
      warehouseId
    });

    return newVoucher;
  }

  // ---- Weekly branch-cashier -> main-treasury settlement ----------------

  private async cashAccountId(): Promise<string> {
    const acc = (await this.accountRepository.findByCategory('cash'))[0]?.id;
    if (!acc) throw new Error('حساب النقدية (الصندوق) غير موجود في دليل الحسابات.');
    return acc;
  }

  // Cash sitting at a branch and not yet swept to the treasury: the net of
  // the 'cash' account's transactions tagged to this branch, minus the sum
  // of already-confirmed settlements for the branch.
  async getBranchUndepositedCash(branchWarehouseId: string): Promise<number> {
    const cashAcc = await this.cashAccountId();
    const txs = await this.accountTransactionRepository.findByAccountId(cashAcc);
    const branchCash = txs
      .filter((tx) => (tx.warehouse_id || null) === branchWarehouseId)
      .reduce((sum, tx) => sum + Number(tx.debit) - Number(tx.credit), 0);

    const settled = (await this.branchCashSettlementRepository.findByBranch(branchWarehouseId))
      .filter((s) => s.status === 'confirmed')
      .reduce((sum, s) => sum + Number(s.total_amount), 0);

    return branchCash - settled;
  }

  async getBranchCashSettlements(branchWarehouseId: string | null): Promise<BranchCashSettlement[]> {
    return branchWarehouseId === null
      ? (await this.branchCashSettlementRepository.findAll(undefined, { page: 1, limit: 100000 })).data
      : await this.branchCashSettlementRepository.findByBranch(branchWarehouseId);
  }

  async createBranchCashSettlement(
    branchWarehouseId: string,
    periodStart: string,
    periodEnd: string,
    depositedBy: string,
    notes?: string
  ): Promise<BranchCashSettlement> {
    const total = await this.getBranchUndepositedCash(branchWarehouseId);
    if (total <= 0) throw new Error('لا توجد نقدية بالفرع غير مورّدة للخزينة في هذه الفترة.');

    const settlement = await this.branchCashSettlementRepository.create({
      branch_warehouse_id: branchWarehouseId,
      period_start: periodStart,
      period_end: periodEnd,
      total_amount: total,
      status: 'submitted',
      deposited_by: depositedBy,
      submitted_at: new Date().toISOString(),
      notes: notes || null
    } as Omit<BranchCashSettlement, 'id' | 'created_at' | 'updated_at'>);
    await queueOfflineWrite('branch_cash_settlements', 'insert', settlement.id, settlement);
    return settlement;
  }

  // The head/branch accountant (a different person from the depositor)
  // confirms receipt into the treasury and the journal is posted:
  // Dr cash(main treasury, warehouse_id null) / Cr cash(branch).
  async confirmBranchCashSettlement(id: string, confirmedBy: string): Promise<BranchCashSettlement> {
    const s = await this.branchCashSettlementRepository.findById(id);
    if (!s) throw new Error('تسوية الخزينة غير موجودة');
    if (s.status === 'confirmed') throw new Error('تم اعتماد هذه التسوية بالفعل.');
    assertSegregationOfDuties({ requestedBy: s.deposited_by || '', actingUserId: confirmedBy, action: 'اعتماد توريد نقدية الفرع للخزينة' });

    const confirmed = await this.branchCashSettlementRepository.update(id, {
      status: 'confirmed',
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString()
    });
    await queueOfflineWrite('branch_cash_settlements', 'update', id, confirmed);

    const cashAcc = await this.cashAccountId();
    await postDoubleEntry({
      refTable: 'branch_cash_settlements',
      refId: id,
      debitAccountId: cashAcc,
      creditAccountId: cashAcc,
      amount: Number(s.total_amount),
      debitWarehouseId: null,                 // main treasury
      creditWarehouseId: s.branch_warehouse_id // out of the branch cash
    });

    return confirmed;
  }
}
