import { useState, useEffect, useCallback } from 'react';
import { Customer, SalesInvoice, SalesInvoiceLine, SalesReturn, SalesReturnLine, ReceiptVoucher } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { ServiceFactory } from '../services/service-factory';

export function useCustomers(filter?: EntityFilter, params?: PaginationParams) {
  const [customers, setCustomers] = useState<PaginatedResult<Customer>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const salesService = ServiceFactory.getSalesService();

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await salesService.getCustomers(filter, params);
      setCustomers(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [filter, params, salesService]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const createCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newCustomer = await salesService.createCustomer(customer);
      await loadCustomers();
      return newCustomer;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [salesService, loadCustomers]);

  return {
    customers,
    loading,
    error,
    loadCustomers,
    createCustomer
  };
}

export function useSalesInvoices(filter?: EntityFilter, params?: PaginationParams) {
  const [invoices, setInvoices] = useState<PaginatedResult<SalesInvoice>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const salesService = ServiceFactory.getSalesService();

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await salesService.getInvoices(filter, params);
      setInvoices(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales invoices');
    } finally {
      setLoading(false);
    }
  }, [filter, params, salesService]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const createInvoice = useCallback(async (
    invoice: Omit<SalesInvoice, 'id' | 'created_at' | 'updated_at'>,
    lines: Omit<SalesInvoiceLine, 'id' | 'created_at' | 'updated_at'>[]
  ) => {
    setLoading(true);
    setError(null);
    try {
      const newInvoice = await salesService.createInvoice(invoice, lines);
      await loadInvoices();
      return newInvoice;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sales invoice');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [salesService, loadInvoices]);

  const updateInvoice = useCallback(async (id: string, invoice: Partial<SalesInvoice>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedInvoice = await salesService.updateInvoice(id, invoice);
      await loadInvoices();
      return updatedInvoice;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sales invoice');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [salesService, loadInvoices]);

  const deleteInvoice = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await salesService.deleteInvoice(id);
      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sales invoice');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [salesService, loadInvoices]);

  const getInvoiceLines = useCallback(async (invoiceId: string) => {
    return await salesService.getInvoiceLines(invoiceId);
  }, [salesService]);

  const createSalesReturn = useCallback(async (
    returnData: Omit<SalesReturn, 'id' | 'created_at' | 'updated_at'>,
    lines: Omit<SalesReturnLine, 'id' | 'created_at' | 'updated_at'>[]
  ) => {
    setLoading(true);
    setError(null);
    try {
      const newReturn = await salesService.createSalesReturn(returnData, lines);
      await loadInvoices();
      return newReturn;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sales return');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [salesService, loadInvoices]);

  return {
    invoices,
    loading,
    error,
    loadInvoices,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    getInvoiceLines,
    createSalesReturn
  };
}

export function useReceiptVouchers(filter?: EntityFilter, params?: PaginationParams) {
  const [vouchers, setVouchers] = useState<PaginatedResult<ReceiptVoucher>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const salesService = ServiceFactory.getSalesService();

  const loadVouchers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await salesService.getReceiptVouchers(filter, params);
      setVouchers(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load receipt vouchers');
    } finally {
      setLoading(false);
    }
  }, [filter, params, salesService]);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  const createReceiptVoucher = useCallback(async (voucher: Omit<ReceiptVoucher, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newVoucher = await salesService.createReceiptVoucher(voucher);
      await loadVouchers();
      return newVoucher;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create receipt voucher');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [salesService, loadVouchers]);

  return {
    vouchers,
    loading,
    error,
    loadVouchers,
    createReceiptVoucher
  };
}

// No automatic load on mount — a statement only makes sense once the caller
// has picked a customer (and optionally a date range), mirroring how
// useInventory exposes calculateStock as a plain on-demand callback rather
// than state driven by a useEffect.
export function useCustomerStatement() {
  const [statement, setStatement] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const salesService = ServiceFactory.getSalesService();

  const loadStatement = useCallback(async (customerId: string, startDate: string, endDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await salesService.getCustomerStatement(customerId, startDate, endDate);
      setStatement(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer statement');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [salesService]);

  return {
    statement,
    loading,
    error,
    loadStatement
  };
}
