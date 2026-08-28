import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../../infrastructure/database/dexie';
import { ServiceFactory } from '../../application/services/service-factory';
import { formatCurrency } from '../../shared/utils/format';
import type { ProductPerformance } from '../../application/services/analytics-service';

// Best/least-selling, profit margin, and quantity-sold-by-production-line —
// derived live from sales_invoice_lines, never cached, per the item
// commercial fields (selling price via items.default_price, discount_percent,
// cost_price, production_line_id) added alongside this report.
export const ProductPerformanceReport: React.FC = () => {
  const analyticsService = ServiceFactory.getAnalyticsService();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [performance, setPerformance] = useState<ProductPerformance[]>([]);
  const [byLine, setByLine] = useState<{ production_line_id: string | null; qty: number; revenue: number }[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [perf, lineAgg, prodLines] = await Promise.all([
        analyticsService.getProductPerformance(startDate, endDate),
        analyticsService.getQtySoldByLine(startDate, endDate),
        db.production_lines.toArray()
      ]);
      setPerformance(perf);
      setByLine(lineAgg);
      setLines(prodLines);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, analyticsService]);

  useEffect(() => { load(); }, [load]);

  const lineName = (id: string | null) => (id ? lines.find((l) => l.id === id)?.name || id : 'غير محدد');
  const bestSelling = [...performance].sort((a, b) => b.qty_sold - a.qty_sold).slice(0, 5);
  const leastSelling = [...performance].sort((a, b) => a.qty_sold - b.qty_sold).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded p-2 text-sm" />
        <span className="text-gray-400">إلى</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded p-2 text-sm" />
        {loading && <span className="text-xs text-gray-400">جاري التحميل...</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h4 className="font-bold text-gray-800 mb-3">الأكثر مبيعاً</h4>
          {bestSelling.length === 0 ? <p className="text-xs text-gray-400">لا توجد بيانات</p> : (
            <table className="min-w-full text-sm">
              <tbody>
                {bestSelling.map((p) => (
                  <tr key={p.item_id} className="border-t">
                    <td className="py-1">{p.name}</td>
                    <td className="py-1 text-left font-mono">{p.qty_sold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="border rounded-lg p-4">
          <h4 className="font-bold text-gray-800 mb-3">الأقل مبيعاً</h4>
          {leastSelling.length === 0 ? <p className="text-xs text-gray-400">لا توجد بيانات</p> : (
            <table className="min-w-full text-sm">
              <tbody>
                {leastSelling.map((p) => (
                  <tr key={p.item_id} className="border-t">
                    <td className="py-1">{p.name}</td>
                    <td className="py-1 text-left font-mono">{p.qty_sold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-bold text-gray-800 mb-3">هامش الربح لكل منتج</h4>
        {performance.length === 0 ? <p className="text-xs text-gray-400">لا توجد بيانات مبيعات في هذه الفترة</p> : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 text-right">
                <th className="py-2">المنتج</th>
                <th className="py-2">الكمية المباعة</th>
                <th className="py-2">الإيراد</th>
                <th className="py-2">التكلفة</th>
                <th className="py-2">الربح</th>
                <th className="py-2">هامش الربح %</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((p) => (
                <tr key={p.item_id} className="border-t">
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 font-mono">{p.qty_sold}</td>
                  <td className="py-2 font-mono">{formatCurrency(p.revenue)}</td>
                  <td className="py-2 font-mono">{formatCurrency(p.cost)}</td>
                  <td className={`py-2 font-mono ${p.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(p.profit)}</td>
                  <td className="py-2 font-mono">{p.profit_margin_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-bold text-gray-800 mb-3">الكمية المباعة حسب خط الإنتاج</h4>
        {byLine.length === 0 ? <p className="text-xs text-gray-400">لا توجد بيانات</p> : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 text-right">
                <th className="py-2">خط الإنتاج</th>
                <th className="py-2">الكمية</th>
                <th className="py-2">الإيراد</th>
              </tr>
            </thead>
            <tbody>
              {byLine.map((l) => (
                <tr key={l.production_line_id || 'none'} className="border-t">
                  <td className="py-2">{lineName(l.production_line_id)}</td>
                  <td className="py-2 font-mono">{l.qty}</td>
                  <td className="py-2 font-mono">{formatCurrency(l.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
