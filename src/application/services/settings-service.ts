import { ISettingsService } from '../../core/interfaces/services';
import { Setting } from '../../core/domain/entities';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';

export class SettingsService implements ISettingsService {
  private settingRepository = RepositoryFactory.getSettingRepository();

  async getSetting(key: string, defaultValue: string = ''): Promise<string> {
    try {
      const setting = await this.settingRepository.findByKey(key);
      return setting ? setting.value : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async getSettingBool(key: string, defaultValue: boolean = false): Promise<boolean> {
    const val = await this.getSetting(key);
    if (val === '') return defaultValue;
    return val === 'true';
  }

  async saveSetting(key: string, value: string): Promise<void> {
    try {
      const existing = await this.settingRepository.findByKey(key);
      const id = existing?.id || crypto.randomUUID();
      const updatedRecord = {
        id,
        key,
        value,
        scope: 'global',
        updated_at: new Date().toISOString()
      } as Setting;

      await this.settingRepository.create(updatedRecord);
      await queueOfflineWrite('settings', 'insert', id, updatedRecord);
    } catch (e) {
      console.error("Failed to save setting:", e);
    }
  }

  async getAllSettings(): Promise<Setting[]> {
    const result = await this.settingRepository.findAll();
    return result.data;
  }
}