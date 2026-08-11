import { BaseRepository } from '../base-repository';
import { IPunishmentRepository } from '../../../core/interfaces/repository';
import { Punishment } from '../../../core/domain/entities';

export class PunishmentRepository extends BaseRepository<Punishment> implements IPunishmentRepository {
  constructor() {
    super('punishments');
  }

  async findByEmployeeId(employeeId: string): Promise<Punishment[]> {
    return await this.table
      .filter((punishment: Punishment) => punishment.employee_id === employeeId)
      .toArray();
  }
}
