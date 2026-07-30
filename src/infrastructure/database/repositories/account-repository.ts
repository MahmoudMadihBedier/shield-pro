import { BaseRepository } from '../base-repository';
import { IAccountRepository } from '../../../core/interfaces/repository';
import { Account } from '../../../core/domain/entities';

export class AccountRepository extends BaseRepository<Account> implements IAccountRepository {
  constructor() {
    super('accounts');
  }

  async findByCategory(category: string): Promise<Account[]> {
    return await this.table.filter((account: Account) => account.category === category).toArray();
  }

  async findByCode(code: string): Promise<Account | undefined> {
    return await this.table.filter((account: Account) => account.code === code).first();
  }
}