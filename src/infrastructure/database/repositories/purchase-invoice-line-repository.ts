import { BaseRepository } from '../base-repository';
import { IPurchaseInvoiceLineRepository } from '../../../core/interfaces/repository';
import { PurchaseInvoiceLine } from '../../../core/domain/entities';

export class PurchaseInvoiceLineRepository extends BaseRepository<PurchaseInvoiceLine> implements IPurchaseInvoiceLineRepository {
  constructor() {
    super('purchase_invoice_lines');
  }

  async findByInvoiceId(invoiceId: string): Promise<PurchaseInvoiceLine[]> {
    return await this.table.filter((line: PurchaseInvoiceLine) => line.invoice_id === invoiceId).toArray();
  }

  async findByItemId(itemId: string): Promise<PurchaseInvoiceLine[]> {
    return await this.table.filter((line: PurchaseInvoiceLine) => line.item_id === itemId).toArray();
  }
}
