import { BaseRepository } from '../base-repository';
import { IRepStockRequestRepository } from '../../../core/interfaces/repository';
import { RepStockRequest } from '../../../core/domain/entities';

export class RepStockRequestRepository extends BaseRepository<RepStockRequest> implements IRepStockRequestRepository {
  constructor() {
    super('rep_stock_requests');
  }

  async findByStatus(status: string): Promise<RepStockRequest[]> {
    return await this.table.filter((r: RepStockRequest) => r.status === status).toArray();
  }

  async findByRepId(repUserId: string): Promise<RepStockRequest[]> {
    return await this.table.filter((r: RepStockRequest) => r.rep_user_id === repUserId).toArray();
  }
}
