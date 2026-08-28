import { BaseRepository } from '../base-repository';
import { IRepCashLedgerRepository } from '../../../core/interfaces/repository';
import { RepCashLedger } from '../../../core/domain/entities';

export class RepCashLedgerRepository extends BaseRepository<RepCashLedger> implements IRepCashLedgerRepository {
  constructor() {
    super('rep_cash_ledger');
  }

  async findByRepId(repUserId: string): Promise<RepCashLedger[]> {
    return await this.table.filter((r: RepCashLedger) => r.rep_user_id === repUserId).toArray();
  }

  async calculateBalance(repUserId: string): Promise<number> {
    const rows = await this.findByRepId(repUserId);
    return rows.reduce((sum, r) => sum + Number(r.amount), 0);
  }
}
