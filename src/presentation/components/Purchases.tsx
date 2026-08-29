import React, { useState, useEffect } from 'react';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { getSetting, getSettingBool } from '../../shared/utils/settings-helper';
import { formatCurrency, formatDate } from '../../shared/utils/format';
import { getErrorMessage } from '../../shared/utils/errors';
import { useSuppliers, usePurchaseInvoices, usePaymentVouchers } from '../../application/hooks/use-purchases';
import { useAccounts } from '../../application/hooks/use-accounting';
import { useInventory } from '../../application/hooks/use-inventory';
import { Warehouse } from '../../core/domain/entities';
import { PaginationParams } from '../../core/types';
import {
  Users,
  Plus,
  Trash2,
  FileText,
  Receipt,
  TrendingUp
} from 'lucide-react';

// Stable reference (not recreated per render) so the data hooks below don't
// re-fetch in a loop — their internal useCallback/useEffect deps include
// this params object by identity.
const UNPAGINATED: PaginationParams = { page: 1, limit: 100000 };

export const Purchases: React.FC = () => {
  // Tabs
  const [activeSubTab, setActiveSubTab] = useState<'suppliers' | 'invoices' | 'vouchers' | 'statement'>('invoices');

  // Data, sourced from the service/hook layer instead of Dexie directly.
  const { suppliers: suppliersResult, createSupplier } = useSuppliers();
  const suppliers = suppliersResult.data;

  const { invoices: purchaseInvoicesResult, createInvoice } = usePurchaseInvoices(undefined, UNPAGINATED);
  const purchaseInvoices = purchaseInvoicesResult.data;

  const { vouchers: paymentVouchersResult, createPaymentVoucher } = usePaymentVouchers(undefined, UNPAGINATED);
  const paymentVouchers = paymentVouchersResult.data;

  const { accounts: accountsResult } = useAccounts();
  const accounts = accountsResult.data;

  const { items: allItemsResult } = useInventory(undefined, UNPAGINATED);
  const allItems = allItemsResult.data;
  const items = allItems.filter((i) => i.type === 'raw_material' || i.type === 'packaging');

  // No dedicated warehouse service/hook yet — matches the same direct
  // RepositoryFactory usage Sales.tsx uses for the same reason.
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  useEffect(() => {
    RepositoryFactory.getWarehouseRepository().findActive().then(setWarehouses);
  }, []);

  // 1. Supplier State
  const [suppName, setSuppName] = useState('');
  const [suppPhone, setSuppPhone] = useState('');
  const [suppAddress, setSuppAddress] = useState('');
  const [suppOpening, setSuppOpening] = useState('0');

  // 2. Invoice State
  const [invSupplier, setInvSupplier] = useState('');
  const [invWarehouse, setInvWarehouse] = useState('');
  const [invPaymentMethod, setInvPaymentMethod] = useState<'cash' | 'credit' | 'bank'>('cash');
  const [invLines, setInvLines] = useState<any[]>([{ item_id: '', qty: 1, unit_price: 0 }]);
  const [invDiscount, setInvDiscount] = useState('0');

  // Settings Cache
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatPct, setVatPct] = useState(14);

  // 3. Payment Voucher State
  const [vouchSupplier, setVouchSupplier] = useState('');
  const [vouchInvoiceId, setVouchInvoiceId] = useState('');
  const [vouchAmount, setVouchAmount] = useState('0');
  const [vouchAccountId, setVouchAccountId] = useState(''); // Cash or Bank Account

  // 4. Supplier Statement State
  const [statementSuppId, setStatementSuppId] = useState('');
  const [statementStart, setStatementStartDate] = useState('');
  const [statementEnd, setStatementEndDate] = useState('');
  const [statementRecords, setStatementRecords] = useState<any[]>([]);

  // Default selections, once each list has loaded (mirrors the old loadData()
  // one-time defaulting, but reactive to each hook's own load instead of a
  // single combined fetch).
  useEffect(() => {
    if (suppliers.length > 0 && !invSupplier) {
      setInvSupplier(suppliers[0].id);
      setVouchSupplier(suppliers[0].id);
      setStatementSuppId(suppliers[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliers]);

  useEffect(() => {
    if (warehouses.length > 0 && !invWarehouse) {
      // Default the goods-receipt destination to the raw-materials store if
      // one is configured, otherwise the first warehouse.
      const rawStore = warehouses.find((w) => w.kind === 'raw_materials');
      setInvWarehouse((rawStore || warehouses[0]).id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouses]);

  useEffect(() => {
    const financial = accounts.filter((a) => a.category === 'cash' || a.category === 'bank');
    if (financial.length > 0 && !vouchAccountId) {
      setVouchAccountId(financial[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  useEffect(() => {
    (async () => {
      setVatEnabled(await getSettingBool('vat_enabled', false));
      setVatPct(Number(await getSetting('default_vat_pct', '14')));
    })();
  }, []);

  // Add Supplier
  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppName.trim()) return;

    try {
      await createSupplier({
        name: suppName.trim(),
        phone: suppPhone.trim() || undefined,
        address: suppAddress.trim() || undefined,
        opening_balance: Number(suppOpening)
      });
      setSuppName('');
      setSuppPhone('');
      setSuppAddress('');
      setSuppOpening('0');
      alert('تم تسجيل المورد بنجاح!');
    } catch (e) {
      alert(getErrorMessage(e, 'فشل تسجيل المورد'));
    }
  };

  // Invoice Subtotals
  const calculateInvoiceSubtotal = () => {
    return invLines.reduce((sum, line) => {
      const qty = Number(line.qty) || 0;
      const price = Number(line.unit_price) || 0;
      return sum + (qty * price);
    }, 0);
  };

  const calculateInvoiceTax = (sub: number) => {
    if (!vatEnabled) return 0;
    const invDiscNum = Number(invDiscount) || 0;
    return (Math.max(sub - invDiscNum, 0) * vatPct) / 100;
  };

  const calculateInvoiceTotal = () => {
    const sub = calculateInvoiceSubtotal();
    const invDiscNum = Number(invDiscount) || 0;
    const tax = calculateInvoiceTax(sub);
    return Math.max(sub - invDiscNum + tax, 0);
  };

  const handleAddInvoiceLine = () => {
    setInvLines([...invLines, { item_id: '', qty: 1, unit_price: 0 }]);
  };

  const handleRemoveInvoiceLine = (index: number) => {
    const updated = [...invLines];
    updated.splice(index, 1);
    setInvLines(updated);
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const updated = [...invLines];
    updated[index] = { ...updated[index], [field]: value };
    setInvLines(updated);
  };

  // Save Purchase Invoice — stock addition and journal-entry posting now
  // happen inside PurchaseService.createInvoice instead of here.
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invSupplier || !invWarehouse || invLines.some((l: any) => !l.item_id)) {
      alert('يرجى التحقق من تحديد المورد ومخزن الاستلام وتعبئة كافة البنود.');
      return;
    }

    try {
      const sub = calculateInvoiceSubtotal();
      const disc = Number(invDiscount) || 0;
      const tax = calculateInvoiceTax(sub);
      const total = calculateInvoiceTotal();

      await createInvoice(
        {
          invoice_no: `PENDING-PUR-${Date.now()}`,
          supplier_id: invSupplier,
          date: new Date().toISOString().split('T')[0],
          payment_method: invPaymentMethod,
          subtotal: sub,
          discount: disc,
          tax,
          total,
          status: invPaymentMethod === 'cash' ? 'paid' : 'unpaid'
        },
        invLines.map((line: any) => {
          const lQty = Number(line.qty) || 0;
          const lPrice = Number(line.unit_price) || 0;
          return {
            item_id: line.item_id,
            // overwritten by PurchaseService.createInvoice with the real invoice id
            invoice_id: '',
            qty: lQty,
            unit_price: lPrice,
            discount: 0,
            line_total: lQty * lPrice
          };
        }),
        invWarehouse
      );

      setInvDiscount('0');
      setInvLines([{ item_id: '', qty: 1, unit_price: 0 }]);
      alert('تم حفظ فاتورة المشتريات وإضافة البضاعة بنجاح!');
    } catch (e) {
      alert(getErrorMessage(e, 'فشل حفظ الفاتورة'));
    }
  };

  // Payment Vouchers (سند صرف) — linked-invoice status update and
  // journal-entry posting (debit AP, credit Cash/Bank) now happen inside
  // PurchaseService.createPaymentVoucher instead of here.
  const handleSavePaymentVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vouchSupplier || !vouchAmount || !vouchAccountId) return;

    try {
      await createPaymentVoucher({
        voucher_no: `PENDING-PAY-${Date.now()}`,
        supplier_id: vouchSupplier,
        invoice_id: vouchInvoiceId || null,
        amount: Number(vouchAmount),
        date: new Date().toISOString().split('T')[0],
        account_id: vouchAccountId
      });

      setVouchAmount('0');
      setVouchInvoiceId('');
      alert('تم تسجيل سند الصرف وتحديث أرصدة المورد بنجاح!');
    } catch (err) {
      alert(getErrorMessage(err, 'فشل حفظ سند الصرف'));
    }
  };

  // Statement of Account
  const runSupplierStatement = async () => {
    if (!statementSuppId) return;

    const listTransactions: any[] = [];
    const supp = suppliers.find((s: any) => s.id === statementSuppId);
    if (!supp) return;

    // Opening Balance — dated to when the supplier was registered; fall back
    // to the earliest known invoice date rather than a hardcoded year.
    const earliestInvDate = purchaseInvoices
      .filter((i: any) => i.supplier_id === statementSuppId)
      .map((i: any) => i.date)
      .sort()[0];
    listTransactions.push({
      date: supp.created_at?.split('T')[0] || earliestInvDate || new Date().toISOString().split('T')[0],
      desc: 'الرصيد الافتتاحي عند التسجيل',
      debit: 0,
      credit: Number(supp.opening_balance) || 0,
    });

    // Invoices (Credit AP)
    const invs = purchaseInvoices.filter((i: any) => i.supplier_id === statementSuppId);
    invs.forEach((i: any) => {
      listTransactions.push({
        date: i.date,
        desc: `فاتورة مشتريات رقم ${i.invoice_no}`,
        debit: 0,
        credit: Number(i.total),
      });
    });

    // Payment Vouchers (Debit AP)
    const pvs = paymentVouchers.filter((v: any) => v.supplier_id === statementSuppId);
    pvs.forEach((v: any) => {
      listTransactions.push({
        date: v.date,
        desc: `سند صرف رقم ${v.voucher_no} ${v.invoice_id ? '(مسدد جزئي)' : '(على الحساب)'}`,
        debit: Number(v.amount),
        credit: 0,
      });
    });

    let filtered = [...listTransactions];
    if (statementStart) {
      filtered = filtered.filter((t: any) => t.date >= statementStart);
    }
    if (statementEnd) {
      filtered = filtered.filter((t: any) => t.date <= statementEnd);
    }

    const chronological = filtered.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // In Supplier terms, credit increases debt, debit decreases debt (running balance represents AP)
    let bal = 0;
    const finalRecords = chronological.map((t: any) => {
      bal += t.credit - t.debit;
      return { ...t, balance: bal };
    });

    setStatementRecords(finalRecords.reverse());
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المشتريات والموردين وسندات الصرف / Purchases</h1>
          <p className="text-gray-500 text-sm mt-1">تسجيل مشتريات المواد الكيميائية ومواد التغليف، مرتجع مشتريات، وسند الصرف</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-lg p-1 shadow-sm">
        <button
          onClick={() => setActiveSubTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'invoices' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>فاتورة مشتريات جديدة</span>
        </button>
        <button
          onClick={() => setActiveSubTab('vouchers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'vouchers' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>سند صرف مالي (سند صرف)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'suppliers' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>ملفات وقائمة الموردين</span>
        </button>
        <button
          onClick={() => {
            setActiveSubTab('statement');
            runSupplierStatement();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'statement' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>كشف حساب مورد تفصيلي</span>
        </button>
      </div>

      {activeSubTab === 'suppliers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Supplier Form */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">ملف مورد جديد</h3>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اسم المورد / الشركة</label>
                <input
                  type="text"
                  required
                  placeholder="شركة سابك للصناعات الكيماوية"
                  value={suppName}
                  onChange={(e) => setSuppName(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  placeholder="0114002345"
                  value={suppPhone}
                  onChange={(e) => setSuppPhone(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">العنوان</label>
                <input
                  type="text"
                  placeholder="الجبيل، المنطقة الصناعية الأولى"
                  value={suppAddress}
                  onChange={(e) => setSuppAddress(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الرصيد الافتتاحي (دائن ج.م)</label>
                <input
                  type="number"
                  value={suppOpening}
                  onChange={(e) => setSuppOpening(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition"
              >
                حفظ المورد
              </button>
            </form>
          </div>

          {/* Suppliers list */}
          <div className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">قائمة الموردين</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">اسم المورد</th>
                    <th className="py-3 px-4">الهاتف</th>
                    <th className="py-3 px-4">العنوان</th>
                    <th className="py-3 px-4 text-center">الرصيد الجاري المستحق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {suppliers.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-bold text-gray-800">{s.name}</td>
                      <td className="py-3 px-4 text-gray-600">{s.phone || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">{s.address || '-'}</td>
                      <td className="py-3 px-4 text-center font-bold text-red-600 font-mono">
                        {formatCurrency(
                          Number(s.opening_balance) +
                          purchaseInvoices.filter((i) => i.supplier_id === s.id).reduce((sum, i) => sum + Number(i.total), 0) -
                          paymentVouchers.filter((v) => v.supplier_id === s.id).reduce((sum, v) => sum + Number(v.amount), 0)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'invoices' && (
        <form onSubmit={handleSaveInvoice} className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 bg-white p-6 rounded-lg border shadow">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-3 mb-6">تحرير فاتورة مشتريات مواد جديدة</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded border">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المورد</label>
                <select
                  required
                  value={invSupplier}
                  onChange={(e) => setInvSupplier(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white font-semibold"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">مخزن الاستلام / التخزين</label>
                <select
                  required
                  value={invWarehouse}
                  onChange={(e) => setInvWarehouse(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.kind === 'raw_materials' ? ' — مخزن الخامات' : w.kind === 'factory' ? ' — مخزن المصنع' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">تُضاف الكميات المشتراة كرصيد في هذا المخزن، ويُسجَّل القيد: مدين «المخزون» / دائن «النقدية» أو «الموردين».</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">طريقة السداد</label>
                <select
                  value={invPaymentMethod}
                  onChange={(e) => setInvPaymentMethod(e.target.value as any)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  <option value="cash">نقداً (كاش فوري)</option>
                  <option value="credit">آجل (ذمم الموردين)</option>
                  <option value="bank">حوالة بنكية</option>
                </select>
              </div>
            </div>

            {/* Lines rows */}
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-gray-100 p-2 rounded">
                <span className="text-xs font-bold text-gray-700">المواد المشتراة (مواد خام / تعبئة):</span>
                <button
                  type="button"
                  onClick={handleAddInvoiceLine}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إضافة سطر مادة</span>
                </button>
              </div>

              {invLines.map((line, idx) => (
                <div key={idx} className="flex gap-4 items-center">
                  <div className="flex-1">
                    <select
                      required
                      value={line.item_id}
                      onChange={(e) => handleLineChange(idx, 'item_id', e.target.value)}
                      className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                    >
                      <option value="">-- اختر المادة المراد شراؤها --</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="الكمية"
                      value={line.qty}
                      onChange={(e) => handleLineChange(idx, 'qty', Number(e.target.value))}
                      className="w-full rounded border border-gray-300 py-1.5 px-2 text-sm text-left font-semibold"
                    />
                  </div>

                  <div className="w-32">
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="سعر تكلفة الشراء"
                      value={line.unit_price}
                      onChange={(e) => handleLineChange(idx, 'unit_price', Number(e.target.value))}
                      className="w-full rounded border border-gray-300 py-1.5 px-2 text-sm text-left font-semibold font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveInvoiceLine(idx)}
                    className="text-red-500 hover:text-red-700 p-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar calculations */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit space-y-6">
            <h3 className="font-bold text-gray-800 border-b pb-2">ملخص الحساب والضريبة</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>المجموع الفرعي:</span>
                <span className="font-mono font-bold">{formatCurrency(calculateInvoiceSubtotal())}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">خصم المورد (ج.م)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invDiscount}
                  onChange={(e) => setInvDiscount(e.target.value)}
                  className="w-full rounded border py-1.5 px-3 text-sm text-left font-mono bg-gray-50"
                />
              </div>

              {vatEnabled && (
                <div className="flex justify-between text-gray-600 border-t pt-2">
                  <span>الضريبة المضافة ({vatPct}%):</span>
                  <span className="font-mono font-bold text-yellow-600">{formatCurrency(calculateInvoiceTax(calculateInvoiceSubtotal()))}</span>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold text-gray-900 border-t pt-3">
                <span>المجموع الكلي:</span>
                <span className="font-mono text-blue-600">{formatCurrency(calculateInvoiceTotal())}</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold text-sm transition"
            >
              حفظ وتثبيت الشراء (Save)
            </button>
          </div>
        </form>
      )}

      {activeSubTab === 'vouchers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create payment voucher */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">إنشاء سند صرف مالي جديد</h3>
            <form onSubmit={handleSavePaymentVoucher} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المورد المستلم</label>
                <select
                  required
                  value={vouchSupplier}
                  onChange={(e) => setVouchSupplier(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white font-semibold"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">مربوط بفاتورة مشتريات معلقة (اختياري)</label>
                <select
                  value={vouchInvoiceId}
                  onChange={(e) => setVouchInvoiceId(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  <option value="">-- سداد عام على الحساب --</option>
                  {purchaseInvoices
                    .filter((i: any) => i.supplier_id === vouchSupplier && i.status !== 'paid')
                    .map((i: any) => (
                      <option key={i.id} value={i.id}>{i.invoice_no} (المتبقي: {i.total} ج.م)</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الحساب الصادر منه (صندوق كاش أو بنك)</label>
                <select
                  required
                  value={vouchAccountId}
                  onChange={(e) => setVouchAccountId(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  {accounts.filter((a: any) => a.category === 'cash' || a.category === 'bank').map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المبلغ المصروف (ج.م)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={vouchAmount}
                  onChange={(e) => setVouchAmount(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left font-mono font-semibold"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-xs transition"
              >
                توليد واعتماد سند الصرف
              </button>
            </form>
          </div>

          {/* Payment Vouchers list */}
          <div className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">سجل السندات المالية المصروفة</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">رقم السند</th>
                    <th className="py-3 px-4">المورد</th>
                    <th className="py-3 px-4 text-center">المبلغ المصروف</th>
                    <th className="py-3 px-4">الحساب الصادر</th>
                    <th className="py-3 px-4">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {paymentVouchers.map(v => {
                    const sName = suppliers.find(s => s.id === v.supplier_id)?.name || '';
                    const accName = accounts.find(a => a.id === v.account_id)?.name || '';
                    return (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-bold text-gray-800">{v.voucher_no}</td>
                        <td className="py-3 px-4 text-gray-700">{sName}</td>
                        <td className="py-3 px-4 text-center font-bold text-red-600 font-mono">{formatCurrency(v.amount)}</td>
                        <td className="py-3 px-4 text-gray-600">{accName}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{v.date ? formatDate(v.date) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'statement' && (
        <div className="bg-white p-6 rounded-lg border shadow">
          <div className="border-b pb-4 mb-6">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <span>كشف حساب مورد تفصيلي (Statement of Account)</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">مطابقة ومراقبة الذمم المالية لموردي المواد الأولية والكرتون</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded border">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">اختر المورد</label>
              <select
                value={statementSuppId}
                onChange={(e) => setStatementSuppId(e.target.value)}
                className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white font-semibold"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">من تاريخ</label>
              <input
                type="date"
                value={statementStart}
                onChange={(e) => setStatementStartDate(e.target.value)}
                className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">إلى تاريخ</label>
              <input
                type="date"
                value={statementEnd}
                onChange={(e) => setStatementEndDate(e.target.value)}
                className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left bg-white"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={runSupplierStatement}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition"
              >
                تحديث وعرض الكشف
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-right">
              <thead className="bg-gray-50">
                <tr className="text-xs font-bold text-gray-500">
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">بيان الحركة / التفاصيل</th>
                  <th className="py-3 px-4 text-center text-green-600">مدين (Debit - سداد)</th>
                  <th className="py-3 px-4 text-center text-red-600">دائن (Credit - فاتورة)</th>
                  <th className="py-3 px-4 text-center text-blue-600 font-bold">الرصيد الجاري المستحق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {statementRecords.length > 0 ? (
                  statementRecords.map((rec, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-700">{formatDate(rec.date)}</td>
                      <td className="py-3 px-4 font-semibold text-gray-600">{rec.desc}</td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-green-600">{rec.debit > 0 ? `-${rec.debit.toFixed(2)}` : '-'}</td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-red-600">{rec.credit > 0 ? `+${rec.credit.toFixed(2)}` : '-'}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-blue-600 bg-blue-50/50">{formatCurrency(rec.balance)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 italic">
                      انقر على تطبيق الفلتر لعرض كشف حساب المورد الحالي.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
