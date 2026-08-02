import { IAccountingService } from '../../core/interfaces/services';
import { Account, AccountTransaction } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';

export class AccountingService implements IAccountingService {
  private accountRepository = RepositoryFactory.getAccountRepository();
  private accountTransactionRepository = RepositoryFactory.getAccountTransactionRepository();

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

    // The account_transactions rows written by hand elsewhere (Sales.tsx,
    // Purchases.tsx, Accounting.tsx via queueOfflineWrite/postDoubleEntry) also
    // carry `ref_table`/`ref_id`/`date` fields that reports (e.g. Reports.tsx
    // date-range P&L filtering) rely on, even though the AccountTransaction
    // entity type only declares reference_id/reference_type. Mirror that shape
    // on the synced payload so this service stays interoperable with the
    // existing manual call sites and inline reports.
    const dateStr = newTransaction.created_at.split('T')[0];
    const syncPayload: any = {
      ...newTransaction,
      date: dateStr,
      ref_table: transaction.reference_type,
      ref_id: transaction.reference_id
    };

    await queueOfflineWrite('account_transactions', 'insert', newTransaction.id, syncPayload);
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

  async getProfitLoss(startDate: string, endDate: string): Promise<any> {
    // Mirrors the inline P&L calculation in Reports.tsx (getPnlRevenue /
    // calculateCategoryBalance): revenue accounts increase with credit,
    // expense accounts increase with debit. Transactions are filtered by
    // their `date` field where present (the shape actually written by
    // Sales.tsx/Purchases.tsx/Accounting.tsx), falling back to created_at
    // since the AccountTransaction entity type doesn't declare `date`.
    const revenueAccounts = await this.accountRepository.findByCategory('revenue');
    const expenseAccounts = await this.accountRepository.findByCategory('expense');

    const inRange = (tx: any): boolean => {
      const txDate: string | undefined = tx.date || (tx.created_at ? tx.created_at.split('T')[0] : undefined);
      if (!txDate) return false;
      return txDate >= startDate && txDate <= endDate;
    };

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
}
