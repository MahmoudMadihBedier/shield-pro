import { db, type OfflineQueueItem } from '../database/dexie';
import { supabase } from '../api/supabase';
import { SEQUENCE_PREFIXES, SEQUENCE_COLUMNS, AUDIT_EXCLUDED_TABLES, SYNC_TABLES } from '../../shared/constants/sequence-config';

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

// Audit entries are system bookkeeping, not a separate action the employee
// performed. Keep them syncing, but don't count them in the user-facing badge.
async function getVisiblePendingCount() {
  return db.offline_queue.where('table_name').notEqual('audit_log').count();
}

// Called by authContext on sign-in/sign-out so writes can be attributed in the audit log
export function setCurrentUserId(id: string | null) {
  currentUserId = id;
  // Pull the latest server state as soon as we know who's logged in, instead of
  // waiting for a manual Settings sync or for this user's own push to succeed.
  if (id && navigator.onLine) {
    // Only sync if we have a valid authenticated user
    pullFromServer();
    triggerSync();
  }
}

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

async function generateNextSequenceNo(tableName: string, prefix: string): Promise<string> {
  try {
    const colName = SEQUENCE_COLUMNS[tableName];
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

    const pending = await getVisiblePendingCount();
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
    SEQUENCE_PREFIXES[table_name] &&
    (data.invoice_no?.startsWith('PENDING-') ||
      data.return_no?.startsWith('PENDING-') ||
      data.voucher_no?.startsWith('PENDING-') ||
      data.batch_no?.startsWith('PENDING-'));

  let finalData = { ...data };

  // Resolve pending sequence numbers on sync
  if (isPendingSequence) {
    const prefix = SEQUENCE_PREFIXES[table_name];
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

  // users.role_name / users.permissions are computed client-side (joined from
  // roles / role_permissions) for offline permission checks and get cached
  // locally alongside the real row — but they aren't actual columns on
  // public.users, so PostgREST rejects the whole write if they're sent.
  if (table_name === 'users') {
    delete finalData.role_name;
    delete finalData.permissions;
  }

  // Push to Supabase
  if (action === 'insert' || action === 'update') {
    const { error } = await supabase.from(table_name).upsert(finalData);
    if (error) {
      // 23505 = unique_violation. Another device already inserted an
      // equivalent row (e.g. two devices both seeding the same default
      // permission/role before either had pulled the other's write down).
      // The desired end state — that row existing — is already satisfied,
      // so treat it as done instead of retrying forever; the next pull
      // reconciles this device's local copy with the authoritative row.
      if (action === 'insert' && error.code === '23505') {
        addLog(`تم تجاهل ${table_name}: السجل موجود بالفعل على السيرفر`);
        return;
      }
      throw error;
    }
  } else if (action === 'delete') {
    const { error } = await supabase.from(table_name).delete().eq('id', record_id);
    if (error) throw error;
  }
}

let isSyncing = false;

let isPulling = false;

// Pull all latest data from Supabase, merging it into the local cache without
// clobbering records this device still has queued to push (an in-flight local
// edit shouldn't disappear from the UI just because a periodic pull ran).
export async function pullFromServer() {
  if (!navigator.onLine || isPulling) return;
  
  // Check if user is authenticated before trying to sync
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    addLog("لا توجد جلسة مصادقة، تم إلغاء المزامنة");
    return;
  }
  
  isPulling = true;
  try {
  addLog("بدء جلب البيانات الحديثة من السيرفر...");

  for (const t of SYNC_TABLES) {
    try {
      const { data, error } = await supabase.from(t).select('*');
      if (error || !data) {
        if (error) addLog(`فشل مزامنة جدول ${t} من السيرفر: ${error.message}`);
        continue;
      }

      const localTable = (db as any)[t];
      if (!localTable) continue;

      const pendingIds = new Set(
        (await db.offline_queue.where('table_name').equals(t).toArray()).map(i => i.record_id)
      );

      // Records this device deleted/updated/inserted locally but hasn't pushed
      // yet keep their local version; the server copy will land once it syncs.
      const toPut = data.filter((rec: any) => !pendingIds.has(rec.id));
      if (toPut.length > 0) {
        await localTable.bulkPut(toPut);
      }

      // Drop local records that no longer exist on the server (deleted by
      // another user) — but never a record still pending local sync.
      const serverIds = new Set(data.map((rec: any) => rec.id));
      const localRecords = await localTable.toArray();
      const staleIds = localRecords
        .map((rec: any) => rec.id)
        .filter((id: string) => !serverIds.has(id) && !pendingIds.has(id));
      if (staleIds.length > 0) {
        await localTable.bulkDelete(staleIds);
      }
    } catch (e: any) {
      addLog(`فشل مزامنة جدول ${t} من السيرفر: ${e.message}`);
    }
  }

  const nowStr = new Date().toLocaleString('ar-EG');
  localStorage.setItem('lastSyncedAt', nowStr);
  updateSyncState({ lastSyncedAt: nowStr });
  addLog("تم جلب وتحديث جميع الجداول بنجاح!");
  } finally {
    isPulling = false;
  }
}

// Push local queued writes to server
export async function triggerSync() {
  if (isSyncing || !navigator.onLine) {
    updateSyncState({ status: navigator.onLine ? 'online' : 'offline' });
    return;
  }

  // Check if user is authenticated before trying to sync
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    addLog("لا توجد جلسة مصادقة، تم إلغاء المزامنة");
    return;
  }

  isSyncing = true;
  updateSyncState({ status: 'syncing' });
  addLog("بدء مزامنة البيانات الصادرة...");

  try {
    // Snapshot the queue for this pass and walk it in order. A record that
    // fails to sync (e.g. a permission error, a stale reference) is skipped
    // rather than aborting the run, so every OTHER unrelated pending write
    // still reaches the server this pass instead of queuing up behind it
    // forever. Failed items stay in the queue and are retried on the next
    // pass (see the periodic retry timer below).
    const queue = await db.offline_queue.orderBy('id').toArray();
    let failureCount = 0;

    for (const item of queue) {
      try {
        await syncQueueItem(item);
        if (item.id !== undefined) {
          await db.offline_queue.delete(item.id);
        }
        addLog(`تمت مزامنة ${item.table_name} بنجاح`);
      } catch (err: any) {
        failureCount++;
        addLog(`خطأ أثناء مزامنة ${item.table_name} (سيعاد المحاولة لاحقاً): ${err.message}`);
      }
      const remaining = await getVisiblePendingCount();
      updateSyncState({ pendingCount: remaining });
    }

    if (failureCount === 0) {
      addLog("تمت مزامنة جميع البيانات الصادرة بنجاح!");
      updateSyncState({ status: 'online' });
      // After a fully clean push, pull fresh copy of state
      await pullFromServer();
    } else {
      addLog(`تعذرت مزامنة ${failureCount} عملية، سيتم إعادة المحاولة تلقائياً`);
      updateSyncState({ status: 'error' });
    }
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

  // No realtime subscriptions exist yet, so without polling a user only ever
  // sees what was true when they logged in (or last pushed). Poll both
  // directions on a timer: pull so other users' changes actually arrive, and
  // retry the push queue so a transient failure doesn't stay stuck until the
  // next manual write or reconnect event.
  setInterval(() => {
    if (navigator.onLine) pullFromServer();
  }, 120_000); // Increased from 30s to 2 minutes

  setInterval(() => {
    if (navigator.onLine) triggerSync();
  }, 60_000); // Increased from 20s to 1 minute
}
