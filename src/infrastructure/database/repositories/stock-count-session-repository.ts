import { BaseRepository } from '../base-repository';
import { IStockCountSessionRepository } from '../../../core/interfaces/repository';
import { StockCountSession } from '../../../core/domain/entities';

export class StockCountSessionRepository extends BaseRepository<StockCountSession> implements IStockCountSessionRepository {
  constructor() {
    super('stock_count_sessions');
  }

  async findByWarehouseId(warehouseId: string): Promise<StockCountSession[]> {
    return await this.table.filter((s: StockCountSession) => s.warehouse_id === warehouseId).toArray();
  }
}
