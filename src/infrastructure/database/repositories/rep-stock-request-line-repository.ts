import { BaseRepository } from '../base-repository';
import { IRepStockRequestLineRepository } from '../../../core/interfaces/repository';
import { RepStockRequestLine } from '../../../core/domain/entities';

export class RepStockRequestLineRepository extends BaseRepository<RepStockRequestLine> implements IRepStockRequestLineRepository {
  constructor() {
    super('rep_stock_request_lines');
  }

  async findByRequestId(requestId: string): Promise<RepStockRequestLine[]> {
    return await this.table.filter((l: RepStockRequestLine) => l.request_id === requestId).toArray();
  }
}
