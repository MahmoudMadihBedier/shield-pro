import { BaseRepository } from '../base-repository';
import { IDistributionOrderRepository } from '../../../core/interfaces/repository';
import { DistributionOrder } from '../../../core/domain/entities';

export class DistributionOrderRepository extends BaseRepository<DistributionOrder> implements IDistributionOrderRepository {
  constructor() {
    super('distribution_orders');
  }

  async findByStatus(status: string): Promise<DistributionOrder[]> {
    return await this.table.filter((o: DistributionOrder) => o.status === status).toArray();
  }

  async findByWarehouse(warehouseId: string): Promise<DistributionOrder[]> {
    return await this.table
      .filter((o: DistributionOrder) => o.from_warehouse_id === warehouseId || o.to_warehouse_id === warehouseId)
      .toArray();
  }
}
