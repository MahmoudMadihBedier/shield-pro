import { BaseRepository } from '../base-repository';
import { IBonusRepository } from '../../../core/interfaces/repository';
import { Bonus } from '../../../core/domain/entities';

export class BonusRepository extends BaseRepository<Bonus> implements IBonusRepository {
  constructor() {
    super('bonuses');
  }

  async findByEmployeeId(employeeId: string): Promise<Bonus[]> {
    return await this.table
      .filter((bonus: Bonus) => bonus.employee_id === employeeId)
      .toArray();
  }
}
