import { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './application/services/auth-service';
import { Auth } from './presentation/components/Auth';
import { PendingApproval } from './presentation/components/PendingApproval';
import { ToastProvider } from './presentation/components/ui/Toast';
import { subscribeToSync } from './infrastructure/sync/sync-service';
import { db, type OfflineQueueItem } from './infrastructure/database/dexie';
import { useLocationTracking } from './application/hooks/use-location-tracking';
import {
  ShieldAlert,
  Menu,
  X,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Layers,
  DollarSign,
  Briefcase,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  Smartphone,
  MapPin,
  FileText
} from 'lucide-react';

const Settings = lazy(() => import('./presentation/components/Settings').then(m => ({ default: m.Settings })));
const Inventory = lazy(() => import('./presentation/pages/Inventory').then(m => ({ default: m.Inventory })));
const Manufacturing = lazy(() => import('./presentation/components/Manufacturing').then(m => ({ default: m.Manufacturing })));
const Sales = lazy(() => import('./presentation/components/Sales').then(m => ({ default: m.Sales })));
const Purchases = lazy(() => import('./presentation/components/Purchases').then(m => ({ default: m.Purchases })));
const Accounting = lazy(() => import('./presentation/components/Accounting').then(m => ({ default: m.Accounting })));
const HR = lazy(() => import('./presentation/components/HR').then(m => ({ default: m.HR })));
const Tasks = lazy(() => import('./presentation/components/Tasks').then(m => ({ default: m.Tasks })));
const Reports = lazy(() => import('./presentation/components/Reports').then(m => ({ default: m.Reports })));
const UsersDevices = lazy(() => import('./presentation/components/UsersDevices').then(m => ({ default: m.UsersDevices })));
const RepTracking = lazy(() => import('./presentation/components/RepTracking').then(m => ({ default: m.RepTracking })));
const Dashboard = lazy(() => import('./presentation/pages/Dashboard').then(m => ({ default: m.Dashboard })));

const ModuleLoadingFallback = () => (
  <div className="flex items-center justify-center py-24 text-gray-500">
    <RefreshCw className="animate-spin ml-2" size={20} />
    جاري التحميل...
  </div>
);

function ERPAppContent() {
  const { user, profile, signOut, checkPermission } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useLocationTracking(profile);

  // Sync state
  const [syncState, setSyncState] = useState<any>(null);
  const [showPendingOperations, setShowPendingOperations] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<OfflineQueueItem[]>([]);

  const describePendingOperation = (operation: OfflineQueueItem) => {
    const data = operation.data || {};
    const action = operation.action === 'insert' ? 'إضافة' : operation.action === 'update' ? 'تحديث' : 'حذف';
    const names: Record<string, string> = {
      tasks: data.title ? `مهمة: ${data.title}` : 'مهمة',
      employee_reports: 'بلاغ موظف',
      bonuses: 'مكافأة موظف',
      punishments: 'خصم أو عقوبة موظف',
      sales_invoices: data.invoice_no ? `فاتورة مبيعات ${data.invoice_no}` : 'فاتورة مبيعات',
      purchase_invoices: data.invoice_no ? `فاتورة مشتريات ${data.invoice_no}` : 'فاتورة مشتريات',
      customers: data.name ? `عميل: ${data.name}` : 'عميل',
      suppliers: data.name ? `مورد: ${data.name}` : 'مورد',
      items: data.name ? `صنف: ${data.name}` : 'صنف مخزون',
      employees: data.name ? `ملف موظف: ${data.name}` : 'ملف موظف',
      attendance: 'تسجيل حضور وانصراف',
      payroll_runs: 'مسير رواتب',
      receipt_vouchers: 'إيصال قبض',
      payment_vouchers: 'إيصال صرف',
      stock_movements: 'حركة مخزون',
      production_batches: data.batch_no ? `أمر إنتاج ${data.batch_no}` : 'أمر إنتاج'
    };
    return `${action} ${names[operation.table_name] || 'بيانات في النظام'}`;
  };

  const openPendingOperations = async () => {
    const operations = await db.offline_queue
      .where('table_name')
      .notEqual('audit_log')
      .sortBy('timestamp');
    setPendingOperations(operations);
    setShowPendingOperations(true);
  };

  useEffect(() => {
    if (user) {
      const unsub = subscribeToSync((state) => {
        setSyncState(state);
      });

      return () => {
        unsub();
      };
    }
  }, [user]);

  if (!user) {
    return <Auth />;
  }

  const handleLogout = async () => {
    if (window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟')) {
      await signOut();
    }
  };

  // Account exists and is authenticated, but the Master Admin hasn't
  // assigned a role_id yet (new signups get role_id = null until reviewed
  // in Users & Devices) — every checkPermission() call would deny anyway,
  // so show a clear pending-review state instead of an empty app shell.
  if (profile && !profile.role_id && profile.role_name !== 'Master Admin') {
    return <PendingApproval profile={profile} onSignOut={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row" dir="rtl">
      {/* Sidebar Navigation */}
      <motion.div 
        initial={{ x: -260 }}
        animate={{ x: sidebarOpen ? 0 : -260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={`fixed inset-y-0 right-0 z-40 w-64 bg-gray-900 text-gray-100 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-6 bg-gray-950 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <ShieldAlert className="h-7 w-7 text-blue-500" />
            </motion.div>
            <span className="font-extrabold text-lg text-white">شيلد برو ERP</span>
          </div>
          <motion.button 
            onClick={() => setSidebarOpen(false)} 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="md:hidden text-gray-400 hover:text-white"
          >
            <X className="h-6 w-6" />
          </motion.button>
        </div>

        {/* Sidebar Profile Card */}
        <div className="p-4 border-b border-gray-800 bg-gray-900/50">
          <div className="text-xs text-gray-400 font-bold">الموظف الحالي:</div>
          <div className="font-bold text-sm mt-1 text-white">{profile?.name || user.email?.split('@')[0]}</div>
          <div className="text-[10px] text-blue-400 font-bold mt-0.5">{profile?.role_name || 'مستخدم النظام'}</div>
        </div>

        {/* Sidebar Links */}
        <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          <motion.button
            onClick={() => setActiveTab('dashboard')}
            whileHover={{ scale: 1.02, x: 4 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
              activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>لوحة التحكم والمؤشرات</span>
          </motion.button>

          <motion.button
            onClick={() => setActiveTab('tasks')}
            whileHover={{ scale: 1.02, x: 4 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
              activeTab === 'tasks' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <FileText className="h-5 w-5" />
            <span>مهامي والبلاغات</span>
          </motion.button>

          {checkPermission('sales', 'view') && (
            <motion.button
              onClick={() => setActiveTab('sales')}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'sales' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <ShoppingCart className="h-5 w-5" />
              <span>المبيعات والعملاء</span>
            </motion.button>
          )}

          {checkPermission('purchases', 'view') && (
            <motion.button
              onClick={() => setActiveTab('purchases')}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'purchases' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Users className="h-5 w-5" />
              <span>المشتريات والموردين</span>
            </motion.button>
          )}

          {checkPermission('inventory', 'view') && (
            <motion.button
              onClick={() => setActiveTab('inventory')}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'inventory' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Package className="h-5 w-5" />
              <span>المخزون والمستودعات</span>
            </motion.button>
          )}

          {checkPermission('manufacturing', 'view') && (
            <motion.button
              onClick={() => setActiveTab('manufacturing')}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'manufacturing' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Layers className="h-5 w-5" />
              <span>التصنيع والتركيبات</span>
            </motion.button>
          )}

          {checkPermission('accounting', 'view') && (
            <motion.button
              onClick={() => setActiveTab('accounting')}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'accounting' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <DollarSign className="h-5 w-5" />
              <span>الحسابات والمالية</span>
            </motion.button>
          )}

          {checkPermission('hr', 'view') && (
            <motion.button
              onClick={() => setActiveTab('hr')}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'hr' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Briefcase className="h-5 w-5" />
              <span>الموظفين والرواتب</span>
            </motion.button>
          )}

          {checkPermission('reports', 'view') && (
            <motion.button
              onClick={() => setActiveTab('reports')}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'reports' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <BarChart3 className="h-5 w-5" />
              <span>التقارير والتحليلات</span>
            </motion.button>
          )}

          {checkPermission('user_tracking', 'view') && (
            <motion.button
              onClick={() => setActiveTab('users')}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Smartphone className="h-5 w-5" />
              <span>المستخدمون والأجهزة</span>
            </motion.button>
          )}

          {checkPermission('gps_tracking', 'view') && (
            <motion.button
              onClick={() => setActiveTab('gps')}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'gps' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <MapPin className="h-5 w-5" />
              <span>تتبع المندوبين</span>
            </motion.button>
          )}

          {checkPermission('settings', 'view') && (
            <motion.button
              onClick={() => setActiveTab('settings')}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <SettingsIcon className="h-5 w-5" />
              <span>الإعدادات والصلاحيات</span>
            </motion.button>
          )}

          <motion.button
            onClick={handleLogout}
            whileHover={{ scale: 1.02, x: 4 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold text-red-400 hover:bg-red-950/30 hover:text-red-300 transition"
          >
            <LogOut className="h-5 w-5" />
            <span>تسجيل الخروج</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Main App Content Area */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex-1 flex flex-col min-h-screen"
      >
        {/* Header Bar */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <motion.button 
              onClick={() => setSidebarOpen(true)} 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="md:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu className="h-6 w-6" />
            </motion.button>
            <div className="hidden md:block font-bold text-gray-800 text-sm">
              نظام إدارة المنشأة الموحد (ERP)
            </div>
          </div>

          {/* Sync & Connectivity Badges */}
          <div className="flex items-center gap-4">
            {/* Sync Queue Pending Indicator */}
            {syncState?.pendingCount > 0 && (
              <button
                type="button"
                onClick={openPendingOperations}
                className="animate-pulse inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 hover:bg-yellow-200 transition"
                title="عرض العمليات بانتظار الرفع"
              >
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>{syncState.pendingCount} عملية بانتظار الرفع</span>
              </button>
            )}

            {/* Connectivity Status Badge */}
            {syncState?.status === 'offline' ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                <WifiOff className="h-3.5 w-3.5" />
                <span>أوفلاين (محلي)</span>
              </span>
            ) : syncState?.status === 'syncing' ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>جاري المزامنة...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                <Wifi className="h-3.5 w-3.5" />
                <span>متصل بالشبكة (أونلاين)</span>
              </span>
            )}

            <div className="relative">
              <Bell className="h-6 w-6 text-gray-400 hover:text-gray-600 cursor-pointer" />
            </div>
          </div>
        </header>

        {showPendingOperations && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4" onClick={() => setShowPendingOperations(false)}>
            <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h2 className="font-bold text-gray-900">عمليات بانتظار الرفع</h2>
                  <p className="mt-1 text-xs text-gray-500">سيتم حفظ هذه العمليات تلقائياً عند عودة الاتصال.</p>
                </div>
                <button type="button" onClick={() => setShowPendingOperations(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="إغلاق">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto p-5">
                {pendingOperations.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">لا توجد عمليات معلقة الآن.</p>
                ) : pendingOperations.map((operation) => (
                  <div key={operation.id} className="rounded-lg border border-yellow-100 bg-yellow-50 px-3 py-2 text-sm font-medium text-gray-700">
                    {describePendingOperation(operation)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modules Body */}
        <main className="flex-1 bg-gray-50 overflow-y-auto">
          <Suspense fallback={<ModuleLoadingFallback />}>
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Dashboard />
                </motion.div>
              )}
              {activeTab === 'tasks' && (
                <motion.div
                  key="tasks"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Tasks />
                </motion.div>
              )}
              {activeTab === 'sales' && (
                <motion.div
                  key="sales"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sales />
                </motion.div>
              )}
              {activeTab === 'purchases' && (
                <motion.div
                  key="purchases"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Purchases />
                </motion.div>
              )}
              {activeTab === 'inventory' && (
                <motion.div
                  key="inventory"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Inventory />
                </motion.div>
              )}
              {activeTab === 'manufacturing' && (
                <motion.div
                  key="manufacturing"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Manufacturing />
                </motion.div>
              )}
              {activeTab === 'accounting' && (
                <motion.div
                  key="accounting"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Accounting />
                </motion.div>
              )}
              {activeTab === 'hr' && (
                <motion.div
                  key="hr"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <HR />
                </motion.div>
              )}
              {activeTab === 'reports' && (
                <motion.div
                  key="reports"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Reports />
                </motion.div>
              )}
              {activeTab === 'users' && (
                <motion.div
                  key="users"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <UsersDevices />
                </motion.div>
              )}
              {activeTab === 'gps' && (
                <motion.div
                  key="gps"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <RepTracking />
                </motion.div>
              )}
              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Settings />
                </motion.div>
              )}
            </AnimatePresence>
          </Suspense>
        </main>
      </motion.div>
    </div>
  );
};

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ERPAppContent />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
