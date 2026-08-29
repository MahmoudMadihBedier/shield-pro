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
    lines: Omit<PurchaseInvoiceLine, 'id' | 'created_at' | 'updated_at'>[],
    warehouseId: string
  ): Promise<PurchaseInvoice> {
    // warehouse_id is now persisted on the invoice header (previously it only
    // lived on the stock_movement rows) so the goods-receipt has a home
    // branch and the journal legs can be branch-tagged.
    const newInvoice = await this.purchaseInvoiceRepository.create({ ...invoice, warehouse_id: warehouseId });
    await queueOfflineWrite('purchase_invoices', 'insert', newInvoice.id, newInvoice);

    for (const line of lines) {
      const newLine = await this.purchaseInvoiceLineRepository.create({
        ...line,
        invoice_id: newInvoice.id
      });
      await queueOfflineWrite('purchase_invoice_lines', 'insert', newLine.id, newLine);

      // Add received raw/packaging materials to stock, mirroring
      // Purchases.tsx handleSaveInvoice: movement_type 'purchase_in',
      // positive qty, linked back to the invoice. warehouseId is passed in
      // (not read off the invoice) because purchase_invoices has no
      // warehouse_id column — only stock_movements does.
      const movement = await this.stockMovementRepository.create({
        item_id: newLine.item_id,
        warehouse_id: warehouseId,
        qty: Math.abs(newLine.qty),
        movement_type: 'purchase_in',
        batch_no: newInvoice.invoice_no,
        ref_table: 'purchase_invoices',
        ref_id: newInvoice.id,
        moved_at: new Date().toISOString()
      });
      await queueOfflineWrite('stock_movements', 'insert', movement.id, movement);
    }

    // Journal entry: a purchase adds to inventory (an asset), it is not an
    // immediate expense — debit the 'inventory' account for the invoice
    // total, credit Cash (cash purchase) or AP (credit purchase). COGS is
    // recognised later, when the goods are sold. Both legs carry the
    // receiving branch.
    const inventoryAcc = (await this.accountRepository.findByCategory('inventory'))[0]?.id;
    if (!inventoryAcc) {
      throw new Error(`تعذر تسجيل القيد المحاسبي لفاتورة الشراء ${newInvoice.invoice_no}: حساب المخزون غير موجود`);
    } else if (newInvoice.payment_method === 'cash') {
      const cashAcc = (await this.accountRepository.findByCategory('cash'))[0]?.id;
      if (!cashAcc) {
        throw new Error(`تعذر تسجيل القيد المحاسبي لفاتورة الشراء ${newInvoice.invoice_no}: حساب النقدية غير موجود`);
      }
      await postDoubleEntry({
        refTable: 'purchase_invoices',
        refId: newInvoice.id,
        debitAccountId: inventoryAcc,
        creditAccountId: cashAcc,
        amount: newInvoice.total,
        date: newInvoice.date,
        warehouseId
      });
    } else if (newInvoice.payment_method === 'credit') {
      const apAcc = (await this.accountRepository.findByCategory('ap'))[0]?.id;
      if (!apAcc) {
        throw new Error(`تعذر تسجيل القيد المحاسبي لفاتورة الشراء ${newInvoice.invoice_no}: حساب الموردين الدائنين غير موجود`);
      }
      await postDoubleEntry({
        refTable: 'purchase_invoices',
        refId: newInvoice.id,
        debitAccountId: inventoryAcc,
        creditAccountId: apAcc,
        amount: newInvoice.total,
        date: newInvoice.date,
        warehouseId
      });
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

  // Real date-based AP aging per supplier — mirrors
  // SalesService.getCustomerAgingReport. Replaces the fabricated
  // 70/20/10 % split that used to sit in Reports.tsx.
  async getSupplierAgingReport(): Promise<{
    supplier_id: string;
    name: string;
    bucket_0_30: number;
    bucket_31_60: number;
    bucket_61_90: number;
    bucket_90_plus: number;
    total: number;
  }[]> {
    const suppliers = (await this.supplierRepository.findAll(undefined, { page: 1, limit: 100000 })).data;
    const today = new Date();

    const result = [];
    for (const supplier of suppliers) {
      const invoices = (await this.purchaseInvoiceRepository.findBySupplierId(supplier.id))
        .filter((i) => i.status === 'unpaid' || i.status === 'partially_paid');

      const b = { bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_90_plus: 0 };
      for (const inv of invoices) {
        const ageDays = Math.floor((today.getTime() - new Date(inv.date).getTime()) / 86_400_000);
        const amount = Number(inv.total);
        if (ageDays <= 30) b.bucket_0_30 += amount;
        else if (ageDays <= 60) b.bucket_31_60 += amount;
        else if (ageDays <= 90) b.bucket_61_90 += amount;
        else b.bucket_90_plus += amount;
      }
      const total = b.bucket_0_30 + b.bucket_31_60 + b.bucket_61_90 + b.bucket_90_plus;
      if (total > 0) result.push({ supplier_id: supplier.id, name: supplier.name, ...b, total });
    }
    return result;
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
    if (!apAcc) {
      throw new Error(`تعذر تسجيل القيد المحاسبي لسند الصرف ${newVoucher.voucher_no}: حساب الموردين الدائنين غير موجود`);
    }
    await postDoubleEntry({
      refTable: 'payment_vouchers',
      refId: newVoucher.id,
      debitAccountId: apAcc,
      creditAccountId: newVoucher.account_id,
      amount: newVoucher.amount,
      date: newVoucher.date
    });

    return newVoucher;
  }
}
