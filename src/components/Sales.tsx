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

export const Sales: React.FC = () => {
  // Tabs
  const [activeSubTab, setActiveSubTab] = useState<'customers' | 'invoices' | 'vouchers' | 'statement'>('invoices');

  // Master lists
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [salesReturns, setSalesReturns] = useState<any[]>([]);
  const [receiptVouchers, setReceiptVouchers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  // 1. Customer State
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custOpening, setCustOpening] = useState('0');

  // 2. Invoice State
  const [invCustomer, setInvCustomer] = useState('');
  const [invWarehouse, setInvWarehouse] = useState('');
  const [invPaymentMethod, setInvPaymentMethod] = useState<'cash' | 'credit' | 'bank'>('cash');
  const [invLines, setInvLines] = useState<any[]>([{ item_id: '', qty: 1, unit_price: 0, discount: 0 }]);
  const [invDiscount, setInvDiscount] = useState('0'); // invoice level discount

  // Settings Cache
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatPct, setVatPct] = useState(15);
  const [lineDiscountAllowed, setLineDiscountAllowed] = useState(true);

  // 3. Receipt Voucher State
  const [vouchCustomer, setVouchCustomer] = useState('');
  const [vouchInvoiceId, setVouchInvoiceId] = useState('');
  const [vouchAmount, setVouchAmount] = useState('0');
  const [vouchAccountId, setVouchAccountId] = useState(''); // Cash or Bank Account

  // 4. Customer Statement State
  const [statementCustId, setStatementCustId] = useState('');
  const [statementStart, setStatementStartDate] = useState('');
  const [statementEnd, setStatementEndDate] = useState('');
  const [statementRecords, setStatementRecords] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const listCusts = await db.customers.toArray();
    const listItems = await db.items.filter((i: any) => i.type === 'finished_good').toArray();
    const listInvs = await db.sales_invoices.toArray();
    const listRets = await db.sales_returns.toArray();
    const listVouch = await db.receipt_vouchers.toArray();
    const listWh = await db.warehouses.filter((w: any) => w.is_active).toArray();
    const listAccs = await db.accounts.toArray();

    setCustomers(listCusts);
    setItems(listItems);
    setSalesInvoices(listInvs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setSalesReturns(listRets);
    setReceiptVouchers(listVouch);
    setWarehouses(listWh);
    setAccounts(listAccs);

    if (listCusts.length > 0) {
      setInvCustomer(listCusts[0].id);
      setVouchCustomer(listCusts[0].id);
      setStatementCustId(listCusts[0].id);
    }
    if (listWh.length > 0) setInvWarehouse(listWh[0].id);

    // Load Cash/Bank account for vouchers
    const financial = listAccs.filter((a: any) => a.category === 'cash' || a.category === 'bank');
    if (financial.length > 0) setVouchAccountId(financial[0].id);

    setVatEnabled(await getSettingBool('vat_enabled', false));
    setVatPct(Number(await getSetting('default_vat_pct', '14')));
    setLineDiscountAllowed(await getSettingBool('discount_lines_enabled', true));
  };

  // Add Customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;

    try {
      const id = crypto.randomUUID();
      const custObj = {
        id,
        name: custName.trim(),
        phone: custPhone.trim() || null,
        address: custAddress.trim() || null,
        opening_balance: Number(custOpening),
        created_at: new Date().toISOString()
      };
      await queueOfflineWrite('customers', 'insert', id, custObj);
      setCustName('');
      setCustPhone('');
      setCustAddress('');
      setCustOpening('0');
      await loadData();
      alert('تم تسجيل العميل بنجاح!');
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Live Invoice Subtotals
  const calculateInvoiceSubtotal = () => {
    return invLines.reduce((sum, line) => {
      const qty = Number(line.qty) || 0;
      const price = Number(line.unit_price) || 0;
      const lDisc = Number(line.discount) || 0;
      return sum + ((qty * price) - lDisc);
    }, 0);
  };

  const calculateInvoiceTax = (sub: number) => {
    if (!vatEnabled) return 0;
    const invDiscNum = Number(invDiscount) || 0;
    const taxable = Math.max(sub - invDiscNum, 0);
    return (taxable * vatPct) / 100;
  };

  const calculateInvoiceTotal = () => {
    const sub = calculateInvoiceSubtotal();
    const invDiscNum = Number(invDiscount) || 0;
    const tax = calculateInvoiceTax(sub);
    return Math.max(sub - invDiscNum + tax, 0);
  };

  const handleAddInvoiceLine = () => {
    setInvLines([...invLines, { item_id: '', qty: 1, unit_price: 0, discount: 0 }]);
  };

  const handleRemoveInvoiceLine = (index: number) => {
    const updated = [...invLines];
    updated.splice(index, 1);
    setInvLines(updated);
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const updated = [...invLines];
    if (field === 'item_id') {
      const item = items.find((i: any) => i.id === value);
      updated[index] = {
        ...updated[index],
        item_id: value,
        unit_price: item ? item.default_price : 0
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setInvLines(updated);
  };

  // Create Invoice
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invCustomer || !invWarehouse || invLines.some((l: any) => !l.item_id)) {
      alert('يرجى التحقق من تحديد العميل ومخزن الصرف وتعبئة كافة البنود.');
      return;
    }

    try {
      const invId = crypto.randomUUID();
      const sub = calculateInvoiceSubtotal();
      const disc = Number(invDiscount) || 0;
      const tax = calculateInvoiceTax(sub);
      const total = calculateInvoiceTotal();

      // Sequential temporary invoice no for offline
      const tempNo = `PENDING-INV-${Date.now()}`;

      // 1. Create Sales Invoice Record
      const invoiceObj = {
        id: invId,
        invoice_no: tempNo,
        customer_id: invCustomer,
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
      await queueOfflineWrite('sales_invoices', 'insert', invId, invoiceObj);

      // 2. Save Invoice Lines & Deduct stock via Movements
      for (const line of invLines) {
        const lineId = crypto.randomUUID();
        const lQty = Number(line.qty) || 0;
        const lPrice = Number(line.unit_price) || 0;
        const lDisc = Number(line.discount) || 0;
        const lineTotal = (lQty * lPrice) - lDisc;

        const lineObj = {
          id: lineId,
          invoice_id: invId,
          item_id: line.item_id,
          qty: lQty,
          unit_price: lPrice,
          discount: lDisc,
          line_total: lineTotal,
          created_at: new Date().toISOString()
        };
        await queueOfflineWrite('sales_invoice_lines', 'insert', lineId, lineObj);

        // Deduct finished goods stock movement
        const movId = crypto.randomUUID();
        const movObj = {
          id: movId,
          item_id: line.item_id,
          warehouse_id: invWarehouse,
          batch_no: tempNo,
          movement_type: 'sale_out',
          qty: -lQty,
          ref_table: 'sales_invoices',
          ref_id: invId,
          moved_at: new Date().toISOString()
        };
        await queueOfflineWrite('stock_movements', 'insert', movId, movObj);
      }

      // 3. Accounting Transactions
      const revenueAcc = accounts.find((a: any) => a.category === 'revenue')?.id;
      const arAcc = accounts.find((a: any) => a.category === 'ar')?.id;
      const cashAcc = accounts.find((a: any) => a.category === 'cash')?.id;

      if (invPaymentMethod === 'cash' && cashAcc && revenueAcc) {
        // Debit Cash, Credit Revenue
        const txId1 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', txId1, {
          id: txId1,
          account_id: cashAcc,
          ref_table: 'sales_invoices',
          ref_id: invId,
          debit: total,
          credit: 0,
          date: new Date().toISOString().split('T')[0]
        });
        const txId2 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', txId2, {
          id: txId2,
          account_id: revenueAcc,
          ref_table: 'sales_invoices',
          ref_id: invId,
          debit: 0,
          credit: total,
          date: new Date().toISOString().split('T')[0]
        });
      } else if (invPaymentMethod === 'credit' && arAcc && revenueAcc) {
        // Debit AR, Credit Revenue
        const txId1 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', txId1, {
          id: txId1,
          account_id: arAcc,
          ref_table: 'sales_invoices',
          ref_id: invId,
          debit: total,
          credit: 0,
          date: new Date().toISOString().split('T')[0]
        });
        const txId2 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', txId2, {
          id: txId2,
          account_id: revenueAcc,
          ref_table: 'sales_invoices',
          ref_id: invId,
          debit: 0,
          credit: total,
          date: new Date().toISOString().split('T')[0]
        });
      }

      setInvDiscount('0');
      setInvLines([{ item_id: '', qty: 1, unit_price: 0, discount: 0 }]);
      await loadData();
      alert('تم حفظ فاتورة المبيعات وصرف البضاعة بنجاح!');
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Receipt Vouchers
  const handleSaveReceiptVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vouchCustomer || !vouchAmount || !vouchAccountId) return;

    try {
      const vId = crypto.randomUUID();
      const amountNum = Number(vouchAmount);
      const tempNo = `PENDING-REC-${Date.now()}`;

      const vObj = {
        id: vId,
        voucher_no: tempNo,
        customer_id: vouchCustomer,
        invoice_id: vouchInvoiceId || null,
        amount: amountNum,
        date: new Date().toISOString().split('T')[0],
        account_id: vouchAccountId,
        created_at: new Date().toISOString()
      };
      await queueOfflineWrite('receipt_vouchers', 'insert', vId, vObj);

      // Updates invoice status to partially_paid/paid if applied to invoice
      if (vouchInvoiceId) {
        const inv = salesInvoices.find((i: any) => i.id === vouchInvoiceId);
        if (inv) {
          // get existing payments
          const existingVouchAmount = receiptVouchers
            .filter((rv: any) => rv.invoice_id === vouchInvoiceId)
            .reduce((sum, rv) => sum + Number(rv.amount), 0);

          const newTotalPaid = existingVouchAmount + amountNum;
          const status = newTotalPaid >= inv.total ? 'paid' : 'partially_paid';

          await queueOfflineWrite('sales_invoices', 'insert', inv.id, {
            ...inv,
            status,
            updated_at: new Date().toISOString()
          });
        }
      }

      // Accounting Journal Entry: Debit Cash/Bank, Credit AR
      const arAcc = accounts.find((a: any) => a.category === 'ar')?.id;
      if (arAcc) {
        const tx1 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', tx1, {
          id: tx1,
          account_id: vouchAccountId, // Cash/Bank
          ref_table: 'receipt_vouchers',
          ref_id: vId,
          debit: amountNum,
          credit: 0,
          date: new Date().toISOString().split('T')[0]
        });
        const tx2 = crypto.randomUUID();
        await queueOfflineWrite('account_transactions', 'insert', tx2, {
          id: tx2,
          account_id: arAcc, // AR
          ref_table: 'receipt_vouchers',
          ref_id: vId,
          debit: 0,
          credit: amountNum,
          date: new Date().toISOString().split('T')[0]
        });
      }

      setVouchAmount('0');
      setVouchInvoiceId('');
      await loadData();
      alert('تم حفظ سند القبض وتحديث حسابات العميل بنجاح!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Statement of Account Report
  const runCustomerStatement = async () => {
    if (!statementCustId) return;

    // Statement includes: Opening balance, invoices, receipt vouchers, sales returns
    const listTransactions: any[] = [];

    const cust = customers.find((c: any) => c.id === statementCustId);
    if (!cust) return;

    // Opening Balance
    listTransactions.push({
      date: cust.created_at?.split('T')[0] || '2026-01-01',
      desc: 'الرصيد الافتتاحي عند التسجيل',
      debit: Number(cust.opening_balance) || 0,
      credit: 0,
    });

    // Invoices (Debit AR)
    const invs = salesInvoices.filter((i: any) => i.customer_id === statementCustId);
    invs.forEach((i: any) => {
      listTransactions.push({
        date: i.date,
        desc: `فاتورة مبيعات رقم ${i.invoice_no}`,
        debit: Number(i.total),
        credit: 0,
      });
    });

    // Receipt Vouchers (Credit AR)
    const rvs = receiptVouchers.filter((v: any) => v.customer_id === statementCustId);
    rvs.forEach((v: any) => {
      listTransactions.push({
        date: v.date,
        desc: `سند قبض رقم ${v.voucher_no} ${v.invoice_id ? '(مسدد جزئي)' : '(على الحساب)'}`,
        debit: 0,
        credit: Number(v.amount),
      });
    });

    // Standalone Returns (Credit AR)
    const rets = salesReturns.filter((r: any) => r.customer_id === statementCustId);
    rets.forEach((r: any) => {
      listTransactions.push({
        date: r.date,
        desc: `مرتجع مبيعات رقم ${r.return_no}`,
        debit: 0,
        credit: Number(r.total),
      });
    });

    // Apply date filters if any
    let filtered = [...listTransactions];
    if (statementStart) {
      filtered = filtered.filter((t: any) => t.date >= statementStart);
    }
    if (statementEnd) {
      filtered = filtered.filter((t: any) => t.date <= statementEnd);
    }

    // Sort ascending
    const chronological = filtered.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute running balance
    let bal = 0;
    const finalRecords = chronological.map((t: any) => {
      bal += t.debit - t.credit;
      return { ...t, balance: bal };
    });

    setStatementRecords(finalRecords.reverse());
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المبيعات والعملاء والسندات / Sales</h1>
          <p className="text-gray-500 text-sm mt-1">إنشاء الفواتير والضرائب تلقائياً، مرتجع مبيعات، سند قبض، كشف حساب جاري</p>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-lg p-1 shadow-sm">
        <button
          onClick={() => setActiveSubTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'invoices' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>فاتورة مبيعات جديدة</span>
        </button>
        <button
          onClick={() => setActiveSubTab('vouchers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'vouchers' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>سند قبض مالي (سند قبض)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('customers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'customers' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>قائمة وملفات العملاء</span>
        </button>
        <button
          onClick={() => {
            setActiveSubTab('statement');
            runCustomerStatement();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'statement' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>كشف حساب عميل تفصيلي</span>
        </button>
      </div>

      {activeSubTab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Add Form */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">ملف عميل جديد</h3>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اسم العميل / الشركة</label>
                <input
                  type="text"
                  required
                  placeholder="شركة الوفاق لصيانة الإطارات"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  placeholder="0512345678"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">العنوان</label>
                <input
                  type="text"
                  placeholder="القاهرة، مدينة نصر"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الرصيد الافتتاحي (مدين ج.م)</label>
                <input
                  type="number"
                  value={custOpening}
                  onChange={(e) => setCustOpening(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition"
              >
                حفظ العميل
              </button>
            </form>
          </div>

          {/* Customers List */}
          <div className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">العملاء المسجلين</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">الاسم</th>
                    <th className="py-3 px-4">الهاتف</th>
                    <th className="py-3 px-4">العنوان</th>
                    <th className="py-3 px-4 text-center">الرصيد الجاري</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {customers.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-bold text-gray-800">{c.name}</td>
                      <td className="py-3 px-4 text-gray-600">{c.phone || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">{c.address || '-'}</td>
                      <td className="py-3 px-4 text-center font-bold text-blue-600 font-mono">
                        {(
                          Number(c.opening_balance) +
                          salesInvoices.filter((i: any) => i.customer_id === c.id).reduce((sum, i) => sum + Number(i.total), 0) -
                          receiptVouchers.filter((v: any) => v.customer_id === c.id).reduce((sum, v) => sum + Number(v.amount), 0)
                        ).toFixed(2)} ج.م
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
          {/* Invoice Lines Table */}
          <div className="lg:col-span-3 bg-white p-6 rounded-lg border shadow">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-3 mb-6">تحرير فاتورة مبيعات جديدة</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded border">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">العميل</label>
                <select
                  required
                  value={invCustomer}
                  onChange={(e) => setInvCustomer(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white font-semibold"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">مخزن الصرف</label>
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
                  <option value="cash">نقداً (سداد فوري كاش)</option>
                  <option value="credit">آجل (على الحساب بالذمة)</option>
                  <option value="bank">حوالة بنكية</option>
                </select>
              </div>
            </div>

            {/* Lines rows */}
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-gray-100 p-2 rounded">
                <span className="text-xs font-bold text-gray-700">بنود الفاتورة:</span>
                <button
                  type="button"
                  onClick={handleAddInvoiceLine}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إضافة سطر</span>
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
                      <option value="">-- اختر الصنف تام الصنع --</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-20">
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

                  <div className="w-28">
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="سعر الوحدة"
                      value={line.unit_price}
                      onChange={(e) => handleLineChange(idx, 'unit_price', Number(e.target.value))}
                      className="w-full rounded border border-gray-300 py-1.5 px-2 text-sm text-left font-semibold font-mono"
                    />
                  </div>

                  {lineDiscountAllowed && (
                    <div className="w-24">
                      <input
                        type="number"
                        min="0"
                        placeholder="خصم سطر"
                        value={line.discount}
                        onChange={(e) => handleLineChange(idx, 'discount', Number(e.target.value))}
                        className="w-full rounded border border-gray-300 py-1.5 px-2 text-sm text-left font-mono"
                      />
                    </div>
                  )}

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

          {/* Invoice Summary and Submit */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit space-y-6">
            <h3 className="font-bold text-gray-800 border-b pb-2">ملخص الحساب والفاتورة</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>المجموع الفرعي:</span>
                <span className="font-mono font-bold">{calculateInvoiceSubtotal().toFixed(2)} ج.م</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">خصم كلي على الفاتورة (ج.م)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invDiscount}
                  onChange={(e) => setInvDiscount(e.target.value)}
                  className="w-full rounded border py-1.5 px-3 text-sm text-left font-mono bg-gray-50 focus:bg-white"
                />
              </div>

              {vatEnabled && (
                <div className="flex justify-between text-gray-600 border-t pt-2">
                  <span>الضريبة ({vatPct}%):</span>
                  <span className="font-mono font-bold text-yellow-600">{calculateInvoiceTax(calculateInvoiceSubtotal()).toFixed(2)} ج.م</span>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold text-gray-900 border-t pt-3">
                <span>المجموع النهائي:</span>
                <span className="font-mono text-blue-600">{calculateInvoiceTotal().toFixed(2)} ج.م</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold text-sm transition"
            >
              حفظ واعتماد الفاتورة (Save)
            </button>
          </div>
        </form>
      )}

      {activeSubTab === 'vouchers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create receipt voucher */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">إنشاء سند قبض مالي جديد</h3>
            <form onSubmit={handleSaveReceiptVoucher} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">العميل الدافع</label>
                <select
                  required
                  value={vouchCustomer}
                  onChange={(e) => setVouchCustomer(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white font-semibold"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">مربوط بفاتورة مبيعات معلقة (اختياري / جزئي)</label>
                <select
                  value={vouchInvoiceId}
                  onChange={(e) => setVouchInvoiceId(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  <option value="">-- دفعة على الحساب العام --</option>
                  {salesInvoices
                    .filter((i: any) => i.customer_id === vouchCustomer && i.status !== 'paid')
                    .map((i: any) => (
                      <option key={i.id} value={i.id}>{i.invoice_no} (المتبقي: {i.total} ج.م)</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الحساب المستلم (صندوق كاش أو بنك)</label>
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
                <label className="block text-xs font-bold text-gray-600 mb-1">المبلغ المقبوض (ج.م)</label>
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
                className="w-full flex justify-center py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-xs transition"
              >
                توليد واعتماد سند القبض
              </button>
            </form>
          </div>

          {/* Receipt Vouchers List */}
          <div className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">سجل السندات المالية الصادرة</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">رقم السند</th>
                    <th className="py-3 px-4">العميل</th>
                    <th className="py-3 px-4 text-center">المبلغ</th>
                    <th className="py-3 px-4">الحساب المستلم</th>
                    <th className="py-3 px-4">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {receiptVouchers.map(v => {
                    const cName = customers.find(c => c.id === v.customer_id)?.name || '';
                    const accName = accounts.find(a => a.id === v.account_id)?.name || '';
                    return (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-bold text-gray-800">{v.voucher_no}</td>
                        <td className="py-3 px-4 text-gray-700">{cName}</td>
                        <td className="py-3 px-4 text-center font-bold text-green-600 font-mono">{v.amount} ج.م</td>
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
              <span>كشف حساب عميل تفصيلي (Statement of Account)</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">تتبع الحركات المالية الجارية للعملاء ومطابقة الأرصدة</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded border">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">اختر العميل</label>
              <select
                value={statementCustId}
                onChange={(e) => setStatementCustId(e.target.value)}
                className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white font-semibold"
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
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
                onClick={runCustomerStatement}
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
                  <th className="py-3 px-4 text-center text-red-600">مدين (Debit - فاتورة)</th>
                  <th className="py-3 px-4 text-center text-green-600">دائن (Credit - سداد)</th>
                  <th className="py-3 px-4 text-center text-blue-600 font-bold">الرصيد الجاري المستحق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {statementRecords.length > 0 ? (
                  statementRecords.map((rec, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-700">{rec.date}</td>
                      <td className="py-3 px-4 font-semibold text-gray-600">{rec.desc}</td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-red-600">{rec.debit > 0 ? `+${rec.debit.toFixed(2)}` : '-'}</td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-green-600">{rec.credit > 0 ? `-${rec.credit.toFixed(2)}` : '-'}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-blue-600 bg-blue-50/50">{rec.balance.toFixed(2)} ج.م</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 italic">
                      انقر على تطبيق الفلتر لعرض كشف حساب العميل الحالي.
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
