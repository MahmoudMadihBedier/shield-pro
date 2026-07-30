import { IAuditService } from '../../core/interfaces/sync';
import { DatabaseAction } from '../../core/types';
import { AUDIT_EXCLUDED_TABLES } from '../../shared/constants/sequence-config';
import { queueOfflineWrite } from './sync-service';

export class AuditService implements IAuditService {
  private currentUserId: string | null = null;

  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  isTableExcluded(tableName: string): boolean {
    return AUDIT_EXCLUDED_TABLES.has(tableName);
  }

  async log(tableName: string, action: DatabaseAction, recordId: string, oldValue: any, newValue: any): Promise<void> {
    if (this.isTableExcluded(tableName)) {
      return;
    }

    try {
      const id = crypto.randomUUID();
      await queueOfflineWrite('audit_log', 'insert', id, {
        id,
        user_id: this.currentUserId,
        table_name: tableName,
        record_id: recordId,
        action,
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null,
        timestamp: new Date().toISOString()
      });
    } catch {
      // Auditing must never block the primary write
      console.error('Failed to log audit entry');
    }
  }
}