import { BaseRepository } from '../base-repository';
import { ISalesInvoiceRepository } from '../../../core/interfaces/repository';
import { SalesInvoice } from '../../../core/domain/entities';

export class SalesInvoiceRepository extends BaseRepository<SalesInvoice> implements ISalesInvoiceRepository {
  constructor() {
    super('sales_invoices');
  }

  async findByCustomerId(customerId: string): Promise<SalesInvoice[]> {
    return await this.table.filter((invoice: SalesInvoice) => invoice.customer_id === customerId).toArray();
  }

  async findByDateRange(startDate: string, endDate: string): Promise<SalesInvoice[]> {
    return await this.table
      .filter((invoice: SalesInvoice) => invoice.created_at >= startDate && invoice.created_at <= endDate)
      .toArray();
  }
}
