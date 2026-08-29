import React, { useCallback, useEffect, useState } from 'react';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { ServiceFactory } from '../../application/services/service-factory';
import { db } from '../../infrastructure/database/dexie';
import { useAuth } from '../../application/services/auth-service';
import { useToast } from './ui/Toast';
import { getErrorMessage } from '../../shared/utils/errors';
import { formatCurrency } from '../../shared/utils/format';
import { Landmark } from 'lucide-react';

// Step 8 of the closed-loop cycle: the branch cashier periodically deposits
// all cash collected at the branch into the main treasury. Branch vs
// treasury cash is the single 'cash' account, told apart by
// account_transactions.warehouse_id. A settlement is confirmed by a
// DIFFERENT person (head/branch accountant) — enforced server-side too.
export const BranchCashSettlements: React.FC = () => {
  const { profile, checkPermission } = useAuth();
  const { success, error } = useToast();
  const accountingService = ServiceFactory.getAccountingService();

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [undeposited, setUndeposited] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const [branchId, setBranchId] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().split('T')[0];
  const [periodStart, setPeriodStart] = useState(weekAgo);
  const [periodEnd, setPeriodEnd] = useState(today);

  const canAdd = checkPermission('accounting', 'add');
  const canConfirm = checkPermission('accounting', 'edit');
  const canSeeAll = profile?.role_name === 'Master Admin' ||
    !!(profile?.permissions?.['reports'] as Record<string, boolean> | undefined)?.['view_all'];
  const scopeWh = canSeeAll ? null : (profile?.warehouse_id || null);

  const loadData = useCallback(async () => {
    const [whs, listUsers, list] = await Promise.all([
      RepositoryFactory.getWarehouseRepository().findActive(),
      db.users.toArray(),
      accountingService.getBranchCashSettlements(scopeWh)
    ]);
    // "Branches" for settlement = every warehouse that is not the main store.
    const branches = whs.filter((w: any) => w.type !== 'main');
    setWarehouses(whs);
    setUsers(listUsers);
    setSettlements(list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

    const targetBranches = scopeWh ? branches.filter((b: any) => b.id === scopeWh) : branches;
    const map: Record<string, number> = {};
    for (const b of targetBranches) {
      try { map[b.id] = await accountingService.getBranchUndepositedCash(b.id); } catch { map[b.id] = 0; }
    }
    setUndeposited(map);
    if (!branchId && targetBranches[0]) setBranchId(targetBranches[0].id);
  }, [accountingService, scopeWh, branchId]);

  useEffect(() => { loadData(); }, [loadData]);

  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name || id;
  const userName = (id: string | null) => users.find((u) => u.id === id)?.name || (id ? id.slice(0, 8) : '-');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !branchId) { error('اختر الفرع'); return; }
    setLoading(true);
    try {
      await accountingService.createBranchCashSettlement(branchId, periodStart, periodEnd, profile.id);
      success('تم تسجيل توريد نقدية الفرع — بانتظار اعتماد المحاسب');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل تسجيل التوريد'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id: string) => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      await accountingService.confirmBranchCashSettlement(id, profile.id);
      success('تم اعتماد التوريد وترحيل القيد للخزينة الرئيسية');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل اعتماد التوريد'));
    } finally {
      setLoading(false);
    }
  };

  const branchOptions = warehouses.filter((w: any) => w.type !== 'main' && (!scopeWh || w.id === scopeWh));

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-lg border shadow">
        <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
          <Landmark className="h-5 w-5 text-blue-600" />
          توريد نقدية الفروع إلى الخزينة الرئيسية
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          «النقدية المحصّلة بالفرع ولم تُورَّد» = صافي حركة حساب الصندوق المنسوبة لهذا الفرع، ناقص التوريدات المعتمدة سابقاً.
          عند الاعتماد يُرحَّل القيد: <span dir="ltr">Dr</span> صندوق (الخزينة الرئيسية) / <span dir="ltr">Cr</span> صندوق (الفرع).
        </p>

        {branchOptions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {branchOptions.map((b: any) => (
              <div key={b.id} className="bg-blue-50 rounded p-3">
                <div className="text-xs text-gray-500">{b.name}</div>
                <div className="text-lg font-bold text-blue-700 font-mono">{formatCurrency(undeposited[b.id] ?? 0)}</div>
                <div className="text-[10px] text-gray-400">نقدية غير مورّدة</div>
              </div>
            ))}
          </div>
        )}

        {canAdd && (
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">الفرع</label>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="border rounded p-2 text-sm w-full">
                <option value="">-- اختر --</option>
                {branchOptions.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">من تاريخ</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="border rounded p-2 text-sm w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">إلى تاريخ</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="border rounded p-2 text-sm w-full" />
            </div>
            <button type="submit" disabled={loading} className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
              تسجيل توريد
            </button>
          </form>
        )}
      </div>

      <div className="bg-white p-5 rounded-lg border shadow">
        <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">سجل التوريدات</h3>
        {settlements.length === 0 ? (
          <p className="text-gray-400 text-sm">لا توجد توريدات بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-right">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="py-2 px-3">الفرع</th>
                  <th className="py-2 px-3">الفترة</th>
                  <th className="py-2 px-3">المبلغ</th>
                  <th className="py-2 px-3">أودعه</th>
                  <th className="py-2 px-3">اعتمده</th>
                  <th className="py-2 px-3">الحالة</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3">{whName(s.branch_warehouse_id)}</td>
                    <td className="py-2 px-3 text-xs text-gray-500">{s.period_start} → {s.period_end}</td>
                    <td className="py-2 px-3 font-mono">{formatCurrency(s.total_amount)}</td>
                    <td className="py-2 px-3">{userName(s.deposited_by)}</td>
                    <td className="py-2 px-3">{userName(s.confirmed_by)}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        s.status === 'confirmed' ? 'bg-green-100 text-green-800'
                        : s.status === 'submitted' ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-700'
                      }`}>
                        {s.status === 'confirmed' ? 'معتمد ومرحّل' : s.status === 'submitted' ? 'بانتظار الاعتماد' : 'مسودة'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {s.status === 'submitted' && canConfirm && s.deposited_by !== profile?.id && (
                        <button onClick={() => handleConfirm(s.id)} disabled={loading} className="text-xs bg-purple-100 text-purple-800 px-3 py-1 rounded hover:bg-purple-200">
                          اعتماد
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
