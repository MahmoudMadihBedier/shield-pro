import { SyncStatus, DatabaseAction } from '../types';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  syncLogs: string[];
}

export interface OfflineQueueItem {
  id?: number;
  table_name: string;
  action: DatabaseAction;
  record_id: string;
  data: any;
  timestamp: number;
}

export interface ISyncService {
  getState(): SyncState;
  subscribe(listener: (state: SyncState) => void): () => void;
  queueWrite(tableName: string, action: DatabaseAction, recordId: string, data: any): Promise<void>;
  triggerSync(): Promise<void>;
  pullFromServer(): Promise<void>;
  setCurrentUserId(userId: string | null): void;
}

export interface ISequenceGenerator {
  generateNext(tableName: string, prefix: string): Promise<string>;
  generatePending(tableName: string, prefix: string): string;
}

export interface IAuditService {
  log(tableName: string, action: DatabaseAction, recordId: string, oldValue: any, newValue: any): Promise<void>;
  isTableExcluded(tableName: string): boolean;
}