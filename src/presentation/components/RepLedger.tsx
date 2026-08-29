import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../../infrastructure/database/dexie';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { ServiceFactory } from '../../application/services/service-factory';
import { useAuth } from '../../application/services/auth-service';
import { useToast } from './ui/Toast';
import { getErrorMessage } from '../../shared/utils/errors';
import { formatCurrency } from '../../shared/utils/format';
import { Package, Wallet, ClipboardCheck, Send } from 'lucide-react';

// Phase 2.4 of SHIELD_PRO_REFACTOR_MASTER_PLAN.md: every sales rep is a mini
// warehouse (stock-in-hand) and mini cash register (cash-in-hand). This
// screen covers the three actions the workflow needs: a branch/inventory
// manager issuing stock to a rep, the rep submitting their own end-of-day
// close-out, and a DIFFERENT person (never the rep — segregation of duties,
// enforced server-side too) confirming it.
export const RepLedger: React.FC = () => {
  const { profile, checkPermission } = useAuth();
  const { success, error } = useToast();
  const repLedgerService = ServiceFactory.getRepLedgerService();

  const [users, setUsers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [myBalances, setMyBalances] = useState<{ item_id: string; balance: number }[]>([]);
  const [myCash, setMyCash] = useState(0);
  const [pendingSessions, setPendingSessions] = useState<any[]>([]);

  // Rep stock requests (rep -> branch keeper)
  const [stockRequests, setStockRequests] = useState<any[]>([]);
  const [requestLinesByReq, setRequestLinesByReq] = useState<{ [id: string]: any[] }>({});
  const [reqWarehouseId, setReqWarehouseId] = useState('');
  const [reqLines, setReqLines] = useState<{ item_id: string; qty: number }[]>([{ item_id: '', qty: 1 }]);
  const [rejectReasonById, setRejectReasonById] = useState<{ [id: string]: string }>({});

  // Direct issuance form (admin-only fallback)
  const [issueRepId, setIssueRepId] = useState('');
  const [issueWarehouseId, setIssueWarehouseId] = useState('');
  const [issueLines, setIssueLines] = useState<{ item_id: string; qty: number }[]>([{ item_id: '', qty: 1 }]);

  // Close-out form
  const [actualCash, setActualCash] = useState('0');
  const [stockCounts, setStockCounts] = useState<{ [itemId: string]: string }>({});

  const canIssue = checkPermission('inventory', 'add') || checkPermission('inventory', 'edit');
  const canConfirm = checkPermission('accounting', 'edit') || checkPermission('inventory', 'edit');
  const isAdmin = profile?.role_name === 'Master Admin' || checkPermission('settings', 'edit');

  const loadStatic = useCallback(async () => {
    const [listUsers, listWarehouses, listItems] = await Promise.all([
      db.users.toArray(),
      RepositoryFactory.getWarehouseRepository().findActive(),
      db.items.toArray()
    ]);
    setUsers(listUsers);
    setWarehouses(listWarehouses);
    setItems(listItems);
  }, []);

  const loadMine = useCallback(async () => {
    if (!profile?.id) return;
    const [balances, cash] = await Promise.all([
      repLedgerService.getRepStockBalances(profile.id),
      repLedgerService.getRepCashBalance(profile.id)
    ]);
    setMyBalances(balances.filter((b) => b.balance !== 0));
    setMyCash(cash);
  }, [profile?.id, repLedgerService]);

  const loadPending = useCallback(async () => {
    if (!canConfirm) return;
    const all = await db.rep_closeout_sessions.toArray();
    setPendingSessions(all.filter((s: any) => (s.status === 'submitted' || s.status === 'variance_flagged') && s.rep_user_id !== profile?.id));
  }, [canConfirm, profile?.id]);

  const loadRequests = useCallback(async () => {
    const [reqs, lines] = await Promise.all([
      db.rep_stock_requests.toArray(),
      db.rep_stock_request_lines.toArray()
    ]);
    reqs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const grouped: { [id: string]: any[] } = {};
    for (const l of lines) (grouped[l.request_id] = grouped[l.request_id] || []).push(l);
    setStockRequests(reqs);
    setRequestLinesByReq(grouped);
  }, []);

  useEffect(() => { loadStatic(); }, [loadStatic]);
  useEffect(() => { loadMine(); }, [loadMine]);
  useEffect(() => { loadPending(); }, [loadPending]);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  const itemName = (id: string) => items.find((i) => i.id === id)?.name || id;

  const handleAddIssueLine = () => setIssueLines([...issueLines, { item_id: '', qty: 1 }]);
  const handleIssueLineChange = (idx: number, field: 'item_id' | 'qty', value: string) => {
    const updated = [...issueLines];
    updated[idx] = { ...updated[idx], [field]: field === 'qty' ? Number(value) : value };
    setIssueLines(updated);
  };

  const handleIssueStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueRepId || !issueWarehouseId || issueLines.some((l) => !l.item_id || l.qty <= 0)) {
      error('يرجى اختيار المندوب والمخزن وتعبئة كل الأصناف والكميات');
      return;
    }
    setLoading(true);
    try {
      await repLedgerService.issueStockToRep(issueRepId, issueWarehouseId, issueLines);
      success('تم صرف البضاعة لعهدة المندوب بنجاح');
      setIssueLines([{ item_id: '', qty: 1 }]);
      await loadMine();
    } catch (e) {
      error(getErrorMessage(e, 'فشل صرف البضاعة'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCloseout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    const myWarehouseId = profile.warehouse_id || warehouses.find((w) => w.type === 'main')?.id;
    if (!myWarehouseId) {
      error('لا يوجد فرع مرتبط بحسابك، يرجى مراجعة المدير');
      return;
    }
    setLoading(true);
    try {
      const session = await repLedgerService.getOrOpenTodaySession(profile.id, myWarehouseId);
      const counts = myBalances.map((b) => ({
        item_id: b.item_id,
        counted: Number(stockCounts[b.item_id] ?? b.balance)
      }));
      await repLedgerService.submitCloseout(session.id, profile.id, Number(actualCash), counts, profile.id);
      success('تم إرسال إغلاق اليوم للاعتماد');
      setActualCash('0');
      setStockCounts({});
      await loadMine();
    } catch (e) {
      error(getErrorMessage(e, 'فشل إرسال إغلاق اليوم'));
    } finally {
      setLoading(false);
    }
  };

  // --- Rep stock request handlers ---
  const handleAddReqLine = () => setReqLines([...reqLines, { item_id: '', qty: 1 }]);
  const handleReqLineChange = (idx: number, field: 'item_id' | 'qty', value: string) => {
    const updated = [...reqLines];
    updated[idx] = { ...updated[idx], [field]: field === 'qty' ? Number(value) : value };
    setReqLines(updated);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !reqWarehouseId || reqLines.some((l) => !l.item_id || l.qty <= 0)) {
      error('اختر الفرع وأضف الأصناف والكميات');
      return;
    }
    setLoading(true);
    try {
      await repLedgerService.createRepStockRequest(profile.id, reqWarehouseId, profile.id, reqLines);
      success('تم إرسال طلب صرف العهدة — بانتظار اعتماد أمين المخزن');
      setReqLines([{ item_id: '', qty: 1 }]);
      await loadRequests();
    } catch (e) {
      error(getErrorMessage(e, 'فشل إرسال الطلب'));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (id: string) => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      await repLedgerService.approveRepStockRequest(id, profile.id);
      success('تم اعتماد الطلب ونقل البضاعة لعهدة المندوب');
      await Promise.all([loadRequests(), loadMine()]);
    } catch (e) {
      error(getErrorMessage(e, 'فشل اعتماد الطلب'));
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRequest = async (id: string) => {
    if (!profile?.id) return;
    const reason = rejectReasonById[id];
    if (!reason?.trim()) { error('أدخل سبب الرفض'); return; }
    setLoading(true);
    try {
      await repLedgerService.rejectRepStockRequest(id, profile.id, reason.trim());
      success('تم رفض الطلب');
      await loadRequests();
    } catch (e) {
      error(getErrorMessage(e, 'فشل رفض الطلب'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (session: any) => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      await repLedgerService.confirmCloseout(session.id, profile.id, session.rep_user_id);
      success('تم اعتماد الإغلاق');
      await loadPending();
    } catch (e) {
      error(getErrorMessage(e, 'فشل اعتماد الإغلاق'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="h-6 w-6" />
          عهدة المندوبين (بضاعة ونقدية)
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          كل مندوب هو مخزن صغير وخزينة صغيرة: البضاعة والنقدية المصروفة له تبقى في عهدته حتى يتم تسليمها والتصفية اليومية.
        </p>
      </div>

      {/* Rep raises a request; branch keeper approves — the two-party van load */}
      <div className="bg-white p-5 rounded-lg border shadow">
        <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
          <Send className="h-5 w-5 text-blue-600" />
          طلبات صرف العهدة (طلب المندوب ← اعتماد أمين المخزن)
        </h3>

        <form onSubmit={handleCreateRequest} className="space-y-3 mb-6">
          <div className="text-xs text-gray-500">
            بصفتك مندوباً: اطلب البضاعة من فرعك. لا تنتقل البضاعة لعهدتك إلا بعد اعتماد أمين المخزن (شخص مختلف عنك).
          </div>
          <select value={reqWarehouseId} onChange={(e) => setReqWarehouseId(e.target.value)} className="border rounded p-2 text-sm w-full">
            <option value="">-- اختر الفرع (المخزن) --</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {reqLines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-3">
              <select value={line.item_id} onChange={(e) => handleReqLineChange(idx, 'item_id', e.target.value)} className="border rounded p-2 text-sm col-span-2">
                <option value="">-- الصنف --</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <input type="number" min={1} value={line.qty} onChange={(e) => handleReqLineChange(idx, 'qty', e.target.value)} className="border rounded p-2 text-sm" />
            </div>
          ))}
          <div className="flex justify-between">
            <button type="button" onClick={handleAddReqLine} className="text-xs text-blue-600 hover:underline">+ إضافة صنف</button>
            <button type="submit" disabled={loading} className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
              إرسال الطلب
            </button>
          </div>
        </form>

        {stockRequests.length === 0 ? (
          <p className="text-gray-400 text-sm">لا توجد طلبات صرف عهدة.</p>
        ) : (
          <div className="space-y-2">
            {stockRequests.map((r) => {
              const lines = requestLinesByReq[r.id] || [];
              const st = {
                pending_approval: { t: 'بانتظار الاعتماد', c: 'bg-yellow-100 text-yellow-800' },
                approved: { t: 'معتمد', c: 'bg-blue-100 text-blue-800' },
                issued: { t: 'تم النقل للعهدة', c: 'bg-green-100 text-green-800' },
                rejected: { t: 'مرفوض', c: 'bg-red-100 text-red-800' }
              }[r.status as string] || { t: r.status, c: 'bg-gray-100 text-gray-700' };
              const canAct = canIssue && r.status === 'pending_approval' && r.rep_user_id !== profile?.id && r.requested_by !== profile?.id;
              return (
                <div key={r.id} className="border rounded p-3 text-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="font-bold text-gray-800">{users.find((u) => u.id === r.rep_user_id)?.name || r.rep_user_id}</span>
                      <span className="text-xs text-gray-500"> · {warehouses.find((w) => w.id === r.warehouse_id)?.name || '-'} · {new Date(r.created_at).toLocaleString('ar-EG')}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${st.c}`}>{st.t}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {lines.map((l) => `${itemName(l.item_id)}: ${l.requested_qty}`).join(' · ')}
                  </div>
                  {r.rejection_reason && <div className="text-xs text-red-600 mt-1">سبب الرفض: {r.rejection_reason}</div>}
                  {canAct && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="سبب الرفض"
                        value={rejectReasonById[r.id] || ''}
                        onChange={(e) => setRejectReasonById({ ...rejectReasonById, [r.id]: e.target.value })}
                        className="border rounded p-1 text-xs w-32"
                      />
                      <button onClick={() => handleRejectRequest(r.id)} disabled={loading} className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200">رفض</button>
                      <button onClick={() => handleApproveRequest(r.id)} disabled={loading} className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded hover:bg-green-200">اعتماد ونقل للعهدة</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="bg-white p-5 rounded-lg border shadow">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            صرف مباشر لعهدة مندوب (إداري — بدون طلب)
          </h3>
          <form onSubmit={handleIssueStock} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <select value={issueRepId} onChange={(e) => setIssueRepId(e.target.value)} className="border rounded p-2 text-sm">
                <option value="">-- اختر المندوب --</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
              <select value={issueWarehouseId} onChange={(e) => setIssueWarehouseId(e.target.value)} className="border rounded p-2 text-sm">
                <option value="">-- اختر الفرع (المخزن) --</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            {issueLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-3">
                <select
                  value={line.item_id}
                  onChange={(e) => handleIssueLineChange(idx, 'item_id', e.target.value)}
                  className="border rounded p-2 text-sm col-span-2"
                >
                  <option value="">-- الصنف --</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <input
                  type="number"
                  min={1}
                  value={line.qty}
                  onChange={(e) => handleIssueLineChange(idx, 'qty', e.target.value)}
                  className="border rounded p-2 text-sm"
                />
              </div>
            ))}
            <div className="flex justify-between">
              <button type="button" onClick={handleAddIssueLine} className="text-xs text-blue-600 hover:underline">+ إضافة صنف</button>
              <button type="submit" disabled={loading} className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                صرف البضاعة
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white p-5 rounded-lg border shadow">
        <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-green-600" />
          عهدتي الحالية وإغلاق اليوم
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-green-50 rounded p-3">
            <div className="text-xs text-gray-500">النقدية في العهدة</div>
            <div className="text-lg font-bold text-green-700">{formatCurrency(myCash)}</div>
          </div>
          <div className="bg-blue-50 rounded p-3">
            <div className="text-xs text-gray-500">عدد الأصناف في العهدة</div>
            <div className="text-lg font-bold text-blue-700">{myBalances.length}</div>
          </div>
        </div>
        {myBalances.length > 0 && (
          <table className="min-w-full text-sm mb-4">
            <thead>
              <tr className="text-xs text-gray-500 text-right">
                <th className="py-1">الصنف</th>
                <th className="py-1">الرصيد المتوقع</th>
                <th className="py-1">الجرد الفعلي</th>
              </tr>
            </thead>
            <tbody>
              {myBalances.map((b) => (
                <tr key={b.item_id} className="border-t">
                  <td className="py-1">{itemName(b.item_id)}</td>
                  <td className="py-1 font-mono">{b.balance}</td>
                  <td className="py-1">
                    <input
                      type="number"
                      value={stockCounts[b.item_id] ?? b.balance}
                      onChange={(e) => setStockCounts({ ...stockCounts, [b.item_id]: e.target.value })}
                      className="border rounded p-1 w-24 text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={handleSubmitCloseout} className="flex items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">النقدية الفعلية المعدودة</label>
            <input
              type="number"
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
              className="border rounded p-2 text-sm w-40"
            />
          </div>
          <button type="submit" disabled={loading} className="bg-green-600 text-white text-sm px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50">
            إرسال إغلاق اليوم
          </button>
        </form>
      </div>

      {canConfirm && (
        <div className="bg-white p-5 rounded-lg border shadow">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-purple-600" />
            إغلاقات بانتظار الاعتماد
          </h3>
          {pendingSessions.length === 0 ? (
            <p className="text-gray-400 text-sm">لا توجد إغلاقات بانتظار الاعتماد.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 text-right">
                  <th className="py-2">المندوب</th>
                  <th className="py-2">التاريخ</th>
                  <th className="py-2">فرق النقدية</th>
                  <th className="py-2">الحالة</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pendingSessions.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="py-2">{users.find((u) => u.id === s.rep_user_id)?.name || s.rep_user_id}</td>
                    <td className="py-2">{s.session_date}</td>
                    <td className={`py-2 font-mono ${Number(s.cash_variance) !== 0 ? 'text-red-600 font-bold' : ''}`}>
                      {formatCurrency(Number(s.cash_variance) || 0)}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${s.status === 'variance_flagged' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {s.status === 'variance_flagged' ? 'يوجد فرق' : 'مرسل'}
                      </span>
                    </td>
                    <td className="py-2">
                      <button onClick={() => handleConfirm(s)} disabled={loading} className="text-xs bg-purple-100 text-purple-800 px-3 py-1 rounded hover:bg-purple-200">
                        اعتماد
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
