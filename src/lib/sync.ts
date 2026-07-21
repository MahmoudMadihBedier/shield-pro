import { db, type OfflineQueueItem } from './dexie';
import { supabase } from './supabase';

export type SyncState = {
  status: 'online' | 'offline' | 'syncing' | 'error';
  pendingCount: number;
  lastSyncedAt: string | null;
  syncLogs: string[];
};

let syncState: SyncState = {
  status: navigator.onLine ? 'online' : 'offline',
  pendingCount: 0,
  lastSyncedAt: localStorage.getItem('lastSyncedAt'),
  syncLogs: []
};

let currentUserId: string | null = null;

// Called by authContext on sign-in/sign-out so writes can be attributed in the audit log
export function setCurrentUserId(id: string | null) {
  currentUserId = id;
}

const AUDIT_EXCLUDED_TABLES = new Set(['audit_log', 'offline_queue']);

async function logAudit(tableName: string, action: 'insert' | 'update' | 'delete', recordId: string, oldValue: any, newValue: any) {
  try {
    const id = crypto.randomUUID();
    await queueOfflineWrite('audit_log', 'insert', id, {
      id,
      user_id: currentUserId,
      table_name: tableName,
      record_id: recordId,
      action,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      timestamp: new Date().toISOString()
    });
  } catch {
    // Auditing must never block the primary write
  }
}

const listeners = new Set<(state: SyncState) => void>();

export function subscribeToSync(listener: (state: SyncState) => void) {
  listeners.add(listener);
  listener(syncState);
  return () => {
    listeners.delete(listener);
  };
}

function updateSyncState(updates: Partial<SyncState>) {
  syncState = { ...syncState, ...updates };
  listeners.forEach(l => l(syncState));
}

function addLog(msg: string) {
  const time = new Date().toLocaleTimeString('ar-EG');
  const log = `[${time}] ${msg}`;
  const updatedLogs = [log, ...syncState.syncLogs].slice(0, 50);
  updateSyncState({ syncLogs: updatedLogs });
}

// Map of tables to their prefix
const sequencePrefixes: { [key: string]: string } = {
  sales_invoices: 'INV',
  purchase_invoices: 'PUR',
  sales_returns: 'SRT',
  purchase_returns: 'PRT',
  receipt_vouchers: 'REC',
  payment_vouchers: 'PAY',
  production_batches: 'BAT'
};

// Map of tables to their specific sequence column
const sequenceColumns: { [key: string]: string } = {
  sales_invoices: 'invoice_no',
  purchase_invoices: 'invoice_no',
  sales_returns: 'return_no',
  purchase_returns: 'return_no',
  receipt_vouchers: 'voucher_no',
  payment_vouchers: 'voucher_no',
  production_batches: 'batch_no'
};

async function generateNextSequenceNo(tableName: string, prefix: string): Promise<string> {
  try {
    const colName = sequenceColumns[tableName];
    if (!colName) {
      throw new Error(`No sequence column mapping found for table ${tableName}`);
    }

    const { data, error } = await (supabase
      .from(tableName)
      .select(colName as any) as any)
      .order('created_at', { ascending: false })
      .limit(1);

    let nextNo = 10001;
    if (!error && data && data.length > 0) {
      const record = data[0] as any;
      const val = record[colName] || '';
      const match = val.match(/\d+/);
      if (match) {
        nextNo = parseInt(match[0], 10) + 1;
      }
    }
    return `${prefix}-${nextNo}`;
  } catch (err: any) {
    addLog(`خطأ توليد السيرفر للعمود: ${err.message}. استخدام المولد التلقائي البديل.`);
    return `${prefix}-${Math.floor(Math.random() * 900000) + 100000}`;
  }
}

// Queue offline write
export async function queueOfflineWrite(
  tableName: string,
  action: 'insert' | 'update' | 'delete',
  recordId: string,
  data: any
) {
  try {
    // 1. Write to local Dexie table (if not deleting)
    const table = (db as any)[tableName];
    const shouldAudit = !AUDIT_EXCLUDED_TABLES.has(tableName);
    const oldValue = shouldAudit && table ? await table.get(recordId) : null;

    if (table) {
      if (action === 'delete') {
        await table.delete(recordId);
      } else {
        await table.put(data);
      }
    }

    // 2. Add to offline queue
    await db.offline_queue.add({
      table_name: tableName,
      action,
      record_id: recordId,
      data,
      timestamp: Date.now()
    });

    const pending = await db.offline_queue.count();
    updateSyncState({ pendingCount: pending });
    addLog(`تم حفظ العملية محلياً في جدول ${tableName}`);

    // 3. Record audit trail entry (never blocks the primary write)
    if (shouldAudit) {
      await logAudit(tableName, action, recordId, oldValue, action === 'delete' ? null : data);
    }

    // 4. Trigger immediate sync if online
    if (navigator.onLine) {
      triggerSync();
    }
  } catch (err: any) {
    addLog(`خطأ أثناء الكتابة المحلية: ${err.message}`);
  }
}

