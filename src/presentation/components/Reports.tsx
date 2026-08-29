import React, { useState, useEffect } from 'react';
import { db } from '../../infrastructure/database/dexie';
import { getSetting } from '../../shared/utils/settings-helper';
import { ProductPerformanceReport } from './ProductPerformanceReport';
import { ServiceFactory } from '../../application/services/service-factory';
import { ExcelIOService } from '../../application/services/excel-io-service';
import {
  FileText,
  DollarSign,
  Percent,
  Activity,
  TrendingUp,
  Download
} from 'lucide-react';

export const Reports: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<'pnl' | 'aging' | 'inventory' | 'production' | 'performance' | 'cashflow'>('pnl');

  // Master lists
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [productionBatches, setProductionBatches] = useState<any[]>([]);
  const [laborOverheadPerUnit, setLaborOverheadPerUnit] = useState(0);
  const [customerAging, setCustomerAging] = useState<{ customer_id: string; name: string; bucket_0_30: number; bucket_31_60: number; bucket_61_90: number; bucket_90_plus: number; total: number }[]>([]);
  const [supplierAging, setSupplierAging] = useState<{ supplier_id: string; name: string; bucket_0_30: number; bucket_31_60: number; bucket_61_90: number; bucket_90_plus: number; total: number }[]>([]);
  // Real per-item unit cost (weighted-avg purchase price, then cost_price,
  // then null = "unknown"). Replaces the fabricated 40%/60%-of-retail guesses.
  const [costBasisByItem, setCostBasisByItem] = useState<Record<string, number | null>>({});

  // Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const listAccs = await db.accounts.toArray();
    const listTxs = await db.account_transactions.toArray();
    const listItems = await db.items.toArray();
    const listMovs = await db.stock_movements.toArray();
    const listBatches = await db.production_batches.toArray();
    const overheadPerUnit = Number(await getSetting('labor_overhead_per_unit', '0')) || 0;

    setAccounts(listAccs);
    setTransactions(listTxs);
    setItems(listItems);
    setStockMovements(listMovs);
    setProductionBatches(listBatches);
    setLaborOverheadPerUnit(overheadPerUnit);

    // Real date-based aging (was previously a fixed %-split estimate, not
    // actually based on invoice age at all) — for both AR and AP.
    const [arAging, apAging] = await Promise.all([
      ServiceFactory.getSalesService().getCustomerAgingReport(),
      ServiceFactory.getPurchaseService().getSupplierAgingReport()
    ]);
    setCustomerAging(arAging);
    setSupplierAging(apAging);

    // Real unit cost per item (weighted-avg purchase price / cost_price / null).
    const analytics = ServiceFactory.getAnalyticsService();
    const basis: Record<string, number | null> = {};
    for (const it of listItems) basis[it.id] = await analytics.getItemCostBasis(it.id);
    setCostBasisByItem(basis);
  };

  const handleExportAging = () => {
    ExcelIOService.exportToCsv('customer_aging_report', customerAging.map((c) => ({
      العميل: c.name,
      'الإجمالي المستحق': c.total,
      '0-30 يوم': c.bucket_0_30,
      '31-60 يوم': c.bucket_31_60,
      '61-90 يوم': c.bucket_61_90,
      'أكثر من 90 يوم': c.bucket_90_plus
    })));
  };

  // Filter transactions by date
  const getFilteredTransactions = () => {
    let filtered = [...transactions];
    if (startDate) {
      filtered = filtered.filter(tx => tx.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(tx => tx.date <= endDate);
    }
    return filtered;
  };

  // 1. Profit & Loss calculations
  const calculateCategoryBalance = (category: string) => {
    const txs = getFilteredTransactions();
    const targetAccounts = accounts.filter(a => a.category === category).map(a => a.id);
    return txs
      .filter(tx => targetAccounts.includes(tx.account_id))
      .reduce((sum, tx) => sum + Number(tx.debit) - Number(tx.credit), 0);
  };

  const getPnlRevenue = () => {
    // Revenues increase with Credit
    const targetAccounts = accounts.filter(a => a.category === 'revenue').map(a => a.id);
    const txs = getFilteredTransactions();
    return txs
      .filter(tx => targetAccounts.includes(tx.account_id))
      .reduce((sum, tx) => sum + Number(tx.credit) - Number(tx.debit), 0);
  };

  // Cost of goods sold, estimated from the quantities that left as sales
  // (sale_out / rep-issue is not a sale) valued at each item's real unit
  // cost. Replaces reading a 'cogs' account that is no longer posted to at
  // purchase time (purchases now debit 'inventory').
  const getPnlCOGS = () => {
    return stockMovements
      .filter((m) => m.movement_type === 'sale_out')
      .filter((m) => {
        const d = (m.moved_at || '').slice(0, 10);
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      })
      .reduce((sum, m) => sum + Math.abs(Number(m.qty)) * (costBasisByItem[m.item_id] ?? 0), 0);
  };

  const getPnlExpenses = () => {
    return calculateCategoryBalance('expense');
  };

  const rev = getPnlRevenue();
  const cogs = getPnlCOGS();
  const exp = getPnlExpenses();
  const grossProfit = rev - cogs;
  const netProfit = grossProfit - exp;

  // Supplier (AP) aging — now real invoice-age buckets from
  // PurchaseService.getSupplierAgingReport (loaded into supplierAging),
  // mapped to this table's 1-30 / 31-90 / 90+ columns.
  const getSuppliersAging = () => supplierAging.map((s) => ({
    id: s.supplier_id,
    name: s.name,
    outstanding: s.total,
    aging_0_30: s.bucket_0_30,
    aging_31_90: s.bucket_31_60 + s.bucket_61_90,
    aging_90_plus: s.bucket_90_plus
  }));

  // 3. Inventory Valuation
  const calculateStock = (itemId: string) => {
    return stockMovements
      .filter(m => m.item_id === itemId)
      .reduce((sum, m) => sum + Number(m.qty), 0);
  };

  // 4. Production Costing Report
  const getProductionCostHistory = () => {
    return productionBatches.filter(b => b.status === 'completed').map(b => {
      const item = items.find(i => i.id === b.item_id);
      const actualQty = Number(b.actual_qty) || Number(b.planned_qty) || 1;

      // Real material cost: produced quantity valued at the finished item's
      // unit cost basis (weighted-avg purchase / cost_price). 0 when unknown.
      const matCost = actualQty * (costBasisByItem[b.item_id] ?? 0);
      const laborOverhead = actualQty * laborOverheadPerUnit;
      const totalCost = matCost + laborOverhead;

      return {
        ...b,
        item_name: item?.name || '',
        item_type: item?.type || '',
        total_cost: totalCost,
        cost_per_unit: totalCost / actualQty
      };
    });
  };

  const typesArabic: { [key: string]: string } = {
    raw_material: 'مادة خام كيميائية',
    packaging: 'مواد تعبئة وتغليف',
    intermediate: 'منتج وسيط (سائل صمغ)',
    finished_good: 'منتج نهائي تام الصنع'
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقارير المالية والتحليلية / Reports</h1>
          <p className="text-gray-500 text-sm mt-1">عرض ومراقبة الحسابات الختامية وأعمار الديون والإنتاج والمخزون وحركة السيولة</p>
        </div>
      </div>

      {/* Date Filters Header */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 flex flex-col md:flex-row gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">من تاريخ</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-gray-300 py-1.5 px-3 text-sm text-left bg-gray-50 focus:bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">إلى تاريخ</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-gray-300 py-1.5 px-3 text-sm text-left bg-gray-50 focus:bg-white"
          />
        </div>
        <button
          onClick={loadData}
          className="py-1.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition"
        >
          تطبيق فلاتر التاريخ
        </button>
      </div>

      {/* Navigation sub-tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-lg p-1 shadow-sm">
        <button
          onClick={() => setActiveTab('pnl')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeTab === 'pnl' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>قائمة الأرباح والخسائر (P&L)</span>
        </button>
        <button
          onClick={() => setActiveTab('aging')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeTab === 'aging' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Percent className="h-4 w-4" />
          <span>أعمار الديون (عملاء / موردين)</span>
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeTab === 'inventory' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          <span>تقييم وحركة المخزون الحالي</span>
        </button>
        <button
          onClick={() => setActiveTab('production')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeTab === 'production' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>تكلفة إنتاج دفعات الصمغ والعلب</span>
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeTab === 'performance' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>أداء المنتجات والأكثر مبيعاً</span>
        </button>
      </div>

      {/* Report Content */}
      <div className="bg-white shadow rounded-lg p-6">
        {activeTab === 'performance' && <ProductPerformanceReport />}
        {activeTab === 'pnl' && (
          <div className="space-y-6">
            <div className="border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800">قائمة الأرباح والخسائر الختامية (Profit & Loss Statement)</h3>
              <p className="text-xs text-gray-500 mt-1">توضح مجمل وصافي الربح للمنشأة بعد خصم المبيعات من تكاليف المواد والمصروفات الإدارية والتشغيلية</p>
            </div>

            <div className="space-y-4 max-w-2xl text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="font-bold text-gray-700">إجمالي المبيعات والإيرادات:</span>
                <span className="font-mono text-base font-extrabold text-green-600">+{rev.toFixed(2)} ج.م</span>
              </div>

              <div className="flex justify-between border-b pb-2">
                <span className="font-bold text-gray-700">تكلفة البضاعة المباعة (المواد الخام):</span>
                <span className="font-mono text-base font-extrabold text-red-600">-{cogs.toFixed(2)} ج.م</span>
              </div>

              <div className="flex justify-between border-b pb-2 bg-gray-50 p-2.5 rounded font-black text-gray-800">
                <span>مجمل الربح التجاري (Gross Profit):</span>
                <span className="font-mono text-lg">{grossProfit.toFixed(2)} ج.م</span>
              </div>

              <div className="flex justify-between border-b pb-2">
                <span className="font-bold text-gray-700">المصروفات التشغيلية والرواتب:</span>
                <span className="font-mono text-base font-extrabold text-red-600">-{exp.toFixed(2)} ج.م</span>
              </div>

              <div className="flex justify-between border-b pb-2 bg-blue-50 p-4 rounded-lg font-black text-blue-900 text-lg">
                <span>صافي الأرباح والخسائر (Net Profit):</span>
                <span className="font-mono text-xl">{netProfit.toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'aging' && (
          <div className="space-y-8">
            {/* Customer aging */}
            <div>
              <div className="border-b pb-3 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">أعمار ديون العملاء المدينين (دائنون / مدينون)</h3>
                  <p className="text-xs text-gray-500 mt-1">محسوبة فعلياً من تاريخ كل فاتورة غير مسددة، وليست تقديراً</p>
                </div>
                <button onClick={handleExportAging} disabled={customerAging.length === 0} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 disabled:opacity-50">
                  <Download className="h-3.5 w-3.5" /> تصدير Excel
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-right text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-xs font-bold text-gray-500">
                      <th className="py-3 px-4">اسم العميل</th>
                      <th className="py-3 px-4 text-center">المستحق الإجمالي</th>
                      <th className="py-3 px-4 text-center text-green-600">0 - 30 يوم</th>
                      <th className="py-3 px-4 text-center text-yellow-600">31 - 60 يوم</th>
                      <th className="py-3 px-4 text-center text-orange-600">61 - 90 يوم</th>
                      <th className="py-3 px-4 text-center text-red-600">أكثر من 90 يوم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {customerAging.map(c => (
                      <tr key={c.customer_id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-bold text-gray-800">{c.name}</td>
                        <td className="py-3 px-4 text-center font-bold text-gray-900 font-mono">{c.total.toFixed(2)} ج.م</td>
                        <td className="py-3 px-4 text-center text-gray-600 font-mono">{c.bucket_0_30.toFixed(2)} ج.م</td>
                        <td className="py-3 px-4 text-center text-gray-600 font-mono">{c.bucket_31_60.toFixed(2)} ج.م</td>
                        <td className="py-3 px-4 text-center text-gray-600 font-mono">{c.bucket_61_90.toFixed(2)} ج.م</td>
                        <td className="py-3 px-4 text-center text-gray-600 font-mono">{c.bucket_90_plus.toFixed(2)} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Supplier aging */}
            <div>
              <div className="border-b pb-3 mb-4">
                <h3 className="text-lg font-bold text-gray-800">أعمار ديون الموردين الدائنين</h3>
                <p className="text-xs text-gray-500 mt-1">تتبع الفواتير والذمم المستحقة علينا لصالح الموردين</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-right text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-xs font-bold text-gray-500">
                      <th className="py-3 px-4">اسم المورد</th>
                      <th className="py-3 px-4 text-center">الدين الإجمالي</th>
                      <th className="py-3 px-4 text-center text-green-600">1 - 30 يوم</th>
                      <th className="py-3 px-4 text-center text-yellow-600">31 - 90 يوم</th>
                      <th className="py-3 px-4 text-center text-red-600">أكثر من 90 يوم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {getSuppliersAging().map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-bold text-gray-800">{s.name}</td>
                        <td className="py-3 px-4 text-center font-bold text-red-600 font-mono">{s.outstanding.toFixed(2)} ج.م</td>
                        <td className="py-3 px-4 text-center text-gray-600 font-mono">{s.aging_0_30.toFixed(2)} ج.م</td>
                        <td className="py-3 px-4 text-center text-gray-600 font-mono">{s.aging_31_90.toFixed(2)} ج.م</td>
                        <td className="py-3 px-4 text-center text-gray-600 font-mono">{s.aging_90_plus.toFixed(2)} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800">تقييم المستودعات والمخازن (Inventory Valuation)</h3>
              <p className="text-xs text-gray-500 mt-1">توضيح كميات البضاعة المتوافرة حالياً وقيمتها المالية الإجمالية</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">اسم الصنف</th>
                    <th className="py-3 px-4">نوع الصنف</th>
                    <th className="py-3 px-4 text-center">الرصيد المتوافر</th>
                    <th className="py-3 px-4 text-center">تكلفة الوحدة التقريبية</th>
                    <th className="py-3 px-4 text-center">القيمة الإجمالية للمخزون</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(item => {
                    const stock = calculateStock(item.id);
                    const cost = costBasisByItem[item.id];
                    const totalVal = cost != null ? stock * cost : null;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-bold text-gray-800">{item.name}</td>
                        <td className="py-3 px-4 text-gray-600">{typesArabic[item.type]}</td>
                        <td className="py-3 px-4 text-center font-bold font-mono">{stock}</td>
                        <td className="py-3 px-4 text-center font-mono">
                          {cost != null ? `${cost.toFixed(2)} ج.م` : <span className="text-amber-600 text-xs">غير محددة</span>}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-blue-600 font-mono">
                          {totalVal != null ? `${totalVal.toFixed(2)} ج.م` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'production' && (
          <div className="space-y-6">
            <div className="border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800">تقرير تكلفة الإنتاج التاريخية للتشغيلات (Production Cost Report)</h3>
              <p className="text-xs text-gray-500 mt-1">عرض تكاليف الدفعات المنجزة من الغراء السائل والعبوات المعبأة للتسويق</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">رقم الدفعة (Batch No)</th>
                    <th className="py-3 px-4">اسم المنتج</th>
                    <th className="py-3 px-4">نوع المنتج</th>
                    <th className="py-3 px-4 text-center">الكمية الفعلية المنتجة</th>
                    <th className="py-3 px-4 text-center">إجمالي تكاليف المواد الخام</th>
                    <th className="py-3 px-4 text-center text-blue-600">تكلفة إنتاج الوحدة الواحدة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getProductionCostHistory().map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono font-bold text-gray-800">{b.batch_no}</td>
                      <td className="py-3 px-4 font-semibold text-gray-700">{b.item_name}</td>
                      <td className="py-3 px-4 text-gray-600">{typesArabic[b.item_type] || b.item_type}</td>
                      <td className="py-3 px-4 text-center font-bold font-mono">{b.actual_qty}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-gray-900">{b.total_cost.toFixed(2)} ج.م</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-blue-600 bg-blue-50/50">{b.cost_per_unit.toFixed(2)} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
