import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';
import { StockCountSession } from '../../core/domain/entities';
import { assertSegregationOfDuties } from './segregation-of-duties-guard';

// Phase 2.9 — periodic physical counts compared against system-recorded
// stock, with variances routed through a real adjustment entry (never a
// silent stock edit) once someone OTHER than the counter signs off.
export class StockCountService {
  private sessionRepository = RepositoryFactory.getStockCountSessionRepository();
  private lineRepository = RepositoryFactory.getStockCountLineRepository();
  private stockMovementRepository = RepositoryFactory.getStockMovementRepository();
  private itemRepository = RepositoryFactory.getItemRepository();

  // Opens a session for a warehouse, pre-populated with the current
  // system-recorded stock for every item that has ever moved through it —
  // the counter enters what they physically see against this baseline.
  async openSession(warehouseId: string, countedBy: string, itemIds: string[]): Promise<StockCountSession> {
    const session = await this.sessionRepository.create({
      warehouse_id: warehouseId,
      status: 'open',
      counted_by: countedBy
    });
    await queueOfflineWrite('stock_count_sessions', 'insert', session.id, session);

    for (const itemId of itemIds) {
      const expected = await this.stockMovementRepository.calculateStock(itemId, warehouseId);
      const line = await this.lineRepository.create({
        session_id: session.id,
        item_id: itemId,
        expected_qty: expected,
        counted_qty: null,
        variance: null
      });
      await queueOfflineWrite('stock_count_lines', 'insert', line.id, line);
    }

    return session;
  }

  async getSessionLines(sessionId: string) {
    return await this.lineRepository.findBySessionId(sessionId);
  }

  async submitCounts(sessionId: string, counts: { item_id: string; counted_qty: number }[]): Promise<void> {
    const lines = await this.lineRepository.findBySessionId(sessionId);
    for (const line of lines) {
      const counted = counts.find((c) => c.item_id === line.item_id)?.counted_qty;
      if (counted === undefined) continue;
      const updated = await this.lineRepository.update(line.id, {
        counted_qty: counted,
        variance: counted - Number(line.expected_qty)
      });
      await queueOfflineWrite('stock_count_lines', 'update', line.id, updated);
    }
    const session = await this.sessionRepository.update(sessionId, {
      status: 'submitted',
      submitted_at: new Date().toISOString()
    });
    await queueOfflineWrite('stock_count_sessions', 'update', sessionId, session);
  }

  // Sign-off posts a manual_adjustment stock movement for every non-zero
  // variance line — this IS the origin reference the master plan calls for
  // ("generate an adjustment entry with the count session as its origin
  // reference"). The counter cannot sign off their own session.
  async signOff(sessionId: string, signedOffBy: string): Promise<StockCountSession> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('جلسة الجرد غير موجودة');
    if (session.status !== 'submitted') throw new Error('يجب إرسال نتائج الجرد أولاً قبل الاعتماد');
    if (session.counted_by) {
      assertSegregationOfDuties({ requestedBy: session.counted_by, actingUserId: signedOffBy, action: 'اعتماد نتائج الجرد' });
    }

    const lines = await this.lineRepository.findBySessionId(sessionId);
    for (const line of lines) {
      if (!line.variance || Number(line.variance) === 0) continue;
      const movement = await this.stockMovementRepository.create({
        item_id: line.item_id,
        warehouse_id: session.warehouse_id,
        qty: Number(line.variance),
        movement_type: 'manual_adjustment',
        ref_table: 'stock_count_sessions',
        ref_id: session.id,
        moved_at: new Date().toISOString()
      });
      await queueOfflineWrite('stock_movements', 'insert', movement.id, movement);
    }

    const updated = await this.sessionRepository.update(sessionId, {
      status: 'signed_off',
      signed_off_by: signedOffBy,
      signed_off_at: new Date().toISOString()
    });
    await queueOfflineWrite('stock_count_sessions', 'update', sessionId, updated);
    return updated;
  }
}
