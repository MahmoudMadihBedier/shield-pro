import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';
import { RepCloseoutSession, RepStockRequest, RepStockRequestLine } from '../../core/domain/entities';
import { assertSegregationOfDuties } from './segregation-of-duties-guard';

// Phase 2.4 of SHIELD_PRO_REFACTOR_MASTER_PLAN.md — every sales rep is
// treated as a mini warehouse (stock-in-hand) and mini cash register
// (cash-in-hand). Balances are never stored directly, always derived from
// the append-only rep_stock_ledger/rep_cash_ledger tables, mirroring the
// existing stock_movements/account_transactions pattern in this codebase.
export class RepLedgerService {
  private repStockLedgerRepository = RepositoryFactory.getRepStockLedgerRepository();
  private repCashLedgerRepository = RepositoryFactory.getRepCashLedgerRepository();
  private repCloseoutSessionRepository = RepositoryFactory.getRepCloseoutSessionRepository();
  private repStockRequestRepository = RepositoryFactory.getRepStockRequestRepository();
  private repStockRequestLineRepository = RepositoryFactory.getRepStockRequestLineRepository();
  private stockMovementRepository = RepositoryFactory.getStockMovementRepository();

  // Branch Warehouse Manager (or admin) issues stock to a rep. Deducts the
  // branch warehouse's own on-hand stock (rep_issue) and credits the rep's
  // stock-in-hand ledger in the same call, so the two always stay in sync —
  // the goods have left the warehouse, not vanished.
  async issueStockToRep(
    repUserId: string,
    warehouseId: string,
    items: { item_id: string; qty: number }[]
  ): Promise<void> {
    for (const line of items) {
      const qty = Math.abs(Number(line.qty));
      if (qty <= 0) continue;

      const movement = await this.stockMovementRepository.create({
        item_id: line.item_id,
        warehouse_id: warehouseId,
        qty: -qty,
        movement_type: 'rep_issue',
        ref_table: 'rep_stock_ledger',
        ref_id: repUserId,
        moved_at: new Date().toISOString()
      });
      await queueOfflineWrite('stock_movements', 'insert', movement.id, movement);

      const ledgerEntry = await this.repStockLedgerRepository.create({
        rep_user_id: repUserId,
        item_id: line.item_id,
        warehouse_id: warehouseId,
        qty,
        movement_type: 'issued',
        ref_table: 'stock_movements',
        ref_id: movement.id,
        closeout_session_id: null,
        moved_at: new Date().toISOString()
      });
      await queueOfflineWrite('rep_stock_ledger', 'insert', ledgerEntry.id, ledgerEntry);
    }
  }

  // Called from SalesService.createInvoice when the sale is made against a
  // rep's own stock-in-hand rather than a direct warehouse counter sale —
  // deducts the rep's ledger instead of the warehouse (the stock already
  // left the warehouse at issuance time, so warehouse stock must NOT be
  // deducted again here).
  async recordSaleFromRepStock(
    repUserId: string,
    warehouseId: string,
    items: { item_id: string; qty: number }[],
    invoiceId: string
  ): Promise<void> {
    for (const line of items) {
      const qty = Math.abs(Number(line.qty));
      if (qty <= 0) continue;
      const ledgerEntry = await this.repStockLedgerRepository.create({
        rep_user_id: repUserId,
        item_id: line.item_id,
        warehouse_id: warehouseId,
        qty: -qty,
        movement_type: 'sold',
        ref_table: 'sales_invoices',
        ref_id: invoiceId,
        closeout_session_id: null,
        moved_at: new Date().toISOString()
      });
      await queueOfflineWrite('rep_stock_ledger', 'insert', ledgerEntry.id, ledgerEntry);
    }
  }

  // Called from SalesService when a cash/bank sale is collected on the spot
  // by a rep — grows their cash-in-hand balance until they hand it in.
  async recordCashCollection(
    repUserId: string,
    amount: number,
    paymentType: 'cash' | 'bank',
    refTable: string,
    refId: string
  ): Promise<void> {
    if (amount <= 0) return;
    const entry = await this.repCashLedgerRepository.create({
      rep_user_id: repUserId,
      amount,
      payment_type: paymentType,
      ref_table: refTable,
      ref_id: refId,
      closeout_session_id: null,
      moved_at: new Date().toISOString()
    });
    await queueOfflineWrite('rep_cash_ledger', 'insert', entry.id, entry);
  }

