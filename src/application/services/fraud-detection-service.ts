import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';
import { FraudFlag } from '../../core/domain/entities';

// Phase 2.3 of SHIELD_PRO_REFACTOR_MASTER_PLAN.md — a simple, rule-based
// heuristic (not ML) to catch "goods shuttling back and forth" patterns
// that could be used to obscure shrinkage or timing fraud. Run on demand
// (an admin action, not a background job — this app has no scheduler/cron)
// rather than continuously; still real detection logic over real ledger
// data, not a stub.
export class FraudDetectionService {
  private repStockLedgerRepository = RepositoryFactory.getRepStockLedgerRepository();
  private fraudFlagRepository = RepositoryFactory.getFraudFlagRepository();

  // Flags a rep/item pair where a high share of what was issued came back
  // (returned) rather than being sold — a pattern consistent with goods
  // being shuffled back and forth rather than genuinely moving to a customer.
  async detectRoundTripping(windowDays = 30, minReturns = 3, minReturnRatio = 0.5): Promise<FraudFlag[]> {
    const since = new Date(Date.now() - windowDays * 24 * 3600_000).toISOString();
    const allLedgerRows = (await this.repStockLedgerRepository.findAll(undefined, { page: 1, limit: Number.MAX_SAFE_INTEGER })).data
      .filter((r) => r.moved_at && r.moved_at >= since);

    const byRepItem = new Map<string, { repUserId: string; itemId: string; issued: number; returned: number }>();
    for (const row of allLedgerRows) {
      const key = `${row.rep_user_id}::${row.item_id}`;
      const entry = byRepItem.get(key) || { repUserId: row.rep_user_id, itemId: row.item_id, issued: 0, returned: 0 };
      if (row.movement_type === 'issued') entry.issued += 1;
      if (row.movement_type === 'returned') entry.returned += 1;
      byRepItem.set(key, entry);
    }

    const newFlags: FraudFlag[] = [];
    const existingOpen = await this.fraudFlagRepository.findByStatus('open');

    for (const { repUserId, itemId, issued, returned } of byRepItem.values()) {
      if (returned < minReturns) continue;
      const ratio = issued > 0 ? returned / issued : 0;
      if (ratio < minReturnRatio) continue;

      const alreadyFlagged = existingOpen.some(
        (f) => f.flag_type === 'round_tripping' && f.actor_id === repUserId && f.item_id === itemId
      );
      if (alreadyFlagged) continue;

      const flag = await this.fraudFlagRepository.create({
        flag_type: 'round_tripping',
        actor_id: repUserId,
        item_id: itemId,
        details: { window_days: windowDays, issued, returned, ratio: Number(ratio.toFixed(2)) },
        status: 'open'
      });
      await queueOfflineWrite('fraud_flags', 'insert', flag.id, flag);
      newFlags.push(flag);
    }

    return newFlags;
  }

  async getOpenFlags(): Promise<FraudFlag[]> {
    return await this.fraudFlagRepository.findByStatus('open');
  }

  async reviewFlag(flagId: string, reviewedBy: string, status: 'reviewed' | 'dismissed'): Promise<FraudFlag> {
    const updated = await this.fraudFlagRepository.update(flagId, {
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString()
    });
    await queueOfflineWrite('fraud_flags', 'update', flagId, updated);
    return updated;
  }
}
