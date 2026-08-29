import { db, type OfflineQueueItem } from '../database/dexie';
import { supabase } from '../api/supabase';
import { SEQUENCE_PREFIXES, AUDIT_EXCLUDED_TABLES, SYNC_TABLES } from '../../shared/constants/sequence-config';

export interface WriteResult {
  success: boolean;
  error?: string;
}

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

// Atomic server-side counter (public.next_sequence_number RPC) instead of a
// client-side read-latest-then-increment, which raced under concurrent sync
// passes and could hand out the same INV-/BATCH-/etc. number twice.
async function generateNextSequenceNo(prefix: string): Promise<string> {
  const { data, error } = await supabase.rpc('next_sequence_number', { p_prefix: prefix });
  if (error || !data) {
    addLog(`خطأ توليد الرقم التسلسلي: ${error?.message ?? 'غير معروف'}. استخدام المولد التلقائي البديل.`);
    return `${prefix}-${Math.floor(Math.random() * 900000) + 100000}`;
  }
  return data as string;
}

// Queue offline write. Returns a result instead of throwing/swallowing so
// callers that chain multiple writes into one logical operation (e.g.
// postDoubleEntry's debit+credit pair) can detect a failed leg instead of
// silently proceeding as if every step succeeded.
export async function queueOfflineWrite(
  tableName: string,
  action: 'insert' | 'update' | 'delete',
  recordId: string,
  data: any
): Promise<WriteResult> {
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

    return { success: true };
  } catch (err: any) {
    addLog(`خطأ أثناء الكتابة المحلية: ${err.message}`);
    return { success: false, error: err.message };
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
      data.batch_no?.startsWith('PENDING-') ||
      data.order_no?.startsWith('PENDING-'));

  let finalData = { ...data };

  // Resolve pending sequence numbers on sync
  if (isPendingSequence) {
    const prefix = SEQUENCE_PREFIXES[table_name];
    const seqNo = await generateNextSequenceNo(prefix);
    if (finalData.invoice_no) finalData.invoice_no = seqNo;
    else if (finalData.return_no) finalData.return_no = seqNo;
    else if (finalData.voucher_no) finalData.voucher_no = seqNo;
    else if (finalData.batch_no) finalData.batch_no = seqNo;
    else if (finalData.order_no) finalData.order_no = seqNo;

    // Update local table with final seqNo
    const table = (db as any)[table_name];
    if (table) {
      await table.put(finalData);
    }
    addLog(`تم توليد الرقم التسلسلي للمزامنة: ${seqNo}`);
  }

  // The cached user profile carries several client-side-derived fields
  // (role_name, permissions, is_client_user) that are NOT real columns on
  // public.users. PostgREST rejects the ENTIRE upsert with HTTP 400
  // (PGRST204 "column not found in schema cache") if any of them are sent,
  // which previously wedged the presence-heartbeat writes in the queue
  // forever. Whitelist the real columns instead of denylisting each derived
  // one, so a future added derived field can't reintroduce the same stall.
  if (table_name === 'users') {
    const USERS_COLUMNS = [
      'id', 'email', 'name', 'role_id', 'created_at', 'updated_at',
      'created_by', 'app_version', 'platform', 'last_seen_at', 'warehouse_id'
    ];
    finalData = Object.fromEntries(
      Object.entries(finalData).filter(([k]) => USERS_COLUMNS.includes(k))
    );
  }

  // Push to Supabase
  if (action === 'insert') {
    // Use a plain INSERT, not upsert. upsert() resolves a PK collision by
    // running an UPDATE, and many tables intentionally grant INSERT but not
    // UPDATE via RLS (e.g. user_locations, audit_log) — so a queued insert
    // whose row already exists on the server (duplicate delivery, or a pull
    // that re-added the id) would 403/400 on the hidden UPDATE path forever
    // and wedge the pending-writes counter. A genuine duplicate surfaces as
    // 23505 instead, which we treat as already-done.
    const { error } = await supabase.from(table_name).insert(finalData);
    if (error) {
      // 23505 = unique_violation. The row already exists on the server (this
      // queued insert already landed on an earlier pass whose response was
      // lost, or another device inserted an equivalent row). The desired end
      // state is satisfied, so treat it as done; the next pull reconciles the
      // local copy with the authoritative row.
      if (error.code === '23505') {
        addLog(`تم تجاهل ${table_name}: السجل موجود بالفعل على السيرفر`);
        return;
      }
      throw error;
    }
  } else if (action === 'update') {
    const { error } = await supabase.from(table_name).upsert(finalData);
    if (error) throw error;
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
      const localRecords = await localTable.toArray();
      const localById = new Map(localRecords.map((r: any) => [r.id, r]));

      const toPut = data.filter((rec: any) => {
        if (pendingIds.has(rec.id)) return false;
        // Every local write queues synchronously, so a local copy newer than
        // what the server just returned but NOT in the pending queue should
        // not happen -- if it does, something is wrong (a write that landed
        // in Dexie without reaching the queue). Don't silently clobber it.
        const local = localById.get(rec.id) as any;
        if (local?.updated_at && rec.updated_at && local.updated_at > rec.updated_at) {
          addLog(`تخطي تحديث ${t}/${rec.id}: نسخة محلية أحدث لم تتم مزامنتها بعد`);
          return false;
        }
        return true;
      });
      if (toPut.length > 0) {
        await localTable.bulkPut(toPut);
      }

      // Drop local records that no longer exist on the server (deleted by
      // another user) — but never a record still pending local sync. Reuses
      // the localRecords snapshot taken above (bulkPut only touches records
      // that still exist on the server, so it can't change this set).
      const serverIds = new Set(data.map((rec: any) => rec.id));
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
