import { BaseRepository } from '../base-repository';
import { IApprovalRuleRepository } from '../../../core/interfaces/repository';
import { ApprovalRule } from '../../../core/domain/entities';

export class ApprovalRuleRepository extends BaseRepository<ApprovalRule> implements IApprovalRuleRepository {
  constructor() {
    super('approval_rules');
  }

  async findByMovementType(movementType: string): Promise<ApprovalRule | undefined> {
    return await this.table.filter((r: ApprovalRule) => r.movement_type === movementType && r.is_active).first();
  }
}
