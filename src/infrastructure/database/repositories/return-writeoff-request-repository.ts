import { BaseRepository } from '../base-repository';
import { IReturnWriteoffRequestRepository } from '../../../core/interfaces/repository';
import { ReturnWriteoffRequest } from '../../../core/domain/entities';

export class ReturnWriteoffRequestRepository extends BaseRepository<ReturnWriteoffRequest> implements IReturnWriteoffRequestRepository {
  constructor() {
    super('return_writeoff_requests');
  }

  async findByStatus(status: string): Promise<ReturnWriteoffRequest[]> {
    return await this.table.filter((r: ReturnWriteoffRequest) => r.status === status).toArray();
  }
}
