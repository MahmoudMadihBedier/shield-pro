import { IPurchaseService } from '../../core/interfaces/services';
import { Supplier, PurchaseInvoice, PurchaseInvoiceLine, PaymentVoucher } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';

export class PurchaseService implements IPurchaseService {
  private supplierRepository = RepositoryFactory.getSupplierRepository();
  private purchaseInvoiceRepository = RepositoryFactory.getPurchaseInvoiceRepository();
  private purchaseInvoiceLineRepository = RepositoryFactory.getPurchaseInvoiceLineRepository();
  private paymentVoucherRepository = RepositoryFactory.getPaymentVoucherRepository();

  async getSuppliers(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Supplier>> {
    return await this.supplierRepository.findAll(filter, params);
  }

  async createSupplier(supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>): Promise<Supplier> {
    const newSupplier = await this.supplierRepository.create(supplier);
    await queueOfflineWrite('suppliers', 'insert', newSupplier.id, newSupplier);
    return newSupplier;
  }

  async getInvoices(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<PurchaseInvoice>> {
    return await this.purchaseInvoiceRepository.findAll(filter, params);
  }

  async createInvoice(
    invoice: Omit<PurchaseInvoice, 'id' | 'created_at' | 'updated_at'>,
    lines: Omit<PurchaseInvoiceLine, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<PurchaseInvoice> {
    const newInvoice = await this.purchaseInvoiceRepository.create(invoice);
    await queueOfflineWrite('purchase_invoices', 'insert', newInvoice.id, newInvoice);

    for (const line of lines) {
      const newLine = await this.purchaseInvoiceLineRepository.create({
        ...line,
        invoice_id: newInvoice.id
      });
      await queueOfflineWrite('purchase_invoice_lines', 'insert', newLine.id, newLine);
    }

    // NOTE: stock-movement (adding received qty to stock) and journal-entry
    // (COGS/AP or COGS/Cash) side effects are intentionally left in the
    // Purchases component for this pass — see Purchases.tsx handleSaveInvoice.
    // Wiring them into this service is a follow-up.

    return newInvoice;
  }

  async updateInvoice(id: string, invoice: Partial<PurchaseInvoice>): Promise<PurchaseInvoice> {
    const updatedInvoice = await this.purchaseInvoiceRepository.update(id, invoice);
    await queueOfflineWrite('purchase_invoices', 'update', id, updatedInvoice);
    return updatedInvoice;
  }

  async deleteInvoice(id: string): Promise<void> {
    await this.purchaseInvoiceRepository.delete(id);
    await queueOfflineWrite('purchase_invoices', 'delete', id, { id });
  }

  async getInvoiceLines(invoiceId: string): Promise<PurchaseInvoiceLine[]> {
    return await this.purchaseInvoiceLineRepository.findByInvoiceId(invoiceId);
  }

  async getPaymentVouchers(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<PaymentVoucher>> {
    return await this.paymentVoucherRepository.findAll(filter, params);
  }

  async createPaymentVoucher(voucher: Omit<PaymentVoucher, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentVoucher> {
    const newVoucher = await this.paymentVoucherRepository.create(voucher);
    await queueOfflineWrite('payment_vouchers', 'insert', newVoucher.id, newVoucher);
    return newVoucher;
  }
}