// Sync single queue item
async function syncQueueItem(item: OfflineQueueItem) {
  const { table_name, action, record_id, data } = item;
  const isPendingSequence =
    action === 'insert' &&
    sequencePrefixes[table_name] &&
    (data.invoice_no?.startsWith('PENDING-') ||
      data.return_no?.startsWith('PENDING-') ||
      data.voucher_no?.startsWith('PENDING-') ||
      data.batch_no?.startsWith('PENDING-'));

  let finalData = { ...data };

  // Resolve pending sequence numbers on sync
  if (isPendingSequence) {
    const prefix = sequencePrefixes[table_name];
    const seqNo = await generateNextSequenceNo(table_name, prefix);
    if (finalData.invoice_no) finalData.invoice_no = seqNo;
    else if (finalData.return_no) finalData.return_no = seqNo;
    else if (finalData.voucher_no) finalData.voucher_no = seqNo;
    else if (finalData.batch_no) finalData.batch_no = seqNo;

    // Update local table with final seqNo
    const table = (db as any)[table_name];
    if (table) {
      await table.put(finalData);
    }
    addLog(`تم توليد الرقم التسلسلي للمزامنة: ${seqNo}`);
  }

  // Push to Supabase
  if (action === 'insert' || action === 'update') {
    const { error } = await supabase.from(table_name).upsert(finalData);
    if (error) throw error;
  } else if (action === 'delete') {
    const { error } = await supabase.from(table_name).delete().eq('id', record_id);
    if (error) throw error;
  }
}

let isSyncing = false;

// Pull all latest data from Supabase
export async function pullFromServer() {
  if (!navigator.onLine) return;
  addLog("بدء جلب البيانات الحديثة من السيرفر...");
  const tables = [
    'roles', 'users', 'permissions', 'role_permissions', 'customers',
    'suppliers', 'warehouses', 'units', 'unit_conversions', 'settings',
    'items', 'price_lists', 'item_recipes', 'production_batches',
    'production_consumptions', 'stock_movements', 'sales_invoices',
    'sales_invoice_lines', 'sales_returns', 'sales_return_lines',
    'purchase_invoices', 'purchase_invoice_lines', 'purchase_returns',
    'purchase_return_lines', 'accounts', 'account_transactions',
    'receipt_vouchers', 'payment_vouchers', 'fixed_assets', 'expenses',
    'employees', 'attendance', 'payroll_runs', 'audit_log', 'user_locations'
  ];

  for (const t of tables) {
    try {
      const { data, error } = await supabase.from(t).select('*');
      if (!error && data) {
        const localTable = (db as any)[t];
        if (localTable) {
          await localTable.clear();
          if (data.length > 0) {
            await localTable.bulkPut(data);
          }
        }
      }
    } catch (e: any) {
      addLog(`فشل مزامنة جدول ${t} من السيرفر: ${e.message}`);
    }
  }

  const nowStr = new Date().toLocaleString('ar-EG');
  localStorage.setItem('lastSyncedAt', nowStr);
  updateSyncState({ lastSyncedAt: nowStr });
  addLog("تم جلب وتحديث جميع الجداول بنجاح!");
}

// Push local queued writes to server
export async function triggerSync() {
  if (isSyncing || !navigator.onLine) {
    updateSyncState({ status: navigator.onLine ? 'online' : 'offline' });
    return;
  }

  isSyncing = true;
  updateSyncState({ status: 'syncing' });
  addLog("بدء مزامنة البيانات الصادرة...");

  try {
    let queue = await db.offline_queue.orderBy('id').toArray();
    while (queue.length > 0) {
      const item = queue[0];
      try {
        await syncQueueItem(item);
        if (item.id !== undefined) {
          await db.offline_queue.delete(item.id);
        }
        addLog(`تمت مزامنة ${item.table_name} بنجاح`);
      } catch (err: any) {
        addLog(`خطأ أثناء مزامنة ${item.table_name}: ${err.message}`);
        updateSyncState({ status: 'error' });
        isSyncing = false;
        return;
      }
      queue = await db.offline_queue.orderBy('id').toArray();
      updateSyncState({ pendingCount: queue.length });
    }

    addLog("تمت مزامنة جميع البيانات الصادرة بنجاح!");
    updateSyncState({ status: 'online', pendingCount: 0 });

    // After pushing, pull fresh copy of state
    await pullFromServer();
  } catch (err: any) {
    addLog(`خطأ عام في المزامنة: ${err.message}`);
    updateSyncState({ status: 'error' });
  } finally {
    isSyncing = false;
  }
}

// Initialize online/offline event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    updateSyncState({ status: 'online' });
    addLog("تم استعادة الاتصال بالشبكة! بدء المزامنة التلقائية...");
    triggerSync();
  });

  window.addEventListener('offline', () => {
    updateSyncState({ status: 'offline' });
    addLog("انقطع الاتصال بالشبكة. تعمل الآن في وضع الأوفلاين.");
  });
}
