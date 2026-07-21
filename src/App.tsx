import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './lib/authContext';
import { Auth } from './components/Auth';
import { db } from './lib/dexie';
import { subscribeToSync } from './lib/sync';
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
  TrendingUp,
  CreditCard,
  AlertTriangle
} from 'lucide-react';

const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const Inventory = lazy(() => import('./components/Inventory').then(m => ({ default: m.Inventory })));
const Manufacturing = lazy(() => import('./components/Manufacturing').then(m => ({ default: m.Manufacturing })));
const Sales = lazy(() => import('./components/Sales').then(m => ({ default: m.Sales })));
const Purchases = lazy(() => import('./components/Purchases').then(m => ({ default: m.Purchases })));
const Accounting = lazy(() => import('./components/Accounting').then(m => ({ default: m.Accounting })));
const HR = lazy(() => import('./components/HR').then(m => ({ default: m.HR })));
const Reports = lazy(() => import('./components/Reports').then(m => ({ default: m.Reports })));

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

  // Sync state
  const [syncState, setSyncState] = useState<any>(null);

  // Dashboard Stats
  const [stats, setStats] = useState({
    todaySales: 0,
    cashBank: 0,
    lowStockCount: 0,
    pendingSync: 0
  });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadDashboardStats();
      const interval = setInterval(loadDashboardStats, 5000); // refresh stats

      const unsub = subscribeToSync((state) => {
        setSyncState(state);
      });

      return () => {
        clearInterval(interval);
        unsub();
      };
    }
  }, [user]);

  const loadDashboardStats = async () => {
    try {
      const itemsList = await db.items.toArray();
      const movements = await db.stock_movements.toArray();
      const invoices = await db.sales_invoices.toArray();
      const transactions = await db.account_transactions.toArray();
      const pendingSyncCount = await db.offline_queue.count();

      // Today's Sales
      const todayStr = new Date().toISOString().split('T')[0];
      const todaySalesSum = invoices
        .filter((inv: any) => inv.date === todayStr)
        .reduce((sum, inv) => sum + Number(inv.total), 0);

      // Cash & Bank balance from Transactions
      const cashBankAccounts = await db.accounts
        .filter((a: any) => a.category === 'cash' || a.category === 'bank')
        .toArray();
      const cashBankIds = cashBankAccounts.map(a => a.id);
      const cashBankSum = transactions
        .filter((tx: any) => cashBankIds.includes(tx.account_id))
        .reduce((sum, tx) => sum + Number(tx.debit) - Number(tx.credit), 0);

      // Low stock items
      const lowStock: any[] = [];
      let lowCount = 0;
      for (const item of itemsList) {
        const stock = movements
          .filter((m: any) => m.item_id === item.id)
          .reduce((sum, m) => sum + Number(m.qty), 0);
        if (stock <= Number(item.reorder_level)) {
          lowCount++;
          lowStock.push({ ...item, stock });
        }
      }

      setStats({
        todaySales: todaySalesSum,
        cashBank: cashBankSum,
        lowStockCount: lowCount,
        pendingSync: pendingSyncCount
      });
      setLowStockItems(lowStock.slice(0, 5));
    } catch (e) {
      console.error(e);
    }
  };

  if (!user) {
    return <Auth />;
  }

  const handleLogout = async () => {
    if (window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟')) {
      await signOut();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row" dir="rtl">
      {/* Sidebar Navigation */}
      <div className={`fixed inset-y-0 right-0 z-40 w-64 bg-gray-900 text-gray-100 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-6 bg-gray-950 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-blue-500" />
            <span className="font-extrabold text-lg text-white">شيلد برو ERP</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Sidebar Profile Card */}
        <div className="p-4 border-b border-gray-800 bg-gray-900/50">
          <div className="text-xs text-gray-400 font-bold">الموظف الحالي:</div>
          <div className="font-bold text-sm mt-1 text-white">{profile?.name || user.email?.split('@')[0]}</div>
          <div className="text-[10px] text-blue-400 font-bold mt-0.5">{profile?.role_name || 'مستخدم النظام'}</div>
        </div>

        {/* Sidebar Links */}
        <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
              activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>لوحة التحكم والمؤشرات</span>
          </button>

          {checkPermission('sales', 'view') && (
            <button
              onClick={() => setActiveTab('sales')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'sales' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <ShoppingCart className="h-5 w-5" />
              <span>المبيعات والعملاء</span>
            </button>
          )}

          {checkPermission('purchases', 'view') && (
            <button
              onClick={() => setActiveTab('purchases')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'purchases' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Users className="h-5 w-5" />
              <span>المشتريات والموردين</span>
            </button>
          )}

          {checkPermission('inventory', 'view') && (
            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'inventory' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Package className="h-5 w-5" />
              <span>المخزون والمستودعات</span>
            </button>
          )}

          {checkPermission('manufacturing', 'view') && (
            <button
              onClick={() => setActiveTab('manufacturing')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'manufacturing' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Layers className="h-5 w-5" />
              <span>التصنيع والتركيبات</span>
            </button>
          )}

          {checkPermission('accounting', 'view') && (
            <button
              onClick={() => setActiveTab('accounting')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'accounting' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <DollarSign className="h-5 w-5" />
              <span>الحسابات والمالية</span>
            </button>
          )}

          {checkPermission('hr', 'view') && (
            <button
              onClick={() => setActiveTab('hr')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'hr' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Briefcase className="h-5 w-5" />
              <span>الموظفين والرواتب</span>
            </button>
          )}

          {checkPermission('reports', 'view') && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'reports' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <BarChart3 className="h-5 w-5" />
              <span>التقارير والتحليلات</span>
            </button>
          )}

          {checkPermission('settings', 'view') && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
                activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <SettingsIcon className="h-5 w-5" />
              <span>الإعدادات والصلاحيات</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold text-red-400 hover:bg-red-950/30 hover:text-red-300 transition"
          >
            <LogOut className="h-5 w-5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header Bar */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-500 hover:text-gray-700">
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden md:block font-bold text-gray-800 text-sm">
              نظام إدارة المنشأة الموحد (ERP)
            </div>
          </div>

          {/* Sync & Connectivity Badges */}
          <div className="flex items-center gap-4">
            {/* Sync Queue Pending Indicator */}
            {syncState?.pendingCount > 0 && (
              <span className="animate-pulse inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>{syncState.pendingCount} عملية بانتظار الرفع</span>
              </span>
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
              {stats.lowStockCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none">
                  {stats.lowStockCount}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Modules Body */}
        <main className="flex-1 bg-gray-50 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <div className="p-6 max-w-7xl mx-auto space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">نظرة عامة / Dashboard</h1>
                  <p className="text-gray-500 text-sm mt-1">المؤشرات المالية والمخزنية لمصنع لواصق ختم الإطارات الجاري</p>
                </div>
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
                        {lowStockItems.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50 font-medium">
                            <td className="py-3 px-4 text-red-700 font-bold">{item.name}</td>
                            <td className="py-3 px-4 text-gray-600">{item.type}</td>
                            <td className="py-3 px-4 text-center font-bold text-red-600 font-mono">{item.stock}</td>
                            <td className="py-3 px-4 text-gray-500">{item.reorder_level}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <Suspense fallback={<ModuleLoadingFallback />}>
            {activeTab === 'sales' && <Sales />}
            {activeTab === 'purchases' && <Purchases />}
            {activeTab === 'inventory' && <Inventory />}
            {activeTab === 'manufacturing' && <Manufacturing />}
            {activeTab === 'accounting' && <Accounting />}
            {activeTab === 'hr' && <HR />}
            {activeTab === 'reports' && <Reports />}
            {activeTab === 'settings' && <Settings />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ERPAppContent />
    </AuthProvider>
  );
}

export default App;