  // Recorded when a rep physically hands cash to the branch accountant —
  // negative entry, brings their cash-in-hand balance back toward zero.
  async recordCashHandover(repUserId: string, amount: number, paymentType: 'cash' | 'bank', refTable: string, refId: string): Promise<void> {
    if (amount <= 0) return;
    const entry = await this.repCashLedgerRepository.create({
      rep_user_id: repUserId,
      amount: -amount,
      payment_type: paymentType,
      ref_table: refTable,
      ref_id: refId,
      closeout_session_id: null,
      moved_at: new Date().toISOString()
    });
    await queueOfflineWrite('rep_cash_ledger', 'insert', entry.id, entry);
  }

  // ---- Rep stock requests (rep -> branch keeper dual sign-off) -----------

  async createRepStockRequest(
    repUserId: string,
    warehouseId: string,
    requestedBy: string,
    lines: { item_id: string; qty: number }[],
    notes?: string
  ): Promise<RepStockRequest> {
    const clean = lines.filter((l) => l.item_id && Math.abs(Number(l.qty)) > 0);
    if (clean.length === 0) throw new Error('أضف صنفاً واحداً على الأقل بكمية صحيحة.');

    const request = await this.repStockRequestRepository.create({
      rep_user_id: repUserId,
      warehouse_id: warehouseId,
      requested_by: requestedBy,
      status: 'pending_approval'
    } as Omit<RepStockRequest, 'id' | 'created_at' | 'updated_at'>);
    await queueOfflineWrite('rep_stock_requests', 'insert', request.id, { ...request, notes: notes || null });

    for (const l of clean) {
      const line = await this.repStockRequestLineRepository.create({
        request_id: request.id,
        item_id: l.item_id,
        requested_qty: Math.abs(Number(l.qty))
      } as Omit<RepStockRequestLine, 'id' | 'created_at' | 'updated_at'>);
      await queueOfflineWrite('rep_stock_request_lines', 'insert', line.id, line);
    }
    return request;
  }

  async getRepStockRequests(): Promise<RepStockRequest[]> {
    return await this.repStockRequestRepository.findAll().then((r) => r.data);
  }

  async getRepStockRequestLines(requestId: string): Promise<RepStockRequestLine[]> {
    return await this.repStockRequestLineRepository.findByRequestId(requestId);
  }

  // Branch keeper approves: checks the branch can cover every line, then
  // issues the stock into the rep's van (paired rep_issue movement +
  // rep_stock_ledger 'issued') and marks the request 'issued'. SoD
  // (approver != rep, approver != requester) is also enforced server-side.
  async approveRepStockRequest(requestId: string, approvedBy: string): Promise<RepStockRequest> {
    const request = await this.repStockRequestRepository.findById(requestId);
    if (!request) throw new Error('طلب صرف العهدة غير موجود');
    if (request.status !== 'pending_approval') throw new Error('لا يمكن اعتماد هذا الطلب في حالته الحالية.');
    assertSegregationOfDuties({ requestedBy: request.requested_by, actingUserId: approvedBy, action: 'اعتماد صرف عهدة المندوب' });
    if (approvedBy === request.rep_user_id) {
      throw new Error('لا يجوز للمندوب اعتماد طلب صرف عهدته بنفسه (فصل المهام).');
    }

    const lines = await this.repStockRequestLineRepository.findByRequestId(requestId);
    if (lines.length === 0) throw new Error('لا توجد أصناف في هذا الطلب.');

    const short: string[] = [];
    for (const l of lines) {
      const have = await this.stockMovementRepository.calculateStock(l.item_id, request.warehouse_id);
      if (have + 1e-9 < Number(l.requested_qty)) short.push(`${l.item_id} (متاح ${have.toFixed(2)} / مطلوب ${Number(l.requested_qty).toFixed(2)})`);
    }
    if (short.length > 0) throw new Error(`رصيد المخزن لا يكفي: ${short.join('، ')}`);

    // Mark approved first so the SoD trigger sees approved_by, then issue.
    const approved = await this.repStockRequestRepository.update(requestId, {
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString()
    });
    await queueOfflineWrite('rep_stock_requests', 'update', requestId, approved);

    await this.issueStockToRep(
      request.rep_user_id,
      request.warehouse_id,
      lines.map((l) => ({ item_id: l.item_id, qty: Number(l.requested_qty) }))
    );

    const issued = await this.repStockRequestRepository.update(requestId, { status: 'issued' });
    await queueOfflineWrite('rep_stock_requests', 'update', requestId, issued);
    return issued;
  }

