import React from 'react';
import { useDashboard } from '../../application/hooks/use-dashboard';
import {
  RefreshCw,
  TrendingUp,
  CreditCard,
  AlertTriangle
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { stats, lowStockItems, loading, error, loadDashboardStats } = useDashboard();

  React.useEffect(() => {
    const interval = setInterval(loadDashboardStats, 5000); // Refresh stats every 5 seconds
    return () => clearInterval(interval);
  }, [loadDashboardStats]);

  if (loading && stats.todaySales === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <RefreshCw className="animate-spin ml-2" size={20} />
        جاري التحميل...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24 text-red-500">
        <AlertTriangle className="ml-2" size={20} />
        {error}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">نظرة عامة / Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">المؤشرات المالية والمخزنية لمصنع لواصق ختم الإطارات الجاري</p>
        </div>
        <button
          onClick={loadDashboardStats}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {/* Dashboard Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-lg border shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500">مبيعات اليوم الفعلية</span>
            <div className="text-2xl font-black text-gray-900">{stats.todaySales.toFixed(2)} ج.م</div>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-full">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500">السيولة النقدية المتاحة (كاش وبنك)</span>
            <div className="text-2xl font-black text-gray-900">{stats.cashBank.toFixed(2)} ج.م</div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
            <CreditCard className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500">تنبيهات نقص المخزون</span>
            <div className="text-2xl font-black text-gray-900">{stats.lowStockCount} أصناف</div>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-full">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500">العمليات بانتظار المزامنة</span>
            <div className="text-2xl font-black text-gray-900">{stats.pendingSync} عمليات</div>
          </div>
          <div className="p-3 bg-yellow-50 text-yellow-600 rounded-full">
            <RefreshCw className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Low Stock Alerts Table */}
      {lowStockItems.length > 0 && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-1.5 text-sm text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span>تنبيه عاجل: أصناف قاربت على النفاد (حد إعادة الطلب):</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-right text-sm">
              <thead className="bg-gray-50">
                <tr className="text-xs font-bold text-gray-500">
                  <th className="py-3 px-4">اسم الصنف</th>
                  <th className="py-3 px-4">نوع المادة</th>
                  <th className="py-3 px-4 text-center">الرصيد الفعلي الحالي</th>
                  <th className="py-3 px-4">حد الأمان المطلق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lowStockItems.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50 font-medium">
                    <td className="py-3 px-4 text-red-700 font-bold">{item.name}</td>
                    <td className="py-3 px-4 text-gray-600">{item.type}</td>
                    <td className="py-3 px-4 text-center font-bold text-red-600 font-mono">{item.currentStock}</td>
                    <td className="py-3 px-4 text-gray-500">{item.reorder_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};