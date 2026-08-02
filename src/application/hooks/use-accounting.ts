import { useState, useEffect, useCallback } from 'react';
import { Account, AccountTransaction } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { ServiceFactory } from '../services/service-factory';

export function useAccounts(filter?: EntityFilter, params?: PaginationParams) {
  const [accounts, setAccounts] = useState<PaginatedResult<Account>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountingService = ServiceFactory.getAccountingService();

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await accountingService.getAccounts(filter, params);
      setAccounts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [filter, params, accountingService]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const createAccount = useCallback(async (account: Omit<Account, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newAccount = await accountingService.createAccount(account);
      await loadAccounts();
      return newAccount;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [accountingService, loadAccounts]);

  const getAccountBalance = useCallback(async (accountId: string) => {
    return await accountingService.getAccountBalance(accountId);
  }, [accountingService]);

  const getCashBankBalance = useCallback(async () => {
    return await accountingService.getCashBankBalance();
  }, [accountingService]);

  return {
    accounts,
    loading,
    error,
    loadAccounts,
    createAccount,
    getAccountBalance,
    getCashBankBalance
  };
}

export function useAccountTransactions(filter?: EntityFilter, params?: PaginationParams) {
  const [transactions, setTransactions] = useState<PaginatedResult<AccountTransaction>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountingService = ServiceFactory.getAccountingService();

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await accountingService.getTransactions(filter, params);
      setTransactions(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account transactions');
    } finally {
      setLoading(false);
    }
  }, [filter, params, accountingService]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const createTransaction = useCallback(async (transaction: Omit<AccountTransaction, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newTransaction = await accountingService.createTransaction(transaction);
      await loadTransactions();
      return newTransaction;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account transaction');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [accountingService, loadTransactions]);

  const getProfitLoss = useCallback(async (startDate: string, endDate: string) => {
    return await accountingService.getProfitLoss(startDate, endDate);
  }, [accountingService]);

  return {
    transactions,
    loading,
    error,
    loadTransactions,
    createTransaction,
    getProfitLoss
  };
}
