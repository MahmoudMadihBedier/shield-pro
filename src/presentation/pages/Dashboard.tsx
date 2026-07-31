import React from 'react';
import { motion } from 'framer-motion';
import { useDashboard } from '../../application/hooks/use-dashboard';
import {
  RefreshCw,
  TrendingUp,
  CreditCard,
  AlertTriangle
} from 'lucide-react';
import { CardAnimation, ListItemAnimation } from '../components/ui/animations/CardAnimation';
import { useToast } from '../components/ui/Toast';

export const Dashboard: React.FC = () => {
  const { stats, lowStockItems, loading, error, loadDashboardStats } = useDashboard();
  const { info } = useToast();

  React.useEffect(() => {
    const interval = setInterval(loadDashboardStats, 5000); // Refresh stats every 5 seconds
    return () => clearInterval(interval);
  }, [loadDashboardStats]);

  const handleRefresh = () => {
    loadDashboardStats();
    info('تم تحديث البيانات بنجاح');
  };

  if (loading && stats.todaySales === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="ml-2"
        >
          <RefreshCw size={20} />
        </motion.div>
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

  const StatCard = ({ title, value, icon, bgColor, iconColor, delay }: any) => (
    <CardAnimation delay={delay} hover>
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="bg-white p-5 rounded-lg border shadow-sm flex items-center justify-between"
      >
        <div className="space-y-1">
          <span className="text-xs font-bold text-gray-500">{title}</span>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.2 }}
            className="text-2xl font-black text-gray-900"
          >
            {value}
          </motion.div>
        </div>
        <div className={`p-3 ${bgColor} ${iconColor} rounded-full`}>
          {icon}
        </div>
      </motion.div>
    </CardAnimation>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">نظرة عامة / Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">المؤشرات المالية والمخزنية لمصنع لواصق ختم الإطارات الجاري</p>
        </div>
        <motion.button
          onClick={handleRefresh}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition shadow-md"
        >
          <motion.div
            animate={loading ? { rotate: 360 } : {}}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw className="h-4 w-4" />
          </motion.div>
          تحديث
        </motion.button>
      </motion.div>

      {/* Dashboard Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="مبيعات اليوم الفعلية"
          value={`${stats.todaySales.toFixed(2)} ج.م`}
          icon={<TrendingUp className="h-6 w-6" />}
          bgColor="bg-green-50"
          iconColor="text-green-600"
          delay={0.1}
        />
        <StatCard
          title="السيولة النقدية المتاحة (كاش وبنك)"
          value={`${stats.cashBank.toFixed(2)} ج.م`}
          icon={<CreditCard className="h-6 w-6" />}
          bgColor="bg-blue-50"
          iconColor="text-blue-600"
          delay={0.2}
        />
        <StatCard
          title="تنبيهات نقص المخزون"
          value={`${stats.lowStockCount} أصناف`}
          icon={<AlertTriangle className="h-6 w-6" />}
          bgColor="bg-red-50"
          iconColor="text-red-600"
          delay={0.3}
        />
        <StatCard
          title="العمليات بانتظار المزامنة"
          value={`${stats.pendingSync} عمليات`}
          icon={<RefreshCw className="h-6 w-6" />}
          bgColor="bg-yellow-50"
          iconColor="text-yellow-600"
          delay={0.4}
        />
      </div>

      {/* Low Stock Alerts Table */}
      {lowStockItems.length > 0 && (
        <CardAnimation delay={0.5}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-lg border shadow-sm"
          >
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-1.5 text-sm text-red-600">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <AlertTriangle className="h-5 w-5" />
              </motion.div>
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
                  {lowStockItems.map((item: any, index: number) => (
                    <ListItemAnimation key={item.id} index={index}>
                      <tr className="hover:bg-red-50 font-medium transition-colors">
                        <td className="py-3 px-4 text-red-700 font-bold">{item.name}</td>
                        <td className="py-3 px-4 text-gray-600">{item.type}</td>
                        <td className="py-3 px-4 text-center font-bold text-red-600 font-mono">{item.currentStock}</td>
                        <td className="py-3 px-4 text-gray-500">{item.reorder_level}</td>
                      </tr>
                    </ListItemAnimation>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </CardAnimation>
      )}
    </div>
  );
};