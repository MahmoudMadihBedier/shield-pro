import { BaseRepository } from '../base-repository';
import { IProductionRequestRepository } from '../../../core/interfaces/repository';
import { ProductionRequest } from '../../../core/domain/entities';

export class ProductionRequestRepository extends BaseRepository<ProductionRequest> implements IProductionRequestRepository {
  constructor() {
    super('production_requests');
  }

  async findByStatus(status: string): Promise<ProductionRequest[]> {
    return await this.table.filter((r: ProductionRequest) => r.status === status).toArray();
  }

  async findByRequestedBy(userId: string): Promise<ProductionRequest[]> {
    return await this.table.filter((r: ProductionRequest) => r.requested_by === userId).toArray();
  }
}
