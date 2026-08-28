import { BaseRepository } from '../base-repository';
import { IDistributionOrderLineRepository } from '../../../core/interfaces/repository';
import { DistributionOrderLine } from '../../../core/domain/entities';

export class DistributionOrderLineRepository extends BaseRepository<DistributionOrderLine> implements IDistributionOrderLineRepository {
  constructor() {
    super('distribution_order_lines');
  }

  async findByOrderId(orderId: string): Promise<DistributionOrderLine[]> {
    return await this.table.filter((l: DistributionOrderLine) => l.order_id === orderId).toArray();
  }
}
