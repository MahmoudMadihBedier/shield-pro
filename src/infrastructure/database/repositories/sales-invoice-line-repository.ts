import { BaseRepository } from '../base-repository';
import { ISalesInvoiceLineRepository } from '../../../core/interfaces/repository';
import { SalesInvoiceLine } from '../../../core/domain/entities';

export class SalesInvoiceLineRepository extends BaseRepository<SalesInvoiceLine> implements ISalesInvoiceLineRepository {
  constructor() {
    super('sales_invoice_lines');
  }

  async findByInvoiceId(invoiceId: string): Promise<SalesInvoiceLine[]> {
    return await this.table.filter((line: SalesInvoiceLine) => line.invoice_id === invoiceId).toArray();
  }
}
