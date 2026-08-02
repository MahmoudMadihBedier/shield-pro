import { IPurchaseService } from '../../core/interfaces/services';
import { Supplier, PurchaseInvoice, PurchaseInvoiceLine, PaymentVoucher } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';
import { postDoubleEntry } from './accounting-helpers';

export class PurchaseService implements IPurchaseService {
  private supplierRepository = RepositoryFactory.getSupplierRepository();
  private purchaseInvoiceRepository = RepositoryFactory.getPurchaseInvoiceRepository();
  private purchaseInvoiceLineRepository = RepositoryFactory.getPurchaseInvoiceLineRepository();
  private paymentVoucherRepository = RepositoryFactory.getPaymentVoucherRepository();
  private stockMovementRepository = RepositoryFactory.getStockMovementRepository();
  private accountRepository = RepositoryFactory.getAccountRepository();

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

      // Add received raw/packaging materials to stock, mirroring
      // Purchases.tsx handleSaveInvoice: movement_type 'purchase_in',
      // positive qty, linked back to the invoice.
      const movement = await this.stockMovementRepository.create({
        item_id: newLine.item_id,
        warehouse_id: newInvoice.warehouse_id,
        qty: Math.abs(newLine.qty),
        movement_type: 'purchase_in',
        batch_no: newInvoice.invoice_no,
        reference_type: 'purchase_invoices',
        reference_id: newInvoice.id
      });
      // See SalesService.createInvoice for why ref_table/ref_id/moved_at are
      // bridged onto the synced payload here (real runtime schema, not what
      // the StockMovement entity type declares).
      await queueOfflineWrite('stock_movements', 'insert', movement.id, {
        ...movement,
        ref_table: 'purchase_invoices',
        ref_id: newInvoice.id,
        moved_at: movement.created_at
      });
    }

    // Journal entry, mirroring Purchases.tsx handleSaveInvoice: debit COGS
    // for the invoice total, credit Cash (cash purchase) or AP (credit
    // purchase).
    const cogsAcc = (await this.accountRepository.findByCategory('cogs'))[0]?.id;
    if (newInvoice.payment_method === 'cash') {
      const cashAcc = (await this.accountRepository.findByCategory('cash'))[0]?.id;
      if (cogsAcc && cashAcc) {
        await postDoubleEntry({
          refTable: 'purchase_invoices',
          refId: newInvoice.id,
          debitAccountId: cogsAcc,
          creditAccountId: cashAcc,
          amount: newInvoice.total,
          date: newInvoice.date
        });
      }
    } else if (newInvoice.payment_method === 'credit') {
      const apAcc = (await this.accountRepository.findByCategory('ap'))[0]?.id;
      if (cogsAcc && apAcc) {
        await postDoubleEntry({
          refTable: 'purchase_invoices',
          refId: newInvoice.id,
          debitAccountId: cogsAcc,
          creditAccountId: apAcc,
          amount: newInvoice.total,
          date: newInvoice.date
        });
      }
    }

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

    // Mirrors Purchases.tsx handleSavePaymentVoucher: mark the linked invoice
    // paid/partially_paid based on the sum of payment vouchers applied to it.
    if (newVoucher.invoice_id) {
      const invoice = await this.purchaseInvoiceRepository.findById(newVoucher.invoice_id);
      if (invoice) {
        const supplierVouchers = await this.paymentVoucherRepository.findBySupplierId(invoice.supplier_id);
        const totalPaid = supplierVouchers
          .filter((v) => v.invoice_id === invoice.id)
          .reduce((sum, v) => sum + Number(v.amount), 0);
        const status = totalPaid >= invoice.total ? 'paid' : 'partially_paid';

        const updatedInvoice = await this.purchaseInvoiceRepository.update(invoice.id, { status });
        await queueOfflineWrite('purchase_invoices', 'update', invoice.id, updatedInvoice);
      }
    }

    // Journal entry, mirroring Purchases.tsx: debit AP, credit Cash/Bank (the
    // voucher's account).
    const apAcc = (await this.accountRepository.findByCategory('ap'))[0]?.id;
    if (apAcc) {
      await postDoubleEntry({
        refTable: 'payment_vouchers',
        refId: newVoucher.id,
        debitAccountId: apAcc,
        creditAccountId: newVoucher.account_id,
        amount: newVoucher.amount,
        date: newVoucher.date
      });
    }

    return newVoucher;
  }
}
