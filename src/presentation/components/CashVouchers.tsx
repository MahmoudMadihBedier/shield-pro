import React, { useCallback, useEffect, useState } from 'react';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { ServiceFactory } from '../../application/services/service-factory';
import { useAuth } from '../../application/services/auth-service';
import { useToast } from './ui/Toast';
import { getErrorMessage } from '../../shared/utils/errors';
import { formatCurrency } from '../../shared/utils/format';
import { Wallet } from 'lucide-react';

// Generic daily disbursement/receipt vouchers with a free-text reason,
// independent of any specific customer/supplier invoice — the gap
// ReceiptVoucher/PaymentVoucher (both tied to an AR/AP document) don't
// cover. Branch-scoped: a branch accountant only sees their own branch's
// vouchers (or unscoped/company-level ones), enforced by RLS too.
export const CashVouchers: React.FC = () => {
  const { profile, checkPermission } = useAuth();
  const { success, error } = useToast();
  const accountingService = ServiceFactory.getAccountingService();

  const [accounts, setAccounts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [voucherType, setVoucherType] = useState<'receipt' | 'disbursement'>('disbursement');
  const [amount, setAmount] = useState('0');
  const [accountId, setAccountId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [reason, setReason] = useState('');

  const canAdd = checkPermission('accounting', 'add');
  const scopeWarehouseId = profile?.warehouse_id || null;
  // profile.permissions is a generic {module: {action: boolean}} map built
  // from whatever's granted in role_permissions — 'view_all' isn't part of
  // checkPermission's typed view/add/edit/delete union, so it's read directly.
  const canSeeAllBranches = profile?.role_name === 'Master Admin' ||
    !!(profile?.permissions?.['reports'] as Record<string, boolean> | undefined)?.['view_all'];

  const loadData = useCallback(async () => {
    const [accs, whs, list] = await Promise.all([
      RepositoryFactory.getAccountRepository().findAll(undefined, { page: 1, limit: 200 }),
      RepositoryFactory.getWarehouseRepository().findActive(),
      accountingService.getCashVouchers(canSeeAllBranches ? null : scopeWarehouseId)
    ]);
    setAccounts(accs.data.filter((a: any) => a.category === 'cash' || a.category === 'bank'));
    setWarehouses(whs);
    setVouchers(list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  }, [accountingService, scopeWarehouseId, canSeeAllBranches]);

  useEffect(() => { loadData(); }, [loadData]);

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name || id;
  const whName = (id: string | null) => (id ? warehouses.find((w) => w.id === id)?.name || id : 'عام (كل الفروع)');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || Number(amount) <= 0 || !reason.trim()) {
      error('يرجى اختيار الحساب وإدخال مبلغ وسبب صحيحين');
      return;
    }
    setLoading(true);
    try {
      await accountingService.createCashVoucher(voucherType, Number(amount), accountId, reason.trim(), warehouseId || null);
      success('تم تسجيل السند بنجاح');
      setAmount('0');
      setReason('');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل تسجيل السند'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {canAdd && (
        <div className="bg-white p-5 rounded-lg border shadow">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-600" />
            سند قبض / صرف عام
          </h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={voucherType} onChange={(e) => setVoucherType(e.target.value as any)} className="border rounded p-2 text-sm">
              <option value="disbursement">سند صرف</option>
              <option value="receipt">سند قبض</option>
            </select>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="border rounded p-2 text-sm">
              <option value="">-- الحساب (نقدية/بنك) --</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input type="number" min={0.01} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} className="border rounded p-2 text-sm" placeholder="المبلغ" />
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="border rounded p-2 text-sm">
              <option value="">-- عام (كل الفروع) --</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="border rounded p-2 text-sm md:col-span-2" placeholder="السبب" />
            <button type="submit" disabled={loading} className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 md:col-span-3">
              تسجيل السند
            </button>
          </form>
        </div>
      )}

      <div className="bg-white p-5 rounded-lg border shadow">
        <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">سندات القبض والصرف</h3>
        {vouchers.length === 0 ? (
          <p className="text-gray-400 text-sm">لا توجد سندات بعد.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 text-right">
                <th className="py-2">النوع</th>
                <th className="py-2">الحساب</th>
                <th className="py-2">الفرع</th>
                <th className="py-2">المبلغ</th>
                <th className="py-2">السبب</th>
                <th className="py-2">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="py-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${v.voucher_type === 'receipt' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {v.voucher_type === 'receipt' ? 'قبض' : 'صرف'}
                    </span>
                  </td>
                  <td className="py-2">{accountName(v.account_id)}</td>
                  <td className="py-2">{whName(v.warehouse_id)}</td>
                  <td className="py-2 font-mono">{formatCurrency(v.amount)}</td>
                  <td className="py-2">{v.reason}</td>
                  <td className="py-2 text-xs text-gray-500">{v.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
