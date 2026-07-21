import React, { useState, useEffect } from 'react';
import { db } from '../lib/dexie';
import { queueOfflineWrite } from '../lib/sync';
import { getSetting, getSettingBool } from '../lib/settingsHelper';
import {
  Users,
  Plus,
  Trash2,
  FileText,
  Receipt,
  TrendingUp
} from 'lucide-react';

export const Purchases: React.FC = () => {
  // Tabs
  const [activeSubTab, setActiveSubTab] = useState<'suppliers' | 'invoices' | 'vouchers' | 'statement'>('invoices');

  // Master lists
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [paymentVouchers, setPaymentVouchers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

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
  const [vatPct, setVatPct] = useState(15);

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const listSupps = await db.suppliers.toArray();
    const listItems = await db.items.filter((i: any) => i.type === 'raw_material' || i.type === 'packaging').toArray();
    const listInvs = await db.purchase_invoices.toArray();
    const listVouch = await db.payment_vouchers.toArray();
    const listWh = await db.warehouses.filter((w: any) => w.is_active).toArray();
    const listAccs = await db.accounts.toArray();

    setSuppliers(listSupps);
    setItems(listItems);
    setPurchaseInvoices(listInvs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setPaymentVouchers(listVouch);
    setWarehouses(listWh);
    setAccounts(listAccs);

    if (listSupps.length > 0) {
      setInvSupplier(listSupps[0].id);
      setVouchSupplier(listSupps[0].id);
      setStatementSuppId(listSupps[0].id);
    }
    if (listWh.length > 0) setInvWarehouse(listWh[0].id);

    const financial = listAccs.filter((a: any) => a.category === 'cash' || a.category === 'bank');
    if (financial.length > 0) setVouchAccountId(financial[0].id);

    setVatEnabled(await getSettingBool('vat_enabled', false));
    setVatPct(Number(await getSetting('default_vat_pct', '15')));
  };

  // Add Supplier
  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppName.trim()) return;

    try {
      const id = crypto.randomUUID();
      const suppObj = {
        id,
        name: suppName.trim(),
        phone: suppPhone.trim() || null,
        address: suppAddress.trim() || null,
        opening_balance: Number(suppOpening),
        created_at: new Date().toISOString()
      };
      await queueOfflineWrite('suppliers', 'insert', id, suppObj);
      setSuppName('');
      setSuppPhone('');
      setSuppAddress('');
      setSuppOpening('0');
      await loadData();
      alert('تم تسجيل المورد بنجاح!');
    } catch (e: any) {
      alert(e.message);
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

  // Save Purchase Invoice
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invSupplier || !invWarehouse || invLines.some((l: any) => !l.item_id)) {
      alert('يرجى التحقق من تحديد المورد ومخزن الاستلام وتعبئة كافة البنود.');
      return;
    }

    try {
      const invId = crypto.randomUUID();
      const sub = calculateInvoiceSubtotal();
      const disc = Number(invDiscount) || 0;
      const tax = calculateInvoiceTax(sub);
      const total = calculateInvoiceTotal();

      const tempNo = `PENDING-PUR-${Date.now()}`;

      // 1. Create Purchase Invoice Record
      const invoiceObj = {
        id: invId,
        invoice_no: tempNo,
        supplier_id: invSupplier,
        date: new Date().toISOString().split('T')[0],
        payment_method: invPaymentMethod,
        subtotal: sub,
        discount: disc,
        tax: tax,
        total: total,
        status: invPaymentMethod === 'cash' ? 'paid' : 'unpaid',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await queueOfflineWrite('purchase_invoices', 'insert', invId, invoiceObj);

      // 2. Save Lines & Add stock via Movements
      for (const line of invLines) {
        const lineId = crypto.randomUUID();
        const lQty = Number(line.qty) || 0;
        const lPrice = Number(line.unit_price) || 0;
        const lineTotal = lQty * lPrice;

        const lineObj = {
          id: lineId,
          invoice_id: invId,
          item_id: line.item_id,
          qty: lQty,
          unit_price: lPrice,
          discount: 0,
          line_total: lineTotal,
          created_at: new Date().toISOString()
        };
        await queueOfflineWrite('purchase_invoice_lines', 'insert', lineId, lineObj);

        // Add raw/packaging materials stock movement (positive qty)
        const movId = crypto.randomUUID();
        const movObj = {
          id: movId,
          item_id: line.item_id,
          warehouse_id: invWarehouse,
          batch_no: tempNo,
          movement_type: 'purchase_in',
          qty: lQty,
          ref_table: 'purchase_invoices',
          ref_id: invId,
          moved_at: new Date().toISOString()
        };
        await queueOfflineWrite('stock_movements', 'insert', movId, movObj);
      }

      // 3. Accounting Transactions
      const cogsAcc = accounts.find((a: any) => a.category === 'cogs')?.id;
      const apAcc = accounts.find((a: any) => a.category === 'ap')?.id;
      const cashAcc = accounts.find((a: any) => a.category === 'cash')?.id;

      if (invPaymentMethod === 'cash' && cashAcc && cogsAcc) {
        // Debit COGS/Inventory, Credit Cash
        const tx1 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', tx1, {
          id: tx1,
          account_id: cogsAcc,
          ref_table: 'purchase_invoices',
          ref_id: invId,
          debit: total,
          credit: 0,
          date: new Date().toISOString().split('T')[0]
        });
        const tx2 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', tx2, {
          id: tx2,
          account_id: cashAcc,
          ref_table: 'purchase_invoices',
          ref_id: invId,
          debit: 0,
          credit: total,
          date: new Date().toISOString().split('T')[0]
        });
      } else if (invPaymentMethod === 'credit' && apAcc && cogsAcc) {
        // Debit COGS, Credit AP
        const tx1 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', tx1, {
          id: tx1,
          account_id: cogsAcc,
          ref_table: 'purchase_invoices',
          ref_id: invId,
          debit: total,
          credit: 0,
          date: new Date().toISOString().split('T')[0]
        });
        const tx2 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', tx2, {
          id: tx2,
          account_id: apAcc,
          ref_table: 'purchase_invoices',
          ref_id: invId,
          debit: 0,
          credit: total,
          date: new Date().toISOString().split('T')[0]
        });
      }

      setInvDiscount('0');
      setInvLines([{ item_id: '', qty: 1, unit_price: 0 }]);
      await loadData();
      alert('تم حفظ فاتورة المشتريات وإضافة البضاعة بنجاح!');
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Payment Vouchers (سند صرف)
  const handleSavePaymentVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vouchSupplier || !vouchAmount || !vouchAccountId) return;

    try {
      const vId = crypto.randomUUID();
      const amountNum = Number(vouchAmount);
      const tempNo = `PENDING-PAY-${Date.now()}`;

      const vObj = {
        id: vId,
        voucher_no: tempNo,
        supplier_id: vouchSupplier,
        invoice_id: vouchInvoiceId || null,
        amount: amountNum,
        date: new Date().toISOString().split('T')[0],
        account_id: vouchAccountId,
        created_at: new Date().toISOString()
      };
      await queueOfflineWrite('payment_vouchers', 'insert', vId, vObj);

      if (vouchInvoiceId) {
        const inv = purchaseInvoices.find((i: any) => i.id === vouchInvoiceId);
        if (inv) {
          const existingVouchAmount = paymentVouchers
            .filter((pv: any) => pv.invoice_id === vouchInvoiceId)
            .reduce((sum, pv) => sum + Number(pv.amount), 0);

          const newTotalPaid = existingVouchAmount + amountNum;
          const status = newTotalPaid >= inv.total ? 'paid' : 'partially_paid';

          await queueOfflineWrite('purchase_invoices', 'insert', inv.id, {
            ...inv,
            status,
            updated_at: new Date().toISOString()
          });
        }
      }

      // Accounting Entry: Debit AP, Credit Cash/Bank
      const apAcc = accounts.find((a: any) => a.category === 'ap')?.id;
      if (apAcc) {
        const tx1 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', tx1, {
          id: tx1,
          account_id: apAcc, // AP
          ref_table: 'payment_vouchers',
          ref_id: vId,
          debit: amountNum,
          credit: 0,
          date: new Date().toISOString().split('T')[0]
        });
        const tx2 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', tx2, {
          id: tx2,
          account_id: vouchAccountId, // Cash/Bank
          ref_table: 'payment_vouchers',
          ref_id: vId,
          debit: 0,
          credit: amountNum,
          date: new Date().toISOString().split('T')[0]
        });
      }

      setVouchAmount('0');
      setVouchInvoiceId('');
      await loadData();
      alert('تم تسجيل سند الصرف وتحديث أرصدة المورد بنجاح!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Statement of Account
  const runSupplierStatement = async () => {
    if (!statementSuppId) return;

    const listTransactions: any[] = [];
    const supp = suppliers.find((s: any) => s.id === statementSuppId);
    if (!supp) return;

    // Opening Balance
    listTransactions.push({
      date: supp.created_at?.split('T')[0] || '2026-01-01',
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
                <label className="block text-xs font-bold text-gray-600 mb-1">الرصيد الافتتاحي (دائن ر.س)</label>
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
                        {(
                          Number(s.opening_balance) +
                          purchaseInvoices.filter((i: any) => i.supplier_id === s.id).reduce((sum, i) => sum + Number(i.total), 0) -
                          paymentVouchers.filter((v: any) => v.supplier_id === s.id).reduce((sum, v) => sum + Number(v.amount), 0)
                        ).toFixed(2)} ر.س
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
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
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
                <span className="font-mono font-bold">{calculateInvoiceSubtotal().toFixed(2)} ر.س</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">خصم المورد (ر.س)</label>
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
                  <span className="font-mono font-bold text-yellow-600">{calculateInvoiceTax(calculateInvoiceSubtotal()).toFixed(2)} ر.س</span>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold text-gray-900 border-t pt-3">
                <span>المجموع الكلي:</span>
                <span className="font-mono text-blue-600">{calculateInvoiceTotal().toFixed(2)} ر.س</span>
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
                      <option key={i.id} value={i.id}>{i.invoice_no} (المتبقي: {i.total} ر.س)</option>
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
                <label className="block text-xs font-bold text-gray-600 mb-1">المبلغ المصروف (ر.س)</label>
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
                        <td className="py-3 px-4 text-center font-bold text-red-600 font-mono">{v.amount} ر.س</td>
                        <td className="py-3 px-4 text-gray-600">{accName}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{new Date(v.date).toLocaleDateString('ar-EG')}</td>
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
                      <td className="py-3 px-4 text-gray-700">{rec.date}</td>
                      <td className="py-3 px-4 font-semibold text-gray-600">{rec.desc}</td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-green-600">{rec.debit > 0 ? `-${rec.debit.toFixed(2)}` : '-'}</td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-red-600">{rec.credit > 0 ? `+${rec.credit.toFixed(2)}` : '-'}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-blue-600 bg-blue-50/50">{rec.balance.toFixed(2)} ر.س</td>
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
