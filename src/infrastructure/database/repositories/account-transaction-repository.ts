import { BaseRepository } from '../base-repository';
import { IAccountTransactionRepository } from '../../../core/interfaces/repository';
import { AccountTransaction } from '../../../core/domain/entities';

export class AccountTransactionRepository extends BaseRepository<AccountTransaction> implements IAccountTransactionRepository {
  constructor() {
    super('account_transactions');
  }

  async findByAccountId(accountId: string): Promise<AccountTransaction[]> {
    return await this.table.filter((tx: AccountTransaction) => tx.account_id === accountId).toArray();
  }

  async calculateBalance(accountId: string): Promise<number> {
    const transactions = await this.findByAccountId(accountId);
    return transactions.reduce((sum, tx) => sum + Number(tx.debit) - Number(tx.credit), 0);
  }
}