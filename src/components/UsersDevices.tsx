import React, { useEffect, useState } from 'react';
import { db } from '../lib/dexie';
import { queueOfflineWrite } from '../lib/sync';
import { Users as UsersIcon, Wifi, WifiOff } from 'lucide-react';

const ONLINE_THRESHOLD_MS = 10 * 60 * 1000; // matches the 5-minute presence heartbeat with margin

export const UsersDevices: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [listUsers, listRoles] = await Promise.all([db.users.toArray(), db.roles.toArray()]);
    listUsers.sort((a: any, b: any) => (b.last_seen_at || '').localeCompare(a.last_seen_at || ''));
    setUsers(listUsers);
    setRoles(listRoles);
  };

  const isOnline = (user: any) => {
    if (!user.last_seen_at) return false;
    return Date.now() - new Date(user.last_seen_at).getTime() < ONLINE_THRESHOLD_MS;
  };

  const handleRoleChange = async (user: any, roleId: string) => {
    setLoading(true);
    try {
      const updated = { ...user, role_id: roleId || null };
      await queueOfflineWrite('users', 'update', user.id, updated);
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <UsersIcon className="h-6 w-6" />
          المستخدمون والأجهزة
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          متابعة كل المستخدمين (بمن فيهم مندوبو المبيعات)، إصدار التطبيق المستخدم، ونوع الجهاز، وآخر ظهور، مع إمكانية تعيين الدور لكل مستخدم.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 px-4 text-right font-medium text-gray-500">الحالة</th>
              <th className="py-3 px-4 text-right font-medium text-gray-500">الاسم</th>
              <th className="py-3 px-4 text-right font-medium text-gray-500">البريد الإلكتروني</th>
              <th className="py-3 px-4 text-right font-medium text-gray-500">الدور</th>
              <th className="py-3 px-4 text-right font-medium text-gray-500">آخر ظهور</th>
              <th className="py-3 px-4 text-right font-medium text-gray-500">إصدار التطبيق</th>
              <th className="py-3 px-4 text-right font-medium text-gray-500">الجهاز</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u: any) => (
              <tr key={u.id}>
                <td className="py-3 px-4">
                  {isOnline(u) ? (
                    <span className="inline-flex items-center gap-1 text-green-600 text-xs font-bold">
                      <Wifi className="h-3.5 w-3.5" /> متصل الآن
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-gray-400 text-xs font-bold">
                      <WifiOff className="h-3.5 w-3.5" /> غير متصل
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 font-medium text-gray-800">{u.name || '-'}</td>
                <td className="py-3 px-4 text-gray-600 font-mono text-xs">{u.email}</td>
                <td className="py-3 px-4">
                  <select
                    value={u.role_id || ''}
                    disabled={loading || u.role_id === '88888888-8888-8888-8888-888888888888'}
                    onChange={(e) => handleRoleChange(u, e.target.value)}
                    className="rounded border border-gray-300 py-1 px-2 text-xs bg-white disabled:bg-gray-100"
                  >
                    <option value="">-- بدون دور --</option>
                    {roles.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3 px-4 text-gray-600 text-xs whitespace-nowrap">
                  {u.last_seen_at ? new Date(u.last_seen_at).toLocaleString('ar-EG') : 'لم يسجل الدخول بعد'}
                </td>
                <td className="py-3 px-4 font-mono text-xs">{u.app_version || '-'}</td>
                <td className="py-3 px-4 text-xs">{u.platform || '-'}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-400">
                  لا يوجد مستخدمون بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