  async rejectRepStockRequest(requestId: string, rejectedBy: string, reason: string): Promise<RepStockRequest> {
    const updated = await this.repStockRequestRepository.update(requestId, {
      status: 'rejected',
      approved_by: rejectedBy,
      approved_at: new Date().toISOString(),
      rejection_reason: reason
    });
    await queueOfflineWrite('rep_stock_requests', 'update', requestId, updated);
    return updated;
  }

  async getRepStockBalances(repUserId: string) {
    return await this.repStockLedgerRepository.getRepBalances(repUserId);
  }

  async getRepCashBalance(repUserId: string): Promise<number> {
    return await this.repCashLedgerRepository.calculateBalance(repUserId);
  }

  async getOrOpenTodaySession(repUserId: string, warehouseId: string): Promise<RepCloseoutSession> {
    const today = new Date().toISOString().split('T')[0];
    const existing = await this.repCloseoutSessionRepository.findOpenSession(repUserId, today);
    if (existing) return existing;

    const expectedCash = await this.getRepCashBalance(repUserId);
    const session = await this.repCloseoutSessionRepository.create({
      rep_user_id: repUserId,
      warehouse_id: warehouseId,
      session_date: today,
      status: 'open',
      expected_cash: expectedCash,
      actual_cash_counted: null,
      cash_variance: null,
      stock_variance: null
    });
    await queueOfflineWrite('rep_closeout_sessions', 'insert', session.id, session);
    return session;
  }

  // Rep submits their end-of-day count. Computes variance against the
  // ledger-derived expected values (never trusts a caller-supplied
  // "expected" figure) and links every not-yet-reconciled ledger row to this
  // session so the history stays grouped by close-out.
  async submitCloseout(
    sessionId: string,
    repUserId: string,
    actualCashCounted: number,
    stockCounts: { item_id: string; counted: number }[],
    submittedBy: string,
    notes?: string
  ): Promise<RepCloseoutSession> {
    const expectedCash = await this.getRepCashBalance(repUserId);
    const expectedStock = await this.getRepStockBalances(repUserId);
    const expectedByItem = new Map(expectedStock.map((s) => [s.item_id, s.balance]));

    const stockVariance: { [itemId: string]: { expected: number; counted: number; diff: number } } = {};
    let hasStockVariance = false;
    for (const line of stockCounts) {
      const expected = expectedByItem.get(line.item_id) || 0;
      const diff = Number(line.counted) - expected;
      stockVariance[line.item_id] = { expected, counted: Number(line.counted), diff };
      if (diff !== 0) hasStockVariance = true;
    }

    const cashVariance = actualCashCounted - expectedCash;
    const status = (cashVariance !== 0 || hasStockVariance) ? 'variance_flagged' : 'submitted';

    const updated = await this.repCloseoutSessionRepository.update(sessionId, {
      status,
      expected_cash: expectedCash,
      actual_cash_counted: actualCashCounted,
      cash_variance: cashVariance,
      stock_variance: stockVariance,
      submitted_at: new Date().toISOString(),
      submitted_by: submittedBy,
      notes
    });
    await queueOfflineWrite('rep_closeout_sessions', 'update', sessionId, updated);

    // Link every not-yet-reconciled ledger row for this rep to this session.
    const [stockRows, cashRows] = await Promise.all([
      this.repStockLedgerRepository.findByRepId(repUserId),
      this.repCashLedgerRepository.findByRepId(repUserId)
    ]);
    for (const row of stockRows.filter((r) => !r.closeout_session_id)) {
      const linked = await this.repStockLedgerRepository.update(row.id, { closeout_session_id: sessionId });
      await queueOfflineWrite('rep_stock_ledger', 'update', row.id, linked);
    }
    for (const row of cashRows.filter((r) => !r.closeout_session_id)) {
      const linked = await this.repCashLedgerRepository.update(row.id, { closeout_session_id: sessionId });
      await queueOfflineWrite('rep_cash_ledger', 'update', row.id, linked);
    }

    return updated;
  }

  // Segregation of duties (confirmer != the rep) is enforced server-side by
  // the enforce_closeout_segregation_of_duties trigger — this call will be
  // rejected by the database if violated, not just by this check.
  async confirmCloseout(sessionId: string, confirmedBy: string, repUserId: string): Promise<RepCloseoutSession> {
    assertSegregationOfDuties({ requestedBy: repUserId, actingUserId: confirmedBy, action: 'اعتماد إغلاق اليوم' });
    const updated = await this.repCloseoutSessionRepository.update(sessionId, {
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_by: confirmedBy
    });
    await queueOfflineWrite('rep_closeout_sessions', 'update', sessionId, updated);
    return updated;
  }
}
