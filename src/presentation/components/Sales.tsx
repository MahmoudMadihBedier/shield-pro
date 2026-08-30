import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { ServiceFactory } from '../../application/services/service-factory';
import { db } from '../../infrastructure/database/dexie';
import { getSetting, getSettingBool } from '../../shared/utils/settings-helper';
import { formatCurrency, formatDate } from '../../shared/utils/format';
import { getErrorMessage } from '../../shared/utils/errors';
import { useCustomers, useSalesInvoices, useReceiptVouchers, useCustomerStatement } from '../../application/hooks/use-sales';
import { useAuth } from '../../application/services/auth-service';
import { useAccounts } from '../../application/hooks/use-accounting';
import { useInventory } from '../../application/hooks/use-inventory';
import { useRecipes } from '../../application/hooks/use-manufacturing';
import { Warehouse } from '../../core/domain/entities';
import { PaginationParams, EntityFilter } from '../../core/types';
import { BarcodeScanInput, type ScannableItem } from './BarcodeScanInput';
import { useToast } from './ui/Toast';
import { useConfirm } from './ui/ConfirmDialog';
import { FormField } from './ui/ValidationMessage';
import { PageHeader } from './ui/PageHeader';
import { Tabs } from './ui/Tabs';
import { DocList, type DocColumn } from './ui/DocList';
import { EntitySelect } from './ui/EntitySelect';
import { NumberInput, MoneyInput } from './ui/NumberInput';
import { StatusBadge } from './ui/StatusBadge';
import { enumLabel } from '../../shared/i18n/labels';
import { SalesCustomers } from './SalesCustomers';
import {
  Users,
  Plus,
  Trash2,
  FileText,
  Receipt,
  TrendingUp,
  Boxes
} from 'lucide-react';

// Stable references (not recreated per render) so the data hooks below don't
// re-fetch in a loop — their internal useCallback/useEffect deps include
// these filter/params objects by identity.
const UNPAGINATED: PaginationParams = { page: 1, limit: 100000 };
const PACKAGING_RECIPE_FILTER: EntityFilter = { recipe_type: 'packaging' };

