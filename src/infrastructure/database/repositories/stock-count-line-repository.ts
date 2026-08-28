import { BaseRepository } from '../base-repository';
import { IStockCountLineRepository } from '../../../core/interfaces/repository';
import { StockCountLine } from '../../../core/domain/entities';

export class StockCountLineRepository extends BaseRepository<StockCountLine> implements IStockCountLineRepository {
  constructor() {
    super('stock_count_lines');
  }

  async findBySessionId(sessionId: string): Promise<StockCountLine[]> {
    return await this.table.filter((l: StockCountLine) => l.session_id === sessionId).toArray();
  }
}
