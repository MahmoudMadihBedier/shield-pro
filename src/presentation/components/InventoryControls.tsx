import React, { useCallback, useEffect, useState } from 'react';
import { db } from '../../infrastructure/database/dexie';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { ServiceFactory } from '../../application/services/service-factory';
import { useAuth } from '../../application/services/auth-service';
import { useToast } from './ui/Toast';
import { getErrorMessage } from '../../shared/utils/errors';
import { ClipboardCheck, RotateCcw, ListTodo, Search } from 'lucide-react';

// Phase 2.7 (QC hold/release), 2.8 (returns/write-offs), 2.9 (physical
// stock count), 1.1 (batch traceability lookup) in one screen — each is a
// request/record that a DIFFERENT person than the originator must act on
// before it touches stock (except the read-only traceability lookup).
export const InventoryControls: React.FC = () => {
  const { profile, checkPermission } = useAuth();
  const { success, error } = useToast();
  const manufacturingService = ServiceFactory.getManufacturingService();
  const returnWriteoffService = ServiceFactory.getReturnWriteoffService();
  const stockCountService = ServiceFactory.getStockCountService();
  const traceabilityService = ServiceFactory.getTraceabilityService();

  const [subTab, setSubTab] = useState<'qc' | 'returns' | 'count' | 'trace'>('qc');
  const [traceBatchNo, setTraceBatchNo] = useState('');
  const [traceResult, setTraceResult] = useState<any>(null);
  const [allBatches, setAllBatches] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [pendingQcBatches, setPendingQcBatches] = useState<any[]>([]);
  const [rwRequests, setRwRequests] = useState<any[]>([]);
  const [countSessions, setCountSessions] = useState<any[]>([]);
  const [countLines, setCountLines] = useState<{ [sessionId: string]: any[] }>({});
  const [loading, setLoading] = useState(false);

  const [qcReason, setQcReason] = useState<{ [batchId: string]: string }>({});

  const [rwType, setRwType] = useState<'customer_return' | 'damage_writeoff'>('damage_writeoff');
  const [rwItemId, setRwItemId] = useState('');
  const [rwWarehouseId, setRwWarehouseId] = useState('');
  const [rwQty, setRwQty] = useState('1');
  const [rwReason, setRwReason] = useState('');
  const [rwRejectReason, setRwRejectReason] = useState<{ [id: string]: string }>({});

  const [countWarehouseId, setCountWarehouseId] = useState('');
  const [countInputs, setCountInputs] = useState<{ [sessionId: string]: { [itemId: string]: string } }>({});

  const canApprove = checkPermission('inventory', 'edit');

  const loadData = useCallback(async () => {
    const [listItems, listWarehouses, batches, rwList, sessions, batchesAll] = await Promise.all([
      db.items.toArray(),
      RepositoryFactory.getWarehouseRepository().findActive(),
      db.production_batches.where('status').equals('pending_qc').toArray(),
      returnWriteoffService.getRequests(),
      db.stock_count_sessions.toArray(),
      db.production_batches.toArray()
    ]);
    setItems(listItems);
    setWarehouses(listWarehouses);
    setPendingQcBatches(batches);
    setAllBatches(batchesAll);
    setRwRequests(rwList.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setCountSessions(sessions.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

    const linesBySession: { [sessionId: string]: any[] } = {};
    for (const s of sessions) {
      linesBySession[s.id] = await stockCountService.getSessionLines(s.id);
    }
    setCountLines(linesBySession);
  }, [returnWriteoffService, stockCountService]);

  useEffect(() => { loadData(); }, [loadData]);

  const itemName = (id: string) => items.find((i) => i.id === id)?.name || id;
  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name || id;

  const handleQcDecision = async (batchId: string, approve: boolean) => {
    if (!profile?.id || !warehouses[0]) return;
    setLoading(true);
    try {
      await manufacturingService.releaseBatchQC(batchId, profile.id, approve, warehouses[0].id, qcReason[batchId]);
      success(approve ? 'تم اعتماد الدفعة وإضافتها للمخزون' : 'تم رفض الدفعة');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل تنفيذ الإجراء'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReturnWriteoff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !rwItemId || !rwWarehouseId || !rwReason.trim()) {
      error('يرجى تعبئة كل الحقول');
      return;
    }
    setLoading(true);
    try {
      await returnWriteoffService.createRequest(rwType, rwItemId, rwWarehouseId, Number(rwQty), rwReason.trim(), profile.id);
      success('تم إرسال الطلب بانتظار الاعتماد');
      setRwReason(''); setRwQty('1');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل إرسال الطلب'));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRw = async (id: string) => {
    if (!profile?.id) return;
    try {
      await returnWriteoffService.approveRequest(id, profile.id);
      success('تم الاعتماد وتحديث المخزون');
      await loadData();
    } catch (e) { error(getErrorMessage(e, 'فشل الاعتماد')); }
  };

  const handleRejectRw = async (id: string) => {
    if (!profile?.id) return;
    const reason = rwRejectReason[id];
    if (!reason?.trim()) { error('يرجى إدخال سبب الرفض'); return; }
    try {
      await returnWriteoffService.rejectRequest(id, profile.id, reason.trim());
      success('تم الرفض');
      await loadData();
    } catch (e) { error(getErrorMessage(e, 'فشل الرفض')); }
  };

  const handleOpenCountSession = async () => {
    if (!profile?.id || !countWarehouseId) { error('يرجى اختيار المخزن'); return; }
    setLoading(true);
    try {
      await stockCountService.openSession(countWarehouseId, profile.id, items.map((i) => i.id));
      success('تم فتح جلسة جرد جديدة');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل فتح الجلسة'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCount = async (sessionId: string) => {
    const lines = countLines[sessionId] || [];
    const counts = lines.map((l) => ({
      item_id: l.item_id,
      counted_qty: Number(countInputs[sessionId]?.[l.item_id] ?? l.expected_qty)
    }));
    setLoading(true);
    try {
      await stockCountService.submitCounts(sessionId, counts);
      success('تم إرسال نتائج الجرد بانتظار الاعتماد');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل إرسال النتائج'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOff = async (sessionId: string) => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      await stockCountService.signOff(sessionId, profile.id);
      success('تم اعتماد نتائج الجرد وتسجيل فروق المخزون');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل الاعتماد'));
    } finally {
      setLoading(false);
    }
  };

  const handleTrace = async () => {
    const batch = allBatches.find((b) => b.batch_no === traceBatchNo.trim());
    if (!batch) {
      error('لم يتم العثور على دفعة بهذا الرقم');
      setTraceResult(null);
      return;
    }
    setLoading(true);
    try {
      const result = await traceabilityService.getBatchTraceability(batch.id);
      setTraceResult(result);
    } catch (e) {
      error(getErrorMessage(e, 'فشل جلب سجل التتبع'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ضوابط المخزون</h1>

      <div className="flex border-b border-gray-200 bg-white rounded-lg p-1 shadow-sm">
        <button onClick={() => setSubTab('qc')} className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium ${subTab === 'qc' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`}>
          <ClipboardCheck className="h-4 w-4" /><span>فحص الجودة (QC)</span>
        </button>
        <button onClick={() => setSubTab('returns')} className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium ${subTab === 'returns' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`}>
          <RotateCcw className="h-4 w-4" /><span>مرتجعات وإتلافات</span>
        </button>
        <button onClick={() => setSubTab('count')} className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium ${subTab === 'count' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`}>
          <ListTodo className="h-4 w-4" /><span>الجرد الفعلي</span>
        </button>
        <button onClick={() => setSubTab('trace')} className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium ${subTab === 'trace' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`}>
          <Search className="h-4 w-4" /><span>تتبع الدفعة (Traceability)</span>
        </button>
      </div>

      {subTab === 'trace' && (
        <div className="bg-white p-5 rounded-lg border shadow">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">تتبع دفعة إنتاج — للأمام وللخلف</h3>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="text"
              value={traceBatchNo}
              onChange={(e) => setTraceBatchNo(e.target.value)}
              placeholder="رقم الدفعة (BAT-XXXXX)"
              className="border rounded p-2 text-sm font-mono"
            />
            <button onClick={handleTrace} disabled={loading} className="bg-blue-600 text-white text-sm px-4 py-2 rounded">بحث</button>
          </div>
          {traceResult && (
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-bold text-gray-700 mb-1">المواد الخام المستهلكة (للخلف)</h4>
                {traceResult.rawMaterialsConsumed.length === 0 ? <p className="text-gray-400 text-xs">لا يوجد</p> : (
                  <ul className="list-disc pr-5 text-xs text-gray-600">
                    {traceResult.rawMaterialsConsumed.map((r: any, i: number) => (
                      <li key={i}>{r.item_name}: {r.qty_consumed}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="font-bold text-gray-700 mb-1">المبيعات من هذه الدفعة (للأمام)</h4>
                {traceResult.downstreamSales.length === 0 ? <p className="text-gray-400 text-xs">لا يوجد مبيعات مسجلة بعد</p> : (
                  <ul className="list-disc pr-5 text-xs text-gray-600">
                    {traceResult.downstreamSales.map((s: any, i: number) => (
                      <li key={i}>فاتورة {s.invoice_id.slice(0, 8)}... — الكمية: {s.qty} — {s.moved_at?.slice(0, 10)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'qc' && (
        <div className="bg-white p-5 rounded-lg border shadow">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">دفعات بانتظار فحص الجودة</h3>
          {pendingQcBatches.length === 0 ? <p className="text-gray-400 text-sm">لا توجد دفعات بانتظار الفحص.</p> : (
            <div className="space-y-2">
              {pendingQcBatches.map((b) => (
                <div key={b.id} className="border rounded p-3 flex items-center justify-between gap-3">
                  <div className="text-sm">
                    <span className="font-bold">{b.batch_no}</span> — {itemName(b.item_id)} — الكمية الفعلية: {b.actual_qty}
                  </div>
                  {canApprove && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text" placeholder="سبب الرفض (اختياري)"
                        value={qcReason[b.id] || ''}
                        onChange={(e) => setQcReason({ ...qcReason, [b.id]: e.target.value })}
                        className="border rounded p-1 text-xs w-32"
                      />
                      <button onClick={() => handleQcDecision(b.id, false)} disabled={loading} className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded">رفض</button>
                      <button onClick={() => handleQcDecision(b.id, true)} disabled={loading} className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded">اعتماد وإضافة للمخزون</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'returns' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">طلب مرتجع / إتلاف جديد</h3>
            <form onSubmit={handleCreateReturnWriteoff} className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <select value={rwType} onChange={(e) => setRwType(e.target.value as any)} className="border rounded p-2 text-sm">
                <option value="damage_writeoff">إتلاف/تالف</option>
                <option value="customer_return">مرتجع عميل</option>
              </select>
              <select value={rwItemId} onChange={(e) => setRwItemId(e.target.value)} className="border rounded p-2 text-sm">
                <option value="">-- الصنف --</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <select value={rwWarehouseId} onChange={(e) => setRwWarehouseId(e.target.value)} className="border rounded p-2 text-sm">
                <option value="">-- المخزن --</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <input type="number" min={1} value={rwQty} onChange={(e) => setRwQty(e.target.value)} className="border rounded p-2 text-sm" />
              <button type="submit" disabled={loading} className="bg-blue-600 text-white text-sm px-4 py-2 rounded">إرسال</button>
              <input type="text" value={rwReason} onChange={(e) => setRwReason(e.target.value)} placeholder="السبب" className="border rounded p-2 text-sm md:col-span-5" />
            </form>
          </div>
          <div className="bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">الطلبات</h3>
            {rwRequests.length === 0 ? <p className="text-gray-400 text-sm">لا توجد طلبات.</p> : (
              <div className="space-y-2">
                {rwRequests.map((r) => (
                  <div key={r.id} className="border rounded p-3 flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <span className="font-bold">{r.request_type === 'customer_return' ? 'مرتجع' : 'إتلاف'}</span> — {itemName(r.item_id)} × {r.qty} — {r.reason}
                      <span className={`mr-2 text-xs px-2 py-0.5 rounded-full ${r.status === 'approved' ? 'bg-green-100 text-green-800' : r.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{r.status}</span>
                    </div>
                    {r.status === 'pending' && canApprove && (
                      <div className="flex items-center gap-2">
                        <input type="text" placeholder="سبب الرفض" value={rwRejectReason[r.id] || ''} onChange={(e) => setRwRejectReason({ ...rwRejectReason, [r.id]: e.target.value })} className="border rounded p-1 text-xs w-28" />
                        <button onClick={() => handleRejectRw(r.id)} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">رفض</button>
                        <button onClick={() => handleApproveRw(r.id)} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">اعتماد</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'count' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-lg border shadow flex items-end gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">فتح جلسة جرد لمخزن</label>
              <select value={countWarehouseId} onChange={(e) => setCountWarehouseId(e.target.value)} className="border rounded p-2 text-sm">
                <option value="">-- اختر --</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <button onClick={handleOpenCountSession} disabled={loading} className="bg-blue-600 text-white text-sm px-4 py-2 rounded">فتح جلسة</button>
          </div>
          {countSessions.map((s) => (
            <div key={s.id} className="bg-white p-5 rounded-lg border shadow">
              <div className="flex items-center justify-between border-b pb-2 mb-3">
                <h4 className="font-bold text-gray-800">{whName(s.warehouse_id)} — {s.created_at?.slice(0, 10)}</h4>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{s.status}</span>
              </div>
              <table className="min-w-full text-sm mb-3">
                <thead><tr className="text-xs text-gray-500 text-right"><th className="py-1">الصنف</th><th className="py-1">المتوقع</th><th className="py-1">الفعلي</th></tr></thead>
                <tbody>
                  {(countLines[s.id] || []).map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="py-1">{itemName(l.item_id)}</td>
                      <td className="py-1 font-mono">{l.expected_qty}</td>
                      <td className="py-1">
                        {s.status === 'open' ? (
                          <input
                            type="number"
                            value={countInputs[s.id]?.[l.item_id] ?? l.expected_qty}
                            onChange={(e) => setCountInputs({ ...countInputs, [s.id]: { ...(countInputs[s.id] || {}), [l.item_id]: e.target.value } })}
                            className="border rounded p-1 w-20 text-xs"
                          />
                        ) : (
                          <span className={Number(l.variance) !== 0 ? 'text-red-600 font-bold' : ''}>{l.counted_qty ?? '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s.status === 'open' && (
                <button onClick={() => handleSubmitCount(s.id)} disabled={loading} className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded">إرسال النتائج</button>
              )}
              {s.status === 'submitted' && canApprove && (
                <button onClick={() => handleSignOff(s.id)} disabled={loading} className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded">اعتماد وتسجيل الفروق</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
