import { ISalesService } from '../../core/interfaces/services';
import { Customer, SalesInvoice, SalesInvoiceLine, SalesReturn, SalesReturnLine, ReceiptVoucher } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';

interface StatementEntry {
  date: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export class SalesService implements ISalesService {
  private customerRepository = RepositoryFactory.getCustomerRepository();
  private salesInvoiceRepository = RepositoryFactory.getSalesInvoiceRepository();
  private salesInvoiceLineRepository = RepositoryFactory.getSalesInvoiceLineRepository();
  private salesReturnRepository = RepositoryFactory.getSalesReturnRepository();
  private salesReturnLineRepository = RepositoryFactory.getSalesReturnLineRepository();
  private receiptVoucherRepository = RepositoryFactory.getReceiptVoucherRepository();

  async getCustomers(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Customer>> {
    return await this.customerRepository.findAll(filter, params);
  }

  async createCustomer(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>): Promise<Customer> {
    const newCustomer = await this.customerRepository.create(customer);
    await queueOfflineWrite('customers', 'insert', newCustomer.id, newCustomer);
    return newCustomer;
  }

  async getInvoices(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<SalesInvoice>> {
    return await this.salesInvoiceRepository.findAll(filter, params);
  }

  async createInvoice(
    invoice: Omit<SalesInvoice, 'id' | 'created_at' | 'updated_at'>,
    lines: Omit<SalesInvoiceLine, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<SalesInvoice> {
    const newInvoice = await this.salesInvoiceRepository.create(invoice);
    await queueOfflineWrite('sales_invoices', 'insert', newInvoice.id, newInvoice);

    for (const line of lines) {
      const newLine = await this.salesInvoiceLineRepository.create({
        ...line,
        invoice_id: newInvoice.id
      });
      await queueOfflineWrite('sales_invoice_lines', 'insert', newLine.id, newLine);
    }

    // NOTE: stock-movement (deducting sold qty from stock) and journal-entry
    // (Cash/AR debit vs Revenue credit) side effects are intentionally left in
    // the Sales component for this pass — see Sales.tsx handleSaveInvoice.
    // Wiring them into this service (via accounting-helpers postDoubleEntry)
    // is a follow-up.

    return newInvoice;
  }

  async updateInvoice(id: string, invoice: Partial<SalesInvoice>): Promise<SalesInvoice> {
    const updatedInvoice = await this.salesInvoiceRepository.update(id, invoice);
    await queueOfflineWrite('sales_invoices', 'update', id, updatedInvoice);
    return updatedInvoice;
  }

  async deleteInvoice(id: string): Promise<void> {
    await this.salesInvoiceRepository.delete(id);
    await queueOfflineWrite('sales_invoices', 'delete', id, { id });
  }

  async getInvoiceLines(invoiceId: string): Promise<SalesInvoiceLine[]> {
    return await this.salesInvoiceLineRepository.findByInvoiceId(invoiceId);
  }

  async createSalesReturn(
    returnData: Omit<SalesReturn, 'id' | 'created_at' | 'updated_at'>,
    lines: Omit<SalesReturnLine, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<SalesReturn> {
    const newReturn = await this.salesReturnRepository.create(returnData);
    await queueOfflineWrite('sales_returns', 'insert', newReturn.id, newReturn);

    for (const line of lines) {
      const newLine = await this.salesReturnLineRepository.create({
        ...line,
        return_id: newReturn.id
      });
      await queueOfflineWrite('sales_return_lines', 'insert', newLine.id, newLine);
    }

    // NOTE: stock-movement (adding returned qty back to stock) and journal-entry
    // (Revenue/AR reversal) side effects are intentionally left in the Sales
    // component for this pass, matching createInvoice above.

    return newReturn;
  }

  async getReceiptVouchers(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<ReceiptVoucher>> {
    return await this.receiptVoucherRepository.findAll(filter, params);
  }

  async createReceiptVoucher(voucher: Omit<ReceiptVoucher, 'id' | 'created_at' | 'updated_at'>): Promise<ReceiptVoucher> {
    const newVoucher = await this.receiptVoucherRepository.create(voucher);
    await queueOfflineWrite('receipt_vouchers', 'insert', newVoucher.id, newVoucher);
    return newVoucher;
  }

  // Ported from Sales.tsx's runCustomerStatement: opening balance (dated at
  // customer registration) + invoices (debit = total) + receipt vouchers
  // (credit = amount) + sales returns (credit = total), filtered to the date
  // range, sorted chronologically for a running balance, then returned
  // newest-first to match the component's display order.
  //
  // One deliberate deviation from the original component logic: the component
  // filters/sorts on an untyped `date` field that isn't part of the typed
  // SalesInvoice/ReceiptVoucher/SalesReturn entities here, so this uses
  // `created_at` instead (see task note). Business rules (which transactions
  // count as debit/credit, opening balance handling) are unchanged.
  async getCustomerStatement(customerId: string, startDate: string, endDate: string): Promise<StatementEntry[]> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) return [];

    type Entry = Omit<StatementEntry, 'balance'>;
    const transactions: Entry[] = [];

    transactions.push({
      date: customer.created_at,
      type: 'opening_balance',
      description: 'الرصيد الافتتاحي عند التسجيل',
      debit: Number(customer.opening_balance) || 0,
      credit: 0
    });

    const invoices = await this.salesInvoiceRepository.findByCustomerId(customerId);
    for (const inv of invoices) {
      transactions.push({
        date: inv.created_at,
        type: 'sales_invoice',
        description: `فاتورة مبيعات رقم ${inv.invoice_no}`,
        debit: Number(inv.total) || 0,
        credit: 0
      });
    }

    const vouchers = await this.receiptVoucherRepository.findByCustomerId(customerId);
    for (const v of vouchers) {
      transactions.push({
        date: v.created_at,
        type: 'receipt_voucher',
        description: `سند قبض رقم ${v.voucher_no}`,
        debit: 0,
        credit: Number(v.amount) || 0
      });
    }

    const returnsResult = await this.salesReturnRepository.findAll(
      { customer_id: customerId },
      { page: 1, limit: Number.MAX_SAFE_INTEGER }
    );
    for (const r of returnsResult.data) {
      transactions.push({
        date: r.created_at,
        type: 'sales_return',
        description: `مرتجع مبيعات رقم ${r.return_no}`,
        debit: 0,
        credit: Number(r.total) || 0
      });
    }

    let filtered = transactions;
    if (startDate) {
      filtered = filtered.filter((t) => t.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((t) => t.date <= endDate);
    }

    const chronological = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let balance = 0;
    const withBalance: StatementEntry[] = chronological.map((t) => {
      balance += t.debit - t.credit;
      return { ...t, balance };
    });

    return withBalance.reverse();
  }
}
