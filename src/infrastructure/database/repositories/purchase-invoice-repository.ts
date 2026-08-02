import { BaseRepository } from '../base-repository';
import { IPurchaseInvoiceRepository } from '../../../core/interfaces/repository';
import { PurchaseInvoice } from '../../../core/domain/entities';

export class PurchaseInvoiceRepository extends BaseRepository<PurchaseInvoice> implements IPurchaseInvoiceRepository {
  constructor() {
    super('purchase_invoices');
  }

  async findBySupplierId(supplierId: string): Promise<PurchaseInvoice[]> {
    return await this.table.filter((invoice: PurchaseInvoice) => invoice.supplier_id === supplierId).toArray();
  }

  async findByDateRange(startDate: string, endDate: string): Promise<PurchaseInvoice[]> {
    return await this.table
      .filter((invoice: PurchaseInvoice) => invoice.created_at >= startDate && invoice.created_at <= endDate)
      .toArray();
  }
}
