import { BaseRepository } from '../base-repository';
import { IApprovalRuleLogRepository } from '../../../core/interfaces/repository';
import { ApprovalRuleLog } from '../../../core/domain/entities';

export class ApprovalRuleLogRepository extends BaseRepository<ApprovalRuleLog> implements IApprovalRuleLogRepository {
  constructor() {
    super('approval_rule_log');
  }

  async findByActor(actorId: string, sinceIso: string): Promise<ApprovalRuleLog[]> {
    return await this.table
      .filter((r: ApprovalRuleLog) => r.actor_id === actorId && r.created_at >= sinceIso)
      .toArray();
  }
}
