import { BaseRepository } from '../base-repository';
import { ISalesReturnLineRepository } from '../../../core/interfaces/repository';
import { SalesReturnLine } from '../../../core/domain/entities';

export class SalesReturnLineRepository extends BaseRepository<SalesReturnLine> implements ISalesReturnLineRepository {
  constructor() {
    super('sales_return_lines');
  }

  async findByReturnId(returnId: string): Promise<SalesReturnLine[]> {
    return await this.table.filter((line: SalesReturnLine) => line.return_id === returnId).toArray();
  }
}
