// Core shared types for the application

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EntityFilter {
  [key: string]: any;
}

export type SyncStatus = 'online' | 'offline' | 'syncing' | 'error';

export type DatabaseAction = 'insert' | 'update' | 'delete';

export interface CustomerStatementEntry {
  date: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface ProfitLoss {
  revenue: number;
  expenses: number;
  netProfit: number;
}