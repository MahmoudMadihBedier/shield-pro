import { BaseRepository } from '../base-repository';
import { ISettingRepository } from '../../../core/interfaces/repository';
import { Setting } from '../../../core/domain/entities';

export class SettingRepository extends BaseRepository<Setting> implements ISettingRepository {
  constructor() {
    super('settings');
  }

  async findByKey(key: string): Promise<Setting | undefined> {
    return await this.table.filter((setting: Setting) => setting.key === key).first();
  }

  async findByScope(scope: string): Promise<Setting[]> {
    return await this.table.filter((setting: Setting) => setting.scope === scope).toArray();
  }
}
