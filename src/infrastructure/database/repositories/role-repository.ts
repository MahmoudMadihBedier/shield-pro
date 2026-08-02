import { BaseRepository } from '../base-repository';
import { IRoleRepository } from '../../../core/interfaces/repository';
import { Role } from '../../../core/domain/entities';

export class RoleRepository extends BaseRepository<Role> implements IRoleRepository {
  constructor() {
    super('roles');
  }

  async findByName(name: string): Promise<Role | undefined> {
    return await this.table.filter((role: Role) => role.name === name).first();
  }
}
