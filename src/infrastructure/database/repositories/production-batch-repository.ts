import { BaseRepository } from '../base-repository';
import { IProductionBatchRepository } from '../../../core/interfaces/repository';
import { ProductionBatch } from '../../../core/domain/entities';

export class ProductionBatchRepository extends BaseRepository<ProductionBatch> implements IProductionBatchRepository {
  constructor() {
    super('production_batches');
  }

  async findByItemId(itemId: string): Promise<ProductionBatch[]> {
    return await this.table.filter((batch: ProductionBatch) => batch.item_id === itemId).toArray();
  }

  async findByStatus(status: string): Promise<ProductionBatch[]> {
    return await this.table.filter((batch: ProductionBatch) => batch.status === status).toArray();
  }
}
