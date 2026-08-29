import { BaseRepository } from '../base-repository';
import { IBranchCashSettlementRepository } from '../../../core/interfaces/repository';
import { BranchCashSettlement } from '../../../core/domain/entities';

export class BranchCashSettlementRepository
  extends BaseRepository<BranchCashSettlement>
  implements IBranchCashSettlementRepository {
  constructor() {
    super('branch_cash_settlements');
  }

  async findByBranch(branchWarehouseId: string): Promise<BranchCashSettlement[]> {
    return await this.table
      .filter((s: BranchCashSettlement) => s.branch_warehouse_id === branchWarehouseId)
      .toArray();
  }

  async findByStatus(status: string): Promise<BranchCashSettlement[]> {
    return await this.table.filter((s: BranchCashSettlement) => s.status === status).toArray();
  }
}
