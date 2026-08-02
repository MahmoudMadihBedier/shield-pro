import { BaseRepository } from '../base-repository';
import { IRolePermissionRepository } from '../../../core/interfaces/repository';
import { RolePermission } from '../../../core/domain/entities';

export class RolePermissionRepository extends BaseRepository<RolePermission> implements IRolePermissionRepository {
  constructor() {
    super('role_permissions');
  }

  async findByRoleId(roleId: string): Promise<RolePermission[]> {
    return await this.table.filter((rp: RolePermission) => rp.role_id === roleId).toArray();
  }
}
