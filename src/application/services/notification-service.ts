import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';
import { InternalNotification } from '../../core/domain/entities';

type Listener = (notifications: InternalNotification[]) => void;

// Phase 2.6 — Observer pattern, consistent with the existing sync-state
// subscriber pattern (sync-service.ts's subscribeToSync). Low stock,
// pending approvals, missed cash-ups, fraud flags, etc. get pushed here
// instead of requiring someone to remember to check a report.
export class NotificationService {
  private repository = RepositoryFactory.getInternalNotificationRepository();
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async notifyListeners(userId: string, roleId: string | null) {
    const notifications = await this.repository.findForUser(userId, roleId);
    this.listeners.forEach((l) => l(notifications));
  }

  async notifyUser(userId: string, type: InternalNotification['type'], title: string, message: string, data?: Record<string, unknown>): Promise<void> {
    const n = await this.repository.create({ user_id: userId, role_id: null, type, title, message, data: data ?? null, is_read: false });
    await queueOfflineWrite('internal_notifications', 'insert', n.id, n);
  }

  async notifyRole(roleId: string, type: InternalNotification['type'], title: string, message: string, data?: Record<string, unknown>): Promise<void> {
    const n = await this.repository.create({ user_id: null, role_id: roleId, type, title, message, data: data ?? null, is_read: false });
    await queueOfflineWrite('internal_notifications', 'insert', n.id, n);
  }

  async getForUser(userId: string, roleId: string | null): Promise<InternalNotification[]> {
    const notifications = await this.repository.findForUser(userId, roleId);
    await this.notifyListeners(userId, roleId);
    return notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async markRead(notificationId: string): Promise<void> {
    const updated = await this.repository.update(notificationId, { is_read: true, read_at: new Date().toISOString() });
    await queueOfflineWrite('internal_notifications', 'update', notificationId, updated);
  }
}
