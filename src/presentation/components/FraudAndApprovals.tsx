import React, { useCallback, useEffect, useState } from 'react';
import { db } from '../../infrastructure/database/dexie';
import { ServiceFactory } from '../../application/services/service-factory';
import { useAuth } from '../../application/services/auth-service';
import { useToast } from './ui/Toast';
import { getErrorMessage } from '../../shared/utils/errors';
import { ShieldAlert, ListChecks } from 'lucide-react';

// Phase 2.2 (approval-rule evaluation log — "exceptions needing attention"
// vs. routine, so the Administrator isn't drowning in rubber-stamp clicks)
// and Phase 2.3 (round-tripping detection) in one screen, since both feed
// the same "what needs a human look today" purpose.
export const FraudAndApprovals: React.FC = () => {
  const { profile } = useAuth();
  const { success, error } = useToast();
  const fraudDetectionService = ServiceFactory.getFraudDetectionService();

  const [ruleLog, setRuleLog] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    const [log, openFlags, listUsers, listItems] = await Promise.all([
      db.approval_rule_log.orderBy('created_at').reverse().limit(50).toArray(),
      fraudDetectionService.getOpenFlags(),
      db.users.toArray(),
      db.items.toArray()
    ]);
    setRuleLog(log);
    setFlags(openFlags);
    setUsers(listUsers);
    setItems(listItems);
  }, [fraudDetectionService]);

  useEffect(() => { loadData(); }, [loadData]);

  const userName = (id: string) => users.find((u) => u.id === id)?.name || id;
  const itemName = (id: string) => items.find((i) => i.id === id)?.name || id;

  const handleRunDetection = async () => {
    setLoading(true);
    try {
      const newFlags = await fraudDetectionService.detectRoundTripping();
      success(newFlags.length > 0 ? `تم رصد ${newFlags.length} نمط جديد يستحق المراجعة` : 'لا توجد أنماط جديدة مشبوهة');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل فحص الأنماط'));
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (flagId: string, status: 'reviewed' | 'dismissed') => {
    if (!profile?.id) return;
    try {
      await fraudDetectionService.reviewFlag(flagId, profile.id, status);
      success('تم تحديث حالة الملاحظة');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل تحديث الحالة'));
    }
  };

  const exceptions = ruleLog.filter((l) => l.outcome === 'manual_review_required');

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldAlert className="h-6 w-6" />
          الاستثناءات ومؤشرات الاحتيال
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          الطلبات التي تستحق مراجعة يدوية (تجاوزت الحد المسموح أو تكررت بشكل غير معتاد)، وأنماط حركة البضاعة المشبوهة.
        </p>
      </div>

      <div className="bg-white p-5 rounded-lg border shadow">
        <div className="flex items-center justify-between border-b pb-2 mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            أنماط مشبوهة (بضاعة تتردد بين الصرف والإرجاع)
          </h3>
          <button onClick={handleRunDetection} disabled={loading} className="text-xs bg-red-100 text-red-800 px-3 py-1.5 rounded hover:bg-red-200 disabled:opacity-50">
            فحص الآن
          </button>
        </div>
        {flags.length === 0 ? (
          <p className="text-gray-400 text-sm">لا توجد ملاحظات مفتوحة حالياً.</p>
        ) : (
          <div className="space-y-2">
            {flags.map((f) => (
              <div key={f.id} className="border rounded p-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-bold">{userName(f.actor_id)}</span> — {itemName(f.item_id)}
                  <span className="text-xs text-gray-500 block">
                    صادر: {f.details?.issued} / راجع: {f.details?.returned} (نسبة {((f.details?.ratio || 0) * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleReview(f.id, 'reviewed')} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">تمت المراجعة</button>
                  <button onClick={() => handleReview(f.id, 'dismissed')} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">تجاهل</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white p-5 rounded-lg border shadow">
        <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-yellow-600" />
          طلبات تحتاج مراجعة يدوية (آخر 50)
        </h3>
        {exceptions.length === 0 ? (
          <p className="text-gray-400 text-sm">لا توجد استثناءات حالياً — كل الطلبات الأخيرة كانت روتينية.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 text-right">
                <th className="py-2">النوع</th>
                <th className="py-2">مقدّم الطلب</th>
                <th className="py-2">الصنف</th>
                <th className="py-2">الكمية</th>
                <th className="py-2">السبب</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="py-2">{l.movement_type}</td>
                  <td className="py-2">{userName(l.actor_id)}</td>
                  <td className="py-2">{l.item_id ? itemName(l.item_id) : '-'}</td>
                  <td className="py-2 font-mono">{l.qty}</td>
                  <td className="py-2 text-xs text-gray-500">{l.rule_matched}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
