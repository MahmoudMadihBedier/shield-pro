import { BaseRepository } from '../base-repository';
import { IInternalNotificationRepository } from '../../../core/interfaces/repository';
import { InternalNotification } from '../../../core/domain/entities';

export class InternalNotificationRepository extends BaseRepository<InternalNotification> implements IInternalNotificationRepository {
  constructor() {
    super('internal_notifications');
  }

  async findForUser(userId: string, roleId: string | null): Promise<InternalNotification[]> {
    return await this.table
      .filter((n: InternalNotification) => n.user_id === userId || (roleId !== null && n.role_id === roleId))
      .toArray();
  }
}
