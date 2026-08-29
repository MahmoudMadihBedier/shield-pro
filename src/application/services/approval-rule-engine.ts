import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';

export interface RuleEvaluation {
  wouldAutoApprove: boolean;
  ruleMatched: string;
}

// Phase 2.2 of SHIELD_PRO_REFACTOR_MASTER_PLAN.md — Strategy pattern:
// configurable per-movement-type rules instead of one bottleneck approver
// for everything. Every evaluation is logged (who/what/when/rule/outcome),
// which is itself the audit trail the Administrator reviews periodically to
// see what the system WOULD be waving through. Advisory only in this pass
// — see approval_rules_and_fraud_detection migration for why this doesn't
// yet bypass the segregation-of-duties triggers.
export class ApprovalRuleEngine {
  private ruleRepository = RepositoryFactory.getApprovalRuleRepository();
  private logRepository = RepositoryFactory.getApprovalRuleLogRepository();

  async evaluate(
    movementType: string,
    actorId: string,
    itemId: string | null,
    qty: number,
    refTable?: string,
    refId?: string
  ): Promise<RuleEvaluation> {
    const rule = await this.ruleRepository.findByMovementType(movementType);
    let wouldAutoApprove = false;
    let ruleMatched = 'no_active_rule';

    if (rule) {
      const withinThreshold = qty <= rule.auto_approve_threshold_qty;

      // Defeats the "many small requests to sneak past a size threshold"
      // trick: if this actor has already triggered this rule too many
      // times in the configured window, force manual review regardless of
      // how small this individual request is.
      const since = new Date(Date.now() - rule.repeat_window_hours * 3600_000).toISOString();
      const recent = await this.logRepository.findByActor(actorId, since);
      const recentSameType = recent.filter((l) => l.movement_type === movementType).length;
      const repeatExceeded = recentSameType >= rule.repeat_max_count;

      if (withinThreshold && !repeatExceeded) {
        wouldAutoApprove = true;
        ruleMatched = `threshold_ok(${qty}<=${rule.auto_approve_threshold_qty})`;
      } else if (repeatExceeded) {
        ruleMatched = `repeat_limit_exceeded(${recentSameType}>=${rule.repeat_max_count}/${rule.repeat_window_hours}h)`;
      } else {
        ruleMatched = `over_threshold(${qty}>${rule.auto_approve_threshold_qty})`;
      }
    }

    const logEntry = await this.logRepository.create({
      movement_type: movementType,
      actor_id: actorId,
      item_id: itemId,
      qty,
      rule_matched: ruleMatched,
      outcome: wouldAutoApprove ? 'would_auto_approve' : 'manual_review_required',
      ref_table: refTable,
      ref_id: refId
    });
    await queueOfflineWrite('approval_rule_log', 'insert', logEntry.id, logEntry);

    return { wouldAutoApprove, ruleMatched };
  }
}
