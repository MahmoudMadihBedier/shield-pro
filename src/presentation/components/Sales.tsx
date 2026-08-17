import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { getSetting, getSettingBool } from '../../shared/utils/settings-helper';
import { formatCurrency, formatDate } from '../../shared/utils/format';
import { getErrorMessage } from '../../shared/utils/errors';
import { useCustomers, useSalesInvoices, useReceiptVouchers, useCustomerStatement } from '../../application/hooks/use-sales';
import { useAccounts } from '../../application/hooks/use-accounting';
import { useInventory } from '../../application/hooks/use-inventory';
import { useRecipes } from '../../application/hooks/use-manufacturing';
import { Warehouse } from '../../core/domain/entities';
import { PaginationParams, EntityFilter } from '../../core/types';
import { BarcodeScanInput, type ScannableItem } from './BarcodeScanInput';
import { useToast } from './ui/Toast';
import { FormField } from './ui/ValidationMessage';
import { CardAnimation, TabContentAnimation } from './ui/animations/CardAnimation';
import {
  Users,
  Plus,
  Trash2,
  FileText,
  Receipt,
  TrendingUp,
  Boxes,
  Share2,
  Copy,
  Check,
  MessageCircle
} from 'lucide-react';

// Stable references (not recreated per render) so the data hooks below don't
// re-fetch in a loop — their internal useCallback/useEffect deps include
// these filter/params objects by identity.
const UNPAGINATED: PaginationParams = { page: 1, limit: 100000 };
const PACKAGING_RECIPE_FILTER: EntityFilter = { recipe_type: 'packaging' };

