import { useState, useEffect, useCallback } from 'react';
import { Supplier, PurchaseInvoice, PurchaseInvoiceLine, PaymentVoucher } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { ServiceFactory } from '../services/service-factory';

export function useSuppliers(filter?: EntityFilter, params?: PaginationParams) {
  const [suppliers, setSuppliers] = useState<PaginatedResult<Supplier>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchaseService = ServiceFactory.getPurchaseService();

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await purchaseService.getSuppliers(filter, params);
      setSuppliers(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [filter, params, purchaseService]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const createSupplier = useCallback(async (supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newSupplier = await purchaseService.createSupplier(supplier);
      await loadSuppliers();
      return newSupplier;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create supplier');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [purchaseService, loadSuppliers]);

  return {
    suppliers,
    loading,
    error,
    loadSuppliers,
    createSupplier
  };
}

export function usePurchaseInvoices(filter?: EntityFilter, params?: PaginationParams) {
  const [invoices, setInvoices] = useState<PaginatedResult<PurchaseInvoice>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchaseService = ServiceFactory.getPurchaseService();

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await purchaseService.getInvoices(filter, params);
      setInvoices(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase invoices');
    } finally {
      setLoading(false);
    }
  }, [filter, params, purchaseService]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const createInvoice = useCallback(async (
    invoice: Omit<PurchaseInvoice, 'id' | 'created_at' | 'updated_at'>,
    lines: Omit<PurchaseInvoiceLine, 'id' | 'created_at' | 'updated_at'>[]
  ) => {
    setLoading(true);
    setError(null);
    try {
      const newInvoice = await purchaseService.createInvoice(invoice, lines);
      await loadInvoices();
      return newInvoice;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase invoice');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [purchaseService, loadInvoices]);

  const updateInvoice = useCallback(async (id: string, invoice: Partial<PurchaseInvoice>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedInvoice = await purchaseService.updateInvoice(id, invoice);
      await loadInvoices();
      return updatedInvoice;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update purchase invoice');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [purchaseService, loadInvoices]);

  const deleteInvoice = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await purchaseService.deleteInvoice(id);
      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete purchase invoice');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [purchaseService, loadInvoices]);

  const getInvoiceLines = useCallback(async (invoiceId: string) => {
    return await purchaseService.getInvoiceLines(invoiceId);
  }, [purchaseService]);

  return {
    invoices,
    loading,
    error,
    loadInvoices,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    getInvoiceLines
  };
}

export function usePaymentVouchers(filter?: EntityFilter, params?: PaginationParams) {
  const [vouchers, setVouchers] = useState<PaginatedResult<PaymentVoucher>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchaseService = ServiceFactory.getPurchaseService();

  const loadVouchers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await purchaseService.getPaymentVouchers(filter, params);
      setVouchers(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment vouchers');
    } finally {
      setLoading(false);
    }
  }, [filter, params, purchaseService]);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  const createPaymentVoucher = useCallback(async (voucher: Omit<PaymentVoucher, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newVoucher = await purchaseService.createPaymentVoucher(voucher);
      await loadVouchers();
      return newVoucher;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment voucher');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [purchaseService, loadVouchers]);

  return {
    vouchers,
    loading,
    error,
    loadVouchers,
    createPaymentVoucher
  };
}
