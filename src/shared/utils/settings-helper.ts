import { ServiceFactory } from '../../application/services/service-factory';

// Backward compatibility wrapper - delegates to the new service
export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  const settingsService = ServiceFactory.getSettingsService();
  return await settingsService.getSetting(key, defaultValue);
}

export async function getSettingBool(key: string, defaultValue: boolean = false): Promise<boolean> {
  const settingsService = ServiceFactory.getSettingsService();
  return await settingsService.getSettingBool(key, defaultValue);
}

export async function saveSetting(key: string, value: string) {
  const settingsService = ServiceFactory.getSettingsService();
  return await settingsService.saveSetting(key, value);
}

export async function saveSettingWithId(_id: string, key: string, value: string) {
  const settingsService = ServiceFactory.getSettingsService();
  return await settingsService.saveSetting(key, value);
}