export const Sales: React.FC = () => {
  const { success, error, warning } = useToast();

  // Tabs
  const [activeSubTab, setActiveSubTab] = useState<'customers' | 'invoices' | 'vouchers' | 'statement'>('invoices');
  
  // Client ID sharing state
  const [copiedClientId, setCopiedClientId] = useState<string | null>(null);

  // Data, sourced from the service/hook layer instead of Dexie directly.
  const { customers: customersResult, createCustomer } = useCustomers();
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

  // 1. Customer State
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custOpening, setCustOpening] = useState('0');
  const [createdCustomerWithCrm, setCreatedCustomerWithCrm] = useState<any>(null);

  // 2. Invoice State
  const [invCustomer, setInvCustomer] = useState('');
  const [invWarehouse, setInvWarehouse] = useState('');
  const [invPaymentMethod, setInvPaymentMethod] = useState<'cash' | 'credit' | 'bank'>('cash');
  const [invLines, setInvLines] = useState<any[]>([{ item_id: '', qty: 1, unit_price: 0, discount: 0 }]);
  const [invDiscount, setInvDiscount] = useState('0'); // invoice level discount

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

  // Add Customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) {
      error('يرجى إدخال اسم العميل');
      return;
    }

    try {
      const result = await createCustomer({
        name: custName.trim(),
        email: custEmail.trim() || undefined,
        phone: custPhone.trim() || undefined,
        address: custAddress.trim() || undefined,
        opening_balance: Number(custOpening)
      });
      
      setCustName('');
      setCustEmail('');
      setCustPhone('');
      setCustAddress('');
      setCustOpening('0');
      
      // Show the customer with CRM credentials
      setCreatedCustomerWithCrm(result);
      
      // Show success message
      if (result && result.client_id) {
        success(`تم تسجيل العميل بنجاح! معرف العميل: ${result.client_id}`);
      } else {
        success('تم تسجيل العميل بنجاح!');
      }
    } catch (e) {
      error(getErrorMessage(e, 'فشل تسجيل العميل'));
    }
  };

  // Copy client ID to clipboard
  const copyClientId = (clientId: string) => {
    navigator.clipboard.writeText(clientId);
    setCopiedClientId(clientId);
    setTimeout(() => setCopiedClientId(null), 2000);
    success('تم نسخ معرف العميل');
  };

  // Share client ID on WhatsApp
  const shareClientIdOnWhatsApp = (clientId: string, customerName: string) => {
    const message = `مرحباً ${customerName}،\n\nتم إنشاء حسابك في بوابة العملاء بنجاح!\n\n🔐 معرف العميل (Client ID): ${clientId}\n\nاستخدم هذا المعرف فقط لتسجيل الدخول إلى بوابة العملاء. لا حاجة لكلمة مرور.\n\nيمكنك الدخول من خلال الرابط: ${window.location.origin}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
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

  // Create Invoice — stock deduction and journal-entry posting now happen
  // inside SalesService.createInvoice instead of here.
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invCustomer || !invWarehouse || invLines.some((l: any) => !l.item_id)) {
      error('يرجى التحقق من تحديد العميل ومخزن الصرف وتعبئة كافة البنود.');
      return;
    }

    try {
      const sub = calculateInvoiceSubtotal();
      const disc = Number(invDiscount) || 0;
      const tax = calculateInvoiceTax(sub);
      const total = calculateInvoiceTotal();

      await createInvoice(
        {
          invoice_no: `PENDING-INV-${Date.now()}`,
          customer_id: invCustomer,
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
        }),
        invWarehouse
      );

      setInvDiscount('0');
      setInvLines([{ item_id: '', qty: 1, unit_price: 0, discount: 0 }]);
      success('تم حفظ فاتورة المبيعات وصرف البضاعة بنجاح!');
    } catch (e) {
      error(getErrorMessage(e, 'فشل حفظ الفاتورة'));
    }
  };

  // Receipt Vouchers — invoice status update and journal-entry posting now
  // happen inside SalesService.createReceiptVoucher instead of here.
  const handleSaveReceiptVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vouchCustomer || !vouchAmount || !vouchAccountId) {
      error('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }

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
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المبيعات والعملاء والسندات / Sales</h1>
          <p className="text-gray-500 text-sm mt-1">إنشاء الفواتير والضرائب تلقائياً، مرتجع مبيعات، سند قبض، كشف حساب جاري</p>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-lg p-1 shadow-sm flex-wrap">
        <motion.button
          onClick={() => setActiveSubTab('invoices')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'invoices' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>فاتورة مبيعات جديدة</span>
        </motion.button>
        <motion.button
          onClick={() => setActiveSubTab('vouchers')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'vouchers' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>سند قبض مالي (سند قبض)</span>
        </motion.button>
        <motion.button
          onClick={() => setActiveSubTab('customers')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'customers' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>قائمة وملفات العملاء</span>
        </motion.button>

        <motion.button
          onClick={() => {
            setActiveSubTab('statement');
            runCustomerStatement();
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'statement' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>كشف حساب عميل تفصيلي</span>
        </motion.button>
      </div>

      {activeSubTab === 'customers' && (
        <TabContentAnimation>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Customer Add Form */}
            <CardAnimation delay={0.1}>
              <div className="bg-white p-5 rounded-lg border shadow h-fit">
                <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  ملف عميل جديد
                </h3>
                <form onSubmit={handleAddCustomer} className="space-y-4">
                  <FormField
                    label="اسم العميل / الشركة"
                    required
                    helpText="الاسم الظاهر في الفواتير والتقارير"
                  >
                    <input
                      type="text"
                      required
                      placeholder="شركة الوفاق لصيانة الإطارات"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField
                    label="البريد الإلكتروني"
                    helpText="للحفظ التواصل فقط (المصادقة بواسطة client_id)"
                  >
                    <input
                      type="email"
                      placeholder="client@example.com"
                      value={custEmail}
                      onChange={(e) => setCustEmail(e.target.value)}
                      className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField
                    label="رقم الهاتف"
                    helpText="للتواصل والمراسلات"
                  >
                    <input
                      type="text"
                      placeholder="0512345678"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField
                    label="العنوان"
                    helpText="عنوان الفاتورة والتوصيل"
                  >
                    <input
                      type="text"
                      placeholder="القاهرة، مدينة نصر"
                      value={custAddress}
                      onChange={(e) => setCustAddress(e.target.value)}
                      className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField
                    label="الرصيد الافتتاحي (مدين ج.م)"
                    helpText="الرصيد الافتتاحي للعميل عند التسجيل"
                  >
                    <input
                      type="number"
                      value={custOpening}
                      onChange={(e) => setCustOpening(e.target.value)}
                      className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </FormField>

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex justify-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition shadow-md"
                  >
                    حفظ العميل
                  </motion.button>
                </form>

                {/* Client ID Display */}
                {createdCustomerWithCrm && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Check className="h-5 w-5 text-green-600" />
                      <span className="font-bold text-green-800">تم إنشاء العميل بنجاح!</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">معرف العميل (Client ID)</label>
                        <div className="flex items-center gap-2">
                          <code className="bg-green-100 text-green-800 px-3 py-2 rounded text-sm font-mono flex-1">
                            {createdCustomerWithCrm.client_id}
                          </code>
                          <motion.button
                            onClick={() => copyClientId(createdCustomerWithCrm.client_id)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="text-gray-400 hover:text-gray-600 p-2"
                            title="نسخ"
                          >
                            {copiedClientId === createdCustomerWithCrm.client_id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                          </motion.button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <motion.button
                        onClick={() => shareClientIdOnWhatsApp(createdCustomerWithCrm.client_id, createdCustomerWithCrm.name)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-xs transition shadow-md"
                      >
                        <MessageCircle className="h-4 w-4" />
                        مشاركة معرف العميل
                      </motion.button>
                      
                      <motion.button
                        onClick={() => setCreatedCustomerWithCrm(null)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-bold text-xs transition"
                      >
                        إغلاق
                      </motion.button>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-3">
                      <p className="text-xs text-blue-800">
                        <strong>ملاحظة:</strong> يرجى مشاركة معرف العميل مع العميل. العميل سيستخدم هذا المعرف فقط لتسجيل الدخول إلى بوابة العملاء. لا حاجة لكلمة مرور.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardAnimation>

          {/* Customers List */}
          <CardAnimation delay={0.2} className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              العملاء المسجلين
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{customers.length}</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">الاسم</th>
                    <th className="py-3 px-4">معرف العميل</th>
                    <th className="py-3 px-4">الهاتف</th>
                    <th className="py-3 px-4">العنوان</th>
                    <th className="py-3 px-4 text-center">الرصيد الجاري</th>
                    <th className="py-3 px-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {customers.map((c, index) => (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
                      className="hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-bold text-gray-800">{c.name}</td>
                      <td className="py-3 px-4">
                        {c.client_id ? (
                          <div className="flex items-center gap-2">
                            <code className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">
                              {c.client_id}
                            </code>
                            <div className="flex gap-1">
                              <motion.button
                                onClick={() => copyClientId(c.client_id!)}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="text-gray-400 hover:text-gray-600 p-1"
                                title="نسخ"
                              >
                                {copiedClientId === c.client_id ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                              </motion.button>
                              <motion.button
                                onClick={() => shareClientIdOnWhatsApp(c.client_id!, c.name)}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="text-gray-400 hover:text-green-600 p-1"
                                title="مشاركة على واتساب"
                              >
                                <Share2 className="h-3 w-3" />
                              </motion.button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">غير متوفر</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{c.phone || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">{c.address || '-'}</td>
                      <td className="py-3 px-4 text-center font-bold text-blue-600 font-mono">
                        {formatCurrency(
                          Number(c.opening_balance) +
                          salesInvoices.filter((i) => i.customer_id === c.id).reduce((sum, i) => sum + Number(i.total), 0) -
                          receiptVouchers.filter((v) => v.customer_id === c.id).reduce((sum, v) => sum + Number(v.amount), 0)
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="تفاصيل العميل"
                        >
                          <FileText className="h-4 w-4" />
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardAnimation>
        </div>
        </TabContentAnimation>
      )}

      {activeSubTab === 'invoices' && (
        <TabContentAnimation>
          <form onSubmit={handleSaveInvoice} className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Invoice Lines Table */}
            <CardAnimation delay={0.1} className="lg:col-span-3 bg-white p-6 rounded-lg border shadow">
              <h3 className="text-lg font-bold text-gray-800 border-b pb-3 mb-6 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                تحرير فاتورة مبيعات جديدة
              </h3>

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
                    <option key={c.id} value={c.id}>
                      {c.name} {c.client_id ? `(${c.client_id})` : ''}
                    </option>
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
              <div className="bg-gray-50 border border-dashed border-gray-300 p-3 rounded">
                <BarcodeScanInput items={items} onResolved={handleScannedItem} onNotFound={handleScanNotFound} />
              </div>

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
                <div key={idx} className="space-y-1.5">
                <div className="flex gap-4 items-center">
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
                  {line.item_id && getPackagingBomFor(line.item_id).length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 pr-1">
                      <Boxes className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="font-bold">مكونات التعبئة لكل وحدة:</span>
                      {getPackagingBomFor(line.item_id).map((r) => (
                        <span key={r.id} className="bg-gray-100 rounded px-2 py-0.5">
                          {itemNamesById[r.component_item_id] || '—'} × {r.quantity_or_percentage}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardAnimation>

          {/* Invoice Summary and Submit */}
          <CardAnimation delay={0.2} className="bg-white p-5 rounded-lg border shadow h-fit space-y-6">
            <h3 className="font-bold text-gray-800 border-b pb-2">ملخص الحساب والفاتورة</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>المجموع الفرعي:</span>
                <span className="font-mono font-bold">{formatCurrency(calculateInvoiceSubtotal())}</span>
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
                  <span className="font-mono font-bold text-yellow-600">{formatCurrency(calculateInvoiceTax(calculateInvoiceSubtotal()))}</span>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold text-gray-900 border-t pt-3">
                <span>المجموع النهائي:</span>
                <span className="font-mono text-blue-600">{formatCurrency(calculateInvoiceTotal())}</span>
              </div>
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex justify-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold text-sm transition shadow-md"
            >
              حفظ واعتماد الفاتورة (Save)
            </motion.button>
          </CardAnimation>
          </form>
        </TabContentAnimation>
      )}

      {activeSubTab === 'vouchers' && (
        <TabContentAnimation>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create receipt voucher */}
            <CardAnimation delay={0.1} className="bg-white p-5 rounded-lg border shadow h-fit">
              <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                إنشاء سند قبض مالي جديد
              </h3>
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
                    <option key={c.id} value={c.id}>
                      {c.name} {c.client_id ? `(${c.client_id})` : ''}
                    </option>
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
                    .filter((i) => i.customer_id === vouchCustomer && i.status !== 'paid')
                    .map((i) => (
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
                  {accounts.filter((a) => a.category === 'cash' || a.category === 'bank').map((a) => (
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

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex justify-center py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-xs transition shadow-md"
              >
                توليد واعتماد سند القبض
              </motion.button>
            </form>
          </CardAnimation>

          {/* Receipt Vouchers List */}
          <CardAnimation delay={0.2} className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-green-600" />
              سجل السندات المالية الصادرة
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">{receiptVouchers.length}</span>
            </h3>
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
                  {receiptVouchers.map((v, index) => {
                    const cName = customers.find(c => c.id === v.customer_id)?.name || '';
                    const accName = accounts.find(a => a.id === v.account_id)?.name || '';
                    return (
                      <motion.tr
                        key={v.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
                        className="hover:bg-green-50 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 font-bold text-gray-800">{v.voucher_no}</td>
                        <td className="py-3 px-4 text-gray-700">{cName}</td>
                        <td className="py-3 px-4 text-center font-bold text-green-600 font-mono">{formatCurrency(v.amount)}</td>
                        <td className="py-3 px-4 text-gray-600">{accName}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{v.date ? formatDate(v.date) : '-'}</td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardAnimation>
        </div>
        </TabContentAnimation>
      )}

      {activeSubTab === 'statement' && (
        <TabContentAnimation>
          <CardAnimation className="bg-white p-6 rounded-lg border shadow">
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
                  <option key={c.id} value={c.id}>
                    {c.name} {c.client_id ? `(${c.client_id})` : ''}
                  </option>
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
                    <motion.tr
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.05, ease: 'easeOut' }}
                      className="hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 text-gray-700">{formatDate(rec.date)}</td>
                      <td className="py-3 px-4 font-semibold text-gray-600">{rec.description}</td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-red-600">{rec.debit > 0 ? `+${rec.debit.toFixed(2)}` : '-'}</td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-green-600">{rec.credit > 0 ? `-${rec.credit.toFixed(2)}` : '-'}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-blue-600 bg-blue-50/50">{formatCurrency(rec.balance)}</td>
                    </motion.tr>
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
        </CardAnimation>
        </TabContentAnimation>
      )}
    </motion.div>
  );
};
