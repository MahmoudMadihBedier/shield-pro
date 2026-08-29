import React, { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../../application/services/auth-service';
import { ServiceFactory } from '../../application/services/service-factory';

// Phase 2.6 — the bell in the top bar was a static icon before this; now
// backed by internal_notifications, polling like the rest of this app's
// sync layer does (no realtime subscription infra here yet).
export const NotificationBell: React.FC = () => {
  const { profile } = useAuth();
  const notificationService = ServiceFactory.getNotificationService();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    const list = await notificationService.getForUser(profile.id, profile.role_id || null);
    setNotifications(list);
  }, [profile?.id, profile?.role_id, notificationService]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 120_000);
    return () => clearInterval(interval);
  }, [load]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkRead = async (id: string) => {
    await notificationService.markRead(id);
    await load();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative">
        <Bell className="h-6 w-6 text-gray-400 hover:text-gray-600 cursor-pointer" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div dir="rtl" className="absolute left-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b font-bold text-sm text-gray-800">التنبيهات</div>
          {notifications.length === 0 ? (
            <p className="p-4 text-xs text-gray-400">لا توجد تنبيهات.</p>
          ) : (
            notifications.slice(0, 20).map((n) => (
              <div
                key={n.id}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
                className={`p-3 border-b text-xs cursor-pointer ${n.is_read ? 'bg-white' : 'bg-blue-50'}`}
              >
                <div className="font-bold text-gray-800">{n.title}</div>
                <div className="text-gray-500 mt-1">{n.message}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
