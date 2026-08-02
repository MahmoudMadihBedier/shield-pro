import { BaseRepository } from '../base-repository';
import { IProductionConsumptionRepository } from '../../../core/interfaces/repository';
import { ProductionConsumption } from '../../../core/domain/entities';

export class ProductionConsumptionRepository extends BaseRepository<ProductionConsumption> implements IProductionConsumptionRepository {
  constructor() {
    super('production_consumptions');
  }

  async findByBatchId(batchId: string): Promise<ProductionConsumption[]> {
    return await this.table.filter((consumption: ProductionConsumption) => consumption.batch_id === batchId).toArray();
  }
}