export const Sales: React.FC = () => {
  const { success, error, warning } = useToast();
  const { profile } = useAuth();
  const confirm = useConfirm();

  // Tabs
  const [activeSubTab, setActiveSubTab] = useState<'customers' | 'invoices' | 'vouchers' | 'statement'>('invoices');

  // Data, sourced from the service/hook layer instead of Dexie directly.
  const { customers: customersResult } = useCustomers();
  const customers = customersResult.data;

  const { invoices: salesInvoicesResult, createInvoice } = useSalesInvoices(undefined, UNPAGINATED);
  const salesInvoices = salesInvoicesResult.data;

  const { vouchers: receiptVouchersResult, createReceiptVoucher } = useReceiptVouchers(undefined, UNPAGINATED);
  const receiptVouchers = receiptVouchersResult.data;

  const { accounts: accountsResult } = useAccounts();
  const accounts = accountsResult.data;

  const { items: allItemsResult } = useInventory(undefined, UNPAGINATED);
  const allItems = allItemsResult.data;
  const items = allItems.filter((i) => i.type === 'finished_good');
  const itemNamesById = Object.fromEntries(allItems.map((i) => [i.id, i.name]));

  const { recipes: packagingRecipesResult } = useRecipes(PACKAGING_RECIPE_FILTER, UNPAGINATED);
  const packagingRecipes = packagingRecipesResult.data;

  const { statement: statementRecords, loadStatement } = useCustomerStatement();

  // No dedicated warehouse service/hook yet — matches the same direct
  // RepositoryFactory usage Inventory.tsx already uses for the same reason.
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  useEffect(() => {
    RepositoryFactory.getWarehouseRepository().findActive().then(setWarehouses);
  }, []);

  // Invoice State
  const [invCustomer, setInvCustomer] = useState('');
  const [invWarehouse, setInvWarehouse] = useState('');
  const [invPaymentMethod, setInvPaymentMethod] = useState<'cash' | 'credit' | 'bank'>('cash');
  const [invLines, setInvLines] = useState<any[]>([{ item_id: '', qty: 1, unit_price: 0, discount: 0 }]);
  const [invDiscount, setInvDiscount] = useState('0'); // invoice level discount

  // Van sale: bill against a rep's stock-in-hand instead of a warehouse.
  const [vanSale, setVanSale] = useState(false);
  const [vanRepId, setVanRepId] = useState('');
  const [repUsers, setRepUsers] = useState<any[]>([]);
  const [vanBalances, setVanBalances] = useState<{ item_id: string; balance: number }[]>([]);

  // Settings Cache
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatPct, setVatPct] = useState(14);
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

  // Default selections, once each list has loaded (mirrors the old loadData()
  // one-time defaulting, but reactive to each hook's own load instead of a
  // single combined fetch).
  useEffect(() => {
    if (customers.length > 0 && !invCustomer) {
      setInvCustomer(customers[0].id);
      setVouchCustomer(customers[0].id);
      setStatementCustId(customers[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  useEffect(() => {
    if (warehouses.length > 0 && !invWarehouse) {
      setInvWarehouse(warehouses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouses]);

  // Rep directory for the van-sale picker; default to the current user if
  // they are the one making a field sale.
  useEffect(() => {
    db.users.toArray().then((all) => {
      setRepUsers(all);
      if (!vanRepId && profile?.id) setVanRepId(profile.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Load the selected rep's van balances whenever van-sale is on.
  useEffect(() => {
    if (!vanSale || !vanRepId) { setVanBalances([]); return; }
    ServiceFactory.getRepLedgerService().getRepStockBalances(vanRepId)
      .then((b) => setVanBalances(b.filter((x) => x.balance !== 0)));
  }, [vanSale, vanRepId]);

  const vanBalanceOf = (itemId: string) => vanBalances.find((b) => b.item_id === itemId)?.balance ?? 0;

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
      setLineDiscountAllowed(await getSettingBool('discount_lines_enabled', true));
    })();
  }, []);

  // Customers are managed in the <SalesCustomers/> document (ERPNext-style
  // List → Form); this screen only reads the list for the invoice / voucher
  // / statement pickers.

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

  // Scanning an item's unit barcode adds qty 1; scanning its carton barcode
  // adds qty = that item's carton_pack_size (e.g. 20), exactly like typing that qty manually.
  const handleScannedItem = (scanned: ScannableItem, qty: number) => {
    setInvLines((prev) => {
      const existingIdx = prev.findIndex((l: any) => l.item_id === scanned.id);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], qty: Number(updated[existingIdx].qty) + qty };
        return updated;
      }
      const fullItem = items.find((i: any) => i.id === scanned.id);
      const newLine = { item_id: scanned.id, qty, unit_price: fullItem ? fullItem.default_price : 0, discount: 0 };
      const emptyIdx = prev.findIndex((l: any) => !l.item_id);
      if (emptyIdx !== -1) {
        const updated = [...prev];
        updated[emptyIdx] = newLine;
        return updated;
      }
      return [...prev, newLine];
    });
  };

  const handleScanNotFound = (code: string) => {
    warning(`لم يتم العثور على صنف بهذا الباركود: ${code}`);
  };

  const getPackagingBomFor = (itemId: string) => packagingRecipes.filter((r) => r.parent_item_id === itemId);

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

  // Best-effort GPS stamp — reps must create invoices with their current
  // location per the target workflow. Never blocks the sale: a denied
  // permission or a device with no GPS just leaves lat/lng null.
  const captureCurrentLocation = (): Promise<{ lat: number | null; lng: number | null }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: null, lng: null });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { timeout: 5000, maximumAge: 60000 }
      );
    });
  };

  const invoiceColumns: DocColumn<any>[] = [
    { key: 'no', label: 'رقم الفاتورة', primary: true, render: (i) => String(i.invoice_no).startsWith('PENDING-') ? 'قيد الحفظ' : i.invoice_no },
    { key: 'customer', label: 'العميل', render: (i) => customers.find((c) => c.id === i.customer_id)?.name || '—' },
    { key: 'date', label: 'التاريخ', hideOnCard: true, render: (i) => formatDate(i.date) },
    { key: 'total', label: 'الإجمالي', render: (i) => <span className="font-mono">{formatCurrency(Number(i.total))}</span> },
    { key: 'status', label: 'الحالة', render: (i) => <StatusBadge group="invoiceStatus" value={i.status} /> },
  ];

  const printReceipt = (invoice: any, lines: any[], customerName: string) => {
    const win = window.open('', '_blank', 'width=380,height=600');
    if (!win) return;
    const rows = lines.map((l: any) => {
      const item = items.find((i: any) => i.id === l.item_id);
      return `<tr><td>${item?.name || l.item_id}</td><td>${l.qty}</td><td>${formatCurrency(l.unit_price)}</td><td>${formatCurrency(l.line_total)}</td></tr>`;
    }).join('');
    win.document.write(`
      <html dir="rtl"><head><title>فاتورة ${invoice.invoice_no}</title>
      <style>body{font-family:sans-serif;font-size:13px;padding:12px}table{width:100%;border-collapse:collapse}td,th{padding:4px;border-bottom:1px solid #ddd;text-align:right}h2{margin:0 0 4px}</style>
      </head><body>
      <h2>فاتورة مبيعات</h2>
      <div>رقم: ${invoice.invoice_no}</div>
      <div>العميل: ${customerName}</div>
      <div>التاريخ: ${new Date().toLocaleString('ar-EG')}</div>
      <table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
      <h3>الإجمالي: ${formatCurrency(invoice.total)}</h3>
      <script>window.print()</script>
      </body></html>
    `);
    win.document.close();
  };

  // Create Invoice — stock deduction and journal-entry posting now happen
  // inside SalesService.createInvoice instead of here.
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invCustomer || !invWarehouse || invLines.some((l: any) => !l.item_id)) {
      error('يرجى التحقق من تحديد العميل ومخزن الصرف وتعبئة كافة البنود.');
      return;
    }

    if (vanSale) {
      if (!vanRepId) { error('اختر المندوب صاحب العهدة.'); return; }
      const over = invLines.find((l: any) => l.item_id && Number(l.qty) > vanBalanceOf(l.item_id));
      if (over) {
        const it = allItems.find((i: any) => i.id === over.item_id);
        error(`الكمية المطلوبة من «${it?.name || over.item_id}» تتجاوز رصيد عهدة المندوب (${vanBalanceOf(over.item_id)}).`);
        return;
      }
    }

    const totalPreview = calculateInvoiceTotal();
    if (!(await confirm({
      title: 'حفظ واعتماد الفاتورة؟',
      message: `الإجمالي ${formatCurrency(totalPreview)}. هيتصرف المخزون ${vanSale ? 'من عهدة المندوب' : 'من مخزن الصرف'} وتتسجّل الحركة المالية — مش هينفع تتراجع.`,
      confirmText: 'حفظ واعتماد',
    }))) return;

    try {
      const sub = calculateInvoiceSubtotal();
      const disc = Number(invDiscount) || 0;
      const tax = calculateInvoiceTax(sub);
      const total = calculateInvoiceTotal();
      const { lat, lng } = await captureCurrentLocation();

      const lines = invLines.map((line: any) => {
        const lQty = Number(line.qty) || 0;
        const lPrice = Number(line.unit_price) || 0;
        const lDisc = Number(line.discount) || 0;
        return {
          item_id: line.item_id,
          // overwritten by SalesService.createInvoice with the real invoice id
          invoice_id: '',
          qty: lQty,
          unit_price: lPrice,
          discount: lDisc,
          line_total: (lQty * lPrice) - lDisc
        };
      });

      const newInvoice = await createInvoice(
        {
          invoice_no: `PENDING-INV-${Date.now()}`,
          customer_id: invCustomer,
          date: new Date().toISOString().split('T')[0],
          payment_method: invPaymentMethod,
          subtotal: sub,
          discount: disc,
          tax,
          total,
          status: invPaymentMethod === 'cash' ? 'paid' : 'unpaid',
          lat,
          lng
        },
        lines,
        invWarehouse,
        vanSale && vanRepId ? { repUserId: vanRepId } : undefined
      );

      setInvDiscount('0');
      setInvLines([{ item_id: '', qty: 1, unit_price: 0, discount: 0 }]);
      if (vanSale && vanRepId) {
        ServiceFactory.getRepLedgerService().getRepStockBalances(vanRepId)
          .then((b) => setVanBalances(b.filter((x) => x.balance !== 0)));
      }
      success(vanSale ? 'تم حفظ فاتورة بيع ميداني وخصمها من عهدة المندوب!' : 'تم حفظ فاتورة المبيعات وصرف البضاعة بنجاح!');

      const customerName = customers.find((c) => c.id === invCustomer)?.name || '';
      printReceipt(newInvoice, lines, customerName);
    } catch (e) {
      error(getErrorMessage(e, 'فشل حفظ الفاتورة'));
    }
  };

  // Receipt Vouchers — invoice status update and journal-entry posting now
  // happen inside SalesService.createReceiptVoucher instead of here.
  const handleSaveReceiptVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vouchCustomer || !vouchAmount || !vouchAccountId) {
      error('اكتب العميل والمبلغ والحساب');
      return;
    }

    if (!(await confirm({
      title: 'تسجيل استلام الفلوس؟',
      message: `مبلغ ${formatCurrency(Number(vouchAmount))} هيتسجّل في الحساب وحساب العميل هيتعدّل — مش هينفع تتراجع.`,
      confirmText: 'تسجيل',
    }))) return;

    try {
      await createReceiptVoucher({
        voucher_no: `PENDING-REC-${Date.now()}`,
        customer_id: vouchCustomer,
        invoice_id: vouchInvoiceId || null,
        amount: Number(vouchAmount),
        date: new Date().toISOString().split('T')[0],
        account_id: vouchAccountId
      });

      setVouchAmount('0');
      setVouchInvoiceId('');
      success('تم حفظ سند القبض وتحديث حسابات العميل بنجاح!');
    } catch (err) {
      error(getErrorMessage(err, 'فشل حفظ سند القبض'));
    }
  };

  // Statement of Account Report — computed server-side by
  // SalesService.getCustomerStatement now instead of assembled here.
  const runCustomerStatement = async () => {
    if (!statementCustId) return;
    try {
      await loadStatement(statementCustId, statementStart, statementEnd);
    } catch (e) {
      error(getErrorMessage(e, 'فشل تحميل كشف الحساب'));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-7xl mx-auto"
      dir="rtl"
    >
      <PageHeader
        title="المبيعات والعملاء"
        subtitle="الفواتير والضريبة بتتحسب تلقائي، إيصالات استلام الفلوس، وكشف حساب العميل."
      />

      <Tabs
        active={activeSubTab}
        onChange={(k) => {
          setActiveSubTab(k as typeof activeSubTab);
          if (k === 'statement') runCustomerStatement();
        }}
        tabs={[
          { key: 'invoices', label: 'فاتورة مبيعات', icon: FileText },
          { key: 'vouchers', label: 'إيصال استلام فلوس', icon: Receipt },
          { key: 'customers', label: 'العملاء', icon: Users },
          { key: 'statement', label: 'كشف حساب عميل', icon: TrendingUp },
        ]}
      />

      {activeSubTab === 'customers' && <SalesCustomers />}

      {activeSubTab === 'invoices' && (
        <div className="space-y-6">
          <DocList
            rows={salesInvoices}
            columns={invoiceColumns}
            getId={(i) => i.id}
            search={(i, q) => (String(i.invoice_no) + ' ' + (customers.find((c) => c.id === i.customer_id)?.name || '')).toLowerCase().includes(q.toLowerCase())}
            emptyTitle="لسه مفيش فواتير"
            emptyHint="اعمل أول فاتورة من الفورم اللي تحت."
          />

          <form onSubmit={handleSaveInvoice} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white rounded-lg border shadow-sm p-4 sm:p-5">
                <h3 className="text-sm font-bold text-gray-800 border-b pb-2 mb-4">فاتورة مبيعات جديدة</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label="العميل" required>
                    <EntitySelect
                      options={customers.map((c) => ({ value: c.id, label: c.name, sub: c.phone || undefined }))}
                      value={invCustomer} onChange={setInvCustomer} placeholder="اختر العميل"
                    />
                  </FormField>
                  <FormField label="مخزن الصرف" required>
                    <EntitySelect
                      options={warehouses.map((w) => ({ value: w.id, label: w.name, sub: (w as any).kind ? enumLabel('warehouseKind', (w as any).kind) : undefined }))}
                      value={invWarehouse} onChange={setInvWarehouse} placeholder="اختر المخزن" disabled={vanSale}
                    />
                  </FormField>
                  <FormField label="طريقة السداد">
                    <select value={invPaymentMethod} onChange={(e) => setInvPaymentMethod(e.target.value as any)} className="w-full border rounded-lg py-2 px-3 text-sm bg-white">
                      <option value="cash">{enumLabel('paymentMethod', 'cash')} (فوري)</option>
                      <option value="credit">{enumLabel('paymentMethod', 'credit')}</option>
                      <option value="bank">{enumLabel('paymentMethod', 'bank')}</option>
                    </select>
                  </FormField>
                </div>

                <label className="flex items-center gap-2 text-sm font-bold text-indigo-800 cursor-pointer mt-4 bg-indigo-50 border border-indigo-200 p-3 rounded-lg">
                  <input type="checkbox" checked={vanSale} onChange={(e) => setVanSale(e.target.checked)} />
                  بيع من عهدة مندوب — الكمية تتخصم من عربية المندوب مش من المخزن
                </label>
                {vanSale && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="المندوب صاحب العهدة" required>
                      <EntitySelect
                        options={repUsers.map((u) => ({ value: u.id, label: u.name || u.email }))}
                        value={vanRepId} onChange={setVanRepId} placeholder="اختر المندوب"
                      />
                    </FormField>
                    <div className="text-xs text-gray-600 self-end pb-2">
                      {vanBalances.length === 0
                        ? 'مفيش بضاعة في عهدة المندوب ده دلوقتي.'
                        : <><span className="font-bold">رصيد العهدة:</span> {vanBalances.map((b) => <span key={b.item_id} className="inline-block mr-2">{itemNamesById[b.item_id] || b.item_id}: <span className="font-mono">{b.balance}</span></span>)}</>}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border shadow-sm p-4 sm:p-5">
                <div className="bg-gray-50 border border-dashed border-gray-300 p-3 rounded-lg mb-3">
                  <BarcodeScanInput items={items} onResolved={handleScannedItem} onNotFound={handleScanNotFound} />
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-700">بنود الفاتورة</span>
                  <button type="button" onClick={handleAddInvoiceLine} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> إضافة سطر
                  </button>
                </div>
                <div className="space-y-3">
                  {invLines.map((line, idx) => (
                    <div key={idx} className="border rounded-lg p-2 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_5rem_7rem_6rem_auto] gap-2 sm:items-center">
                        <EntitySelect
                          options={items.map((i) => ({ value: i.id, label: i.name }))}
                          value={line.item_id} onChange={(v) => handleLineChange(idx, 'item_id', v)} placeholder="اختر الصنف"
                        />
                        <NumberInput value={line.qty} onChange={(v) => handleLineChange(idx, 'qty', Number(v) || 0)} min={1} placeholder="كمية" />
                        <MoneyInput value={line.unit_price} onChange={(v) => handleLineChange(idx, 'unit_price', Number(v) || 0)} placeholder="سعر" />
                        {lineDiscountAllowed
                          ? <MoneyInput value={line.discount} onChange={(v) => handleLineChange(idx, 'discount', Number(v) || 0)} placeholder="خصم" />
                          : <div className="hidden sm:block" />}
                        <button type="button" onClick={() => handleRemoveInvoiceLine(idx)} className="text-red-500 hover:text-red-700 p-2 justify-self-start sm:justify-self-center">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {line.item_id && getPackagingBomFor(line.item_id).length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 pr-1">
                          <Boxes className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="font-bold">مكونات التعبئة للوحدة:</span>
                          {getPackagingBomFor(line.item_id).map((r) => (
                            <span key={r.id} className="bg-gray-100 rounded px-2 py-0.5">{itemNamesById[r.component_item_id] || '—'} × {r.quantity_or_percentage}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border shadow-sm p-4 sm:p-5 h-fit space-y-4">
              <h3 className="text-sm font-bold text-gray-800 border-b pb-2">ملخص الفاتورة</h3>
              <div className="flex justify-between text-sm text-gray-600">
                <span>المجموع قبل الخصم</span>
                <span className="font-mono font-bold">{formatCurrency(calculateInvoiceSubtotal())}</span>
              </div>
              <FormField label="خصم على إجمالي الفاتورة">
                <MoneyInput value={invDiscount === '' || invDiscount === '0' ? '' : Number(invDiscount)} onChange={(v) => setInvDiscount(v === '' ? '0' : String(v))} />
              </FormField>
              {vatEnabled && (
                <div className="flex justify-between text-sm text-gray-600 border-t pt-2">
                  <span>الضريبة ({vatPct}%)</span>
                  <span className="font-mono font-bold text-amber-600">{formatCurrency(calculateInvoiceTax(calculateInvoiceSubtotal()))}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 border-t pt-3">
                <span>الإجمالي</span>
                <span className="font-mono text-blue-600">{formatCurrency(calculateInvoiceTotal())}</span>
              </div>
              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition">
                حفظ واعتماد الفاتورة
              </button>
            </div>
          </form>
        </div>
      )}

      {activeSubTab === 'vouchers' && (
        <div className="space-y-6">
          <DocList
            rows={receiptVouchers}
            columns={[
              { key: 'no', label: 'رقم الإيصال', primary: true, render: (v: any) => String(v.voucher_no).startsWith('PENDING-') ? 'قيد الحفظ' : v.voucher_no },
              { key: 'customer', label: 'العميل', render: (v: any) => customers.find((c) => c.id === v.customer_id)?.name || '—' },
              { key: 'amount', label: 'المبلغ', render: (v: any) => <span className="font-mono text-green-700">{formatCurrency(Number(v.amount))}</span> },
              { key: 'account', label: 'دخل حساب', hideOnCard: true, render: (v: any) => accounts.find((a) => a.id === v.account_id)?.name || '—' },
              { key: 'date', label: 'التاريخ', hideOnCard: true, render: (v: any) => v.date ? formatDate(v.date) : '—' },
            ]}
            getId={(v: any) => v.id}
            search={(v: any, q) => (String(v.voucher_no) + ' ' + (customers.find((c) => c.id === v.customer_id)?.name || '')).toLowerCase().includes(q.toLowerCase())}
            emptyTitle="لسه مفيش إيصالات استلام فلوس"
            emptyHint="سجّل أول إيصال من الفورم اللي تحت."
          />

          <form onSubmit={handleSaveReceiptVoucher} className="bg-white rounded-lg border shadow-sm p-4 sm:p-5">
            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 mb-4">إيصال استلام فلوس جديد</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="العميل الدافع" required>
                <EntitySelect
                  options={customers.map((c) => ({ value: c.id, label: c.name, sub: c.phone || undefined }))}
                  value={vouchCustomer} onChange={setVouchCustomer} placeholder="اختر العميل"
                />
              </FormField>
              <FormField label="على فاتورة معيّنة (اختياري)">
                <select value={vouchInvoiceId} onChange={(e) => setVouchInvoiceId(e.target.value)} className="w-full border rounded-lg py-2 px-3 text-sm bg-white">
                  <option value="">— دفعة على الحساب العام —</option>
                  {salesInvoices.filter((i) => i.customer_id === vouchCustomer && i.status !== 'paid').map((i) => (
                    <option key={i.id} value={i.id}>{i.invoice_no} (الإجمالي {formatCurrency(Number(i.total))})</option>
                  ))}
                </select>
              </FormField>
              <FormField label="الفلوس دخلت فين (صندوق كاش أو بنك)" required>
                <EntitySelect
                  options={accounts.filter((a) => a.category === 'cash' || a.category === 'bank').map((a) => ({ value: a.id, label: a.name }))}
                  value={vouchAccountId} onChange={setVouchAccountId} placeholder="اختر الحساب"
                />
              </FormField>
              <FormField label="المبلغ المستلم" required>
                <MoneyInput value={vouchAmount === '' || vouchAmount === '0' ? '' : Number(vouchAmount)} onChange={(v) => setVouchAmount(v === '' ? '0' : String(v))} min={1} />
              </FormField>
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" className="py-2.5 px-6 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm transition">
                تسجيل استلام الفلوس
              </button>
            </div>
          </form>
        </div>
      )}

      {activeSubTab === 'statement' && (
        <div className="bg-white rounded-lg border shadow-sm p-4 sm:p-5">
          <h3 className="text-sm font-bold text-gray-800 border-b pb-2 mb-1">كشف حساب عميل</h3>
          <p className="text-xs text-gray-500 mb-4">كل حركات العميل والرصيد الجاري له.</p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5 bg-gray-50 p-3 rounded-lg border">
            <FormField label="العميل">
              <EntitySelect
                options={customers.map((c) => ({ value: c.id, label: c.name, sub: c.phone || undefined }))}
                value={statementCustId} onChange={setStatementCustId} placeholder="اختر العميل"
              />
            </FormField>
            <FormField label="من تاريخ">
              <input type="date" value={statementStart} onChange={(e) => setStatementStartDate(e.target.value)} className="w-full border rounded-lg py-2 px-3 text-sm text-left bg-white" />
            </FormField>
            <FormField label="إلى تاريخ">
              <input type="date" value={statementEnd} onChange={(e) => setStatementEndDate(e.target.value)} className="w-full border rounded-lg py-2 px-3 text-sm text-left bg-white" />
            </FormField>
            <div className="flex items-end">
              <button type="button" onClick={runCustomerStatement} className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition">
                عرض الكشف
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-right">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500">
                <tr>
                  <th className="py-2.5 px-3">التاريخ</th>
                  <th className="py-2.5 px-3">البيان</th>
                  <th className="py-2.5 px-3 text-center text-red-600">ليك (فاتورة)</th>
                  <th className="py-2.5 px-3 text-center text-green-600">عليك (سداد)</th>
                  <th className="py-2.5 px-3 text-center text-blue-600">الرصيد الجاري</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statementRecords.length > 0 ? statementRecords.map((rec, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/40">
                    <td className="py-2.5 px-3 text-gray-700">{formatDate(rec.date)}</td>
                    <td className="py-2.5 px-3 text-gray-600">{rec.description}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-red-600">{rec.debit > 0 ? formatCurrency(rec.debit) : '—'}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-green-600">{rec.credit > 0 ? formatCurrency(rec.credit) : '—'}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-600 bg-blue-50/40">{formatCurrency(rec.balance)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400 text-sm">اختر عميل واضغط «عرض الكشف».</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
};
