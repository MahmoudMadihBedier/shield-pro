import { RepositoryFactory } from '../../infrastructure/database/repository-factory';

export interface ProductPerformance {
  item_id: string;
  name: string;
  qty_sold: number;
  revenue: number;
  cost: number;
  profit: number;
  profit_margin_pct: number;
  production_line_id: string | null;
}

// Best/least-selling, profit margin, and qty-sold-by-period/line analytics —
// derived live from sales_invoice_lines + items, never cached, so a
// just-created invoice is immediately reflected (consistent with this
// project's "no report may show stale data" rule).
export class AnalyticsService {
  private salesInvoiceRepository = RepositoryFactory.getSalesInvoiceRepository();
  private salesInvoiceLineRepository = RepositoryFactory.getSalesInvoiceLineRepository();
  private itemRepository = RepositoryFactory.getItemRepository();
  private purchaseInvoiceLineRepository = RepositoryFactory.getPurchaseInvoiceLineRepository();

  // Real unit cost for an item: the weighted-average purchase price from
  // purchase_invoice_lines (Σ qty·unit_price / Σ qty), falling back to the
  // item's own cost_price, then to null when nothing is known. Callers show
  // "التكلفة غير محددة" for null instead of inventing a ratio of the retail
  // price.
  async getItemCostBasis(itemId: string): Promise<number | null> {
    const lines = await this.purchaseInvoiceLineRepository.findByItemId(itemId);
    let qty = 0;
    let value = 0;
    for (const l of lines) {
      const q = Number(l.qty) || 0;
      qty += q;
      value += q * (Number(l.unit_price) || 0);
    }
    if (qty > 0) return value / qty;

    const item = await this.itemRepository.findById(itemId);
    const cp = Number(item?.cost_price);
    return Number.isFinite(cp) && cp > 0 ? cp : null;
  }

  async getProductPerformance(startDate: string, endDate: string): Promise<ProductPerformance[]> {
    const invoices = (await this.salesInvoiceRepository.findByDateRange(startDate, endDate))
      .filter((inv) => inv.status !== 'cancelled');
    const items = (await this.itemRepository.findAll(undefined, { page: 1, limit: Number.MAX_SAFE_INTEGER })).data;
    const itemById = new Map(items.map((i) => [i.id, i]));

    const byItem = new Map<string, { qty: number; revenue: number }>();
    for (const inv of invoices) {
      const lines = await this.salesInvoiceLineRepository.findByInvoiceId(inv.id);
      for (const line of lines) {
        const entry = byItem.get(line.item_id) || { qty: 0, revenue: 0 };
        entry.qty += Number(line.qty);
        entry.revenue += Number(line.line_total);
        byItem.set(line.item_id, entry);
      }
    }

    const result: ProductPerformance[] = [];
    for (const [itemId, agg] of byItem.entries()) {
      const item = itemById.get(itemId);
      const costPrice = Number(item?.cost_price) || 0;
      const cost = costPrice * agg.qty;
      const profit = agg.revenue - cost;
      result.push({
        item_id: itemId,
        name: item?.name || itemId,
        qty_sold: agg.qty,
        revenue: agg.revenue,
        cost,
        profit,
        profit_margin_pct: agg.revenue > 0 ? (profit / agg.revenue) * 100 : 0,
        production_line_id: item?.production_line_id || null
      });
    }
    return result;
  }

  async getBestSelling(startDate: string, endDate: string, limit = 10): Promise<ProductPerformance[]> {
    const perf = await this.getProductPerformance(startDate, endDate);
    return perf.sort((a, b) => b.qty_sold - a.qty_sold).slice(0, limit);
  }

  async getLeastSelling(startDate: string, endDate: string, limit = 10): Promise<ProductPerformance[]> {
    const perf = await this.getProductPerformance(startDate, endDate);
    return perf.sort((a, b) => a.qty_sold - b.qty_sold).slice(0, limit);
  }

  // Groups quantity sold by day (YYYY-MM-DD) or month (YYYY-MM) for one item.
  async getQtySoldByPeriod(itemId: string, startDate: string, endDate: string, groupBy: 'day' | 'month'): Promise<{ period: string; qty: number }[]> {
    const invoices = (await this.salesInvoiceRepository.findByDateRange(startDate, endDate))
      .filter((inv) => inv.status !== 'cancelled');
    const byPeriod = new Map<string, number>();
    for (const inv of invoices) {
      const period = groupBy === 'day' ? inv.date : inv.date.slice(0, 7);
      const lines = await this.salesInvoiceLineRepository.findByInvoiceId(inv.id);
      const qty = lines.filter((l) => l.item_id === itemId).reduce((sum, l) => sum + Number(l.qty), 0);
      if (qty > 0) byPeriod.set(period, (byPeriod.get(period) || 0) + qty);
    }
    return Array.from(byPeriod.entries()).map(([period, qty]) => ({ period, qty })).sort((a, b) => a.period.localeCompare(b.period));
  }

  async getQtySoldByLine(startDate: string, endDate: string): Promise<{ production_line_id: string | null; qty: number; revenue: number }[]> {
    const perf = await this.getProductPerformance(startDate, endDate);
    const byLine = new Map<string | null, { qty: number; revenue: number }>();
    for (const p of perf) {
      const entry = byLine.get(p.production_line_id) || { qty: 0, revenue: 0 };
      entry.qty += p.qty_sold;
      entry.revenue += p.revenue;
      byLine.set(p.production_line_id, entry);
    }
    return Array.from(byLine.entries()).map(([production_line_id, v]) => ({ production_line_id, ...v }));
  }
}
