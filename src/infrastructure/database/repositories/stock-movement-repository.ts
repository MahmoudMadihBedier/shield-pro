import { BaseRepository } from '../base-repository';
import { IStockMovementRepository } from '../../../core/interfaces/repository';
import { StockMovement } from '../../../core/domain/entities';

export class StockMovementRepository extends BaseRepository<StockMovement> implements IStockMovementRepository {
  constructor() {
    super('stock_movements');
  }

  async findByItemId(itemId: string): Promise<StockMovement[]> {
    return await this.table
      .filter((movement: StockMovement) => movement.item_id === itemId)
      .toArray();
  }

  async findByWarehouseId(warehouseId: string): Promise<StockMovement[]> {
    return await this.table
      .filter((movement: StockMovement) => movement.warehouse_id === warehouseId)
      .toArray();
  }

  async calculateStock(itemId: string, warehouseId?: string): Promise<number> {
    const movements = warehouseId
      ? await this.table
          .filter((m: StockMovement) => m.item_id === itemId && m.warehouse_id === warehouseId)
          .toArray()
      : await this.table.filter((m: StockMovement) => m.item_id === itemId).toArray();

    return movements.reduce((sum: number, m: StockMovement) => sum + Number(m.qty), 0);
  }
}