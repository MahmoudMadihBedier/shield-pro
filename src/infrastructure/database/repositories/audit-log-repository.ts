import { BaseRepository } from '../base-repository';
import { IAuditLogRepository } from '../../../core/interfaces/repository';
import { AuditLog } from '../../../core/domain/entities';

export class AuditLogRepository extends BaseRepository<AuditLog> implements IAuditLogRepository {
  constructor() {
    super('audit_log');
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    return await this.table.filter((log: AuditLog) => log.user_id === userId).toArray();
  }

  async findByTableName(tableName: string): Promise<AuditLog[]> {
    return await this.table.filter((log: AuditLog) => log.table_name === tableName).toArray();
  }
}
