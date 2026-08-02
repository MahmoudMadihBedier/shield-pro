import { BaseRepository } from '../base-repository';
import { ISalesReturnRepository } from '../../../core/interfaces/repository';
import { SalesReturn } from '../../../core/domain/entities';

export class SalesReturnRepository extends BaseRepository<SalesReturn> implements ISalesReturnRepository {
  constructor() {
    super('sales_returns');
  }

  async findByInvoiceId(invoiceId: string): Promise<SalesReturn[]> {
    return await this.table.filter((ret: SalesReturn) => ret.invoice_id === invoiceId).toArray();
  }
}
