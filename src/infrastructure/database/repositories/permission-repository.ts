import { BaseRepository } from '../base-repository';
import { IPermissionRepository } from '../../../core/interfaces/repository';
import { Permission } from '../../../core/domain/entities';

export class PermissionRepository extends BaseRepository<Permission> implements IPermissionRepository {
  constructor() {
    super('permissions');
  }

  async findByModule(module: string): Promise<Permission[]> {
    return await this.table.filter((permission: Permission) => permission.module === module).toArray();
  }
}
