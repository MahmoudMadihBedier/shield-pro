import { RepositoryFactory } from '../../infrastructure/database/repository-factory';

export interface BatchTraceability {
  batch: any;
  rawMaterialsConsumed: { item_id: string; item_name: string; qty_consumed: number }[];
  outputMovements: any[];
  downstreamSales: any[];
}

// Phase 1.1 — "given any BATCH-xxxxx, render everything downstream (which
// units were sold to which customers), and everything upstream (which raw
// materials it was made from)" in one query-round-trip, not an investigation.
// Bounded to what the current schema's actual foreign keys support well
// (batch -> consumption -> raw items, and batch -> output stock movement ->
// whatever ref_table/ref_id consumed that stock next) rather than a fully
// generic arbitrary-depth graph walker.
export class TraceabilityService {
  private productionBatchRepository = RepositoryFactory.getProductionBatchRepository();
  private productionConsumptionRepository = RepositoryFactory.getProductionConsumptionRepository();
  private itemRepository = RepositoryFactory.getItemRepository();
  private stockMovementRepository = RepositoryFactory.getStockMovementRepository();
  private salesInvoiceLineRepository = RepositoryFactory.getSalesInvoiceLineRepository();

  async getBatchTraceability(batchId: string): Promise<BatchTraceability | null> {
    const batch = await this.productionBatchRepository.findById(batchId);
    if (!batch) return null;

    // Backward: raw materials this batch consumed.
    const consumptions = await this.productionConsumptionRepository.findByBatchId(batchId);
    const rawMaterialsConsumed = await Promise.all(
      consumptions.map(async (c) => {
        const item = await this.itemRepository.findById(c.raw_item_id);
        return { item_id: c.raw_item_id, item_name: item?.name || c.raw_item_id, qty_consumed: c.qty_consumed };
      })
    );

    // Forward: where the batch's finished-goods output went. Every
    // stock_movement tagged ref_table='production_batches'/ref_id=batchId
    // is the output credit; from there, any sale of that same item (by
    // batch_no, which every sale_out movement is also tagged with) is the
    // downstream trail.
    const outputMovements = (await this.stockMovementRepository.findByItemId(batch.item_id))
      .filter((m) => m.ref_table === 'production_batches' && m.ref_id === batchId);

    const saleMovements = (await this.stockMovementRepository.findByItemId(batch.item_id))
      .filter((m) => m.movement_type === 'sale_out' && m.batch_no === batch.batch_no);

    const downstreamSales = [];
    for (const m of saleMovements) {
      if (m.ref_table === 'sales_invoices' && m.ref_id) {
        const lines = await this.salesInvoiceLineRepository.findByInvoiceId(m.ref_id);
        downstreamSales.push({ invoice_id: m.ref_id, qty: Math.abs(m.qty), moved_at: m.moved_at, line_count: lines.length });
      }
    }

    return { batch, rawMaterialsConsumed, outputMovements, downstreamSales };
  }
}
