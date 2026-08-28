import { BaseRepository } from '../base-repository';
import { IRepStockLedgerRepository } from '../../../core/interfaces/repository';
import { RepStockLedger } from '../../../core/domain/entities';

export class RepStockLedgerRepository extends BaseRepository<RepStockLedger> implements IRepStockLedgerRepository {
  constructor() {
    super('rep_stock_ledger');
  }

  async findByRepId(repUserId: string): Promise<RepStockLedger[]> {
    return await this.table.filter((r: RepStockLedger) => r.rep_user_id === repUserId).toArray();
  }

  async calculateBalance(repUserId: string, itemId: string): Promise<number> {
    const rows = await this.table
      .filter((r: RepStockLedger) => r.rep_user_id === repUserId && r.item_id === itemId)
      .toArray();
    return rows.reduce((sum: number, r: RepStockLedger) => sum + Number(r.qty), 0);
  }

  async getRepBalances(repUserId: string): Promise<{ item_id: string; balance: number }[]> {
    const rows = await this.findByRepId(repUserId);
    const byItem = new Map<string, number>();
    for (const r of rows) {
      byItem.set(r.item_id, (byItem.get(r.item_id) || 0) + Number(r.qty));
    }
    return Array.from(byItem.entries()).map(([item_id, balance]) => ({ item_id, balance }));
  }
}
