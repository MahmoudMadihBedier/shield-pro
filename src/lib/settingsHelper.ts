import { db } from './dexie';
import { queueOfflineWrite } from './sync';

export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const item = await db.settings.get(key);
    return item ? item.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function getSettingBool(key: string, defaultValue: boolean = false): Promise<boolean> {
  const val = await getSetting(key);
  if (val === '') return defaultValue;
  return val === 'true';
}

export async function saveSetting(key: string, value: string) {
  try {
    const existing = await db.settings.get(key);
    const id = existing?.id || crypto.randomUUID();
    const updatedRecord = {
      id,
      key,
      value,
      scope: 'global',
      updated_at: new Date().toISOString()
    };
    await queueOfflineWrite('settings', 'insert', id, updatedRecord);
  } catch (e) {
    console.error("Failed to save setting:", e);
  }
}
export async function saveSettingWithId(id: string, key: string, value: string) {
  try {
    const updatedRecord = {
      id,
      key,
      value,
      scope: 'global',
      updated_at: new Date().toISOString()
    };
    await queueOfflineWrite('settings', 'insert', id, updatedRecord);
  } catch (e) {
    console.error("Failed to save setting:", e);
  }
}
