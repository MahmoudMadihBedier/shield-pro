import { useState, useEffect, lazy, Suspense, type ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './application/services/auth-service';
import { Auth } from './presentation/components/Auth';
import { PendingApproval } from './presentation/components/PendingApproval';
import { CRMClientPortal } from './presentation/components/CRMClientPortal';
import { ToastProvider } from './presentation/components/ui/Toast';
import { subscribeToSync } from './infrastructure/sync/sync-service';
import { db, type OfflineQueueItem } from './infrastructure/database/dexie';
import { useLocationTracking } from './application/hooks/use-location-tracking';
import { NotificationBell } from './presentation/components/NotificationBell';
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
  Smartphone,
  MapPin,
  FileText,
  Wallet,
  PanelRightClose,
  PanelRightOpen,
  type LucideIcon
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
const RepLedger = lazy(() => import('./presentation/components/RepLedger').then(m => ({ default: m.RepLedger })));
const DistributionOrders = lazy(() => import('./presentation/components/DistributionOrders').then(m => ({ default: m.DistributionOrders })));
const FraudAndApprovals = lazy(() => import('./presentation/components/FraudAndApprovals').then(m => ({ default: m.FraudAndApprovals })));
const InventoryControls = lazy(() => import('./presentation/components/InventoryControls').then(m => ({ default: m.InventoryControls })));
const Dashboard = lazy(() => import('./presentation/pages/Dashboard').then(m => ({ default: m.Dashboard })));

const ModuleLoadingFallback = () => (
  <div className="flex items-center justify-center py-24 text-gray-500">
    <RefreshCw className="animate-spin ml-2" size={20} />
    جاري التحميل...
  </div>
);

// Single source of truth for the sidebar nav AND the mobile header title.
// `perm` is [module, action] passed to checkPermission; omit for always-visible.
type NavItem = {
  tab: string;
  label: string;
  icon: LucideIcon;
  component: ComponentType;
  perm?: [string, 'view' | 'add' | 'edit' | 'delete'];
};

const NAV_ITEMS: NavItem[] = [
  { tab: 'dashboard', label: 'لوحة التحكم والمؤشرات', icon: LayoutDashboard, component: Dashboard },
  { tab: 'tasks', label: 'مهامي والبلاغات', icon: FileText, component: Tasks },
  { tab: 'sales', label: 'المبيعات والعملاء', icon: ShoppingCart, component: Sales, perm: ['sales', 'view'] },
  { tab: 'purchases', label: 'المشتريات والموردين', icon: Users, component: Purchases, perm: ['purchases', 'view'] },
  { tab: 'inventory', label: 'المخزون والمستودعات', icon: Package, component: Inventory, perm: ['inventory', 'view'] },
  { tab: 'manufacturing', label: 'التصنيع والتركيبات', icon: Layers, component: Manufacturing, perm: ['manufacturing', 'view'] },
  { tab: 'accounting', label: 'الحسابات والمالية', icon: DollarSign, component: Accounting, perm: ['accounting', 'view'] },
  { tab: 'hr', label: 'الموظفين والرواتب', icon: Briefcase, component: HR, perm: ['hr', 'view'] },
  { tab: 'reports', label: 'التقارير والتحليلات', icon: BarChart3, component: Reports, perm: ['reports', 'view'] },
  { tab: 'users', label: 'المستخدمون والأجهزة', icon: Smartphone, component: UsersDevices, perm: ['user_tracking', 'view'] },
  { tab: 'gps', label: 'تتبع المندوبين', icon: MapPin, component: RepTracking, perm: ['gps_tracking', 'view'] },
  { tab: 'rep_ledger', label: 'عهدة المندوبين', icon: Wallet, component: RepLedger, perm: ['sales', 'view'] },
  { tab: 'distribution', label: 'توزيع الفروع', icon: Package, component: DistributionOrders, perm: ['inventory', 'view'] },
  { tab: 'fraud', label: 'الاستثناءات والاحتيال', icon: ShieldAlert, component: FraudAndApprovals, perm: ['settings', 'view'] },
  { tab: 'inventory_controls', label: 'ضوابط المخزون (QC/جرد)', icon: Layers, component: InventoryControls, perm: ['inventory', 'view'] },
  { tab: 'settings', label: 'الإعدادات والصلاحيات', icon: SettingsIcon, component: Settings, perm: ['settings', 'view'] },
];

const DESKTOP_MQ = '(min-width: 768px)';
const isDesktop = () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_MQ).matches;

function ERPAppContent() {
  const { user, profile, signOut, checkPermission } = useAuth();
  // Drawer starts open on desktop, closed on phones so it never covers the app on load.
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);
  // Desktop-only "collapse to icon rail" preference, remembered per browser.
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === '1'; } catch { return false; }
  });
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

  // Keep the drawer sensible across viewport changes: auto-open when the
  // window grows to desktop, auto-close when it shrinks to mobile.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const onChange = (e: MediaQueryListEvent) => setSidebarOpen(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Lock body scroll + allow Escape to close while the mobile drawer is open.
  useEffect(() => {
    if (!sidebarOpen || isDesktop()) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [sidebarOpen]);

  const toggleRail = () => {
    setRailCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('sidebar_collapsed', next ? '1' : '0'); } catch { /* private mode */ }
      return next;
    });
  };

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

  // If this is a client portal user, show the CRM Client Portal instead of ERP
  if (profile?.is_client_user) {
    return <CRMClientPortal />;
  }

  const visibleNav = NAV_ITEMS.filter((n) => !n.perm || checkPermission(n.perm[0], n.perm[1]));
  const activeItem = NAV_ITEMS.find((n) => n.tab === activeTab);
  const ActiveComponent = activeItem?.component ?? Dashboard;

  const selectTab = (tab: string) => {
    setActiveTab(tab);
    if (!isDesktop()) setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row" dir="rtl">
      {/* Backdrop — mobile only, click to dismiss the drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation — off-canvas drawer on mobile (anchored to the
          RTL start edge = right), in-flow rail/panel on desktop */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex flex-col bg-gray-900 text-gray-100
          transition-[transform,width] duration-300 ease-in-out
          w-64 ${railCollapsed ? 'md:w-20' : 'md:w-64'}
          md:relative md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 bg-gray-950 border-b border-gray-800 shrink-0">
          <div className={`flex items-center gap-2 ${railCollapsed ? 'md:justify-center md:w-full' : ''}`}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              <ShieldAlert className="h-7 w-7 text-blue-500 shrink-0" />
            </motion.div>
            <span className={`font-extrabold text-lg text-white whitespace-nowrap ${railCollapsed ? 'md:hidden' : ''}`}>
              شيلد برو ERP
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-gray-400 hover:text-white"
            aria-label="إغلاق القائمة"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Sidebar Profile Card */}
        <div className={`p-4 border-b border-gray-800 bg-gray-900/50 shrink-0 ${railCollapsed ? 'md:hidden' : ''}`}>
          <div className="text-xs text-gray-400 font-bold">الموظف الحالي:</div>
          <div className="font-bold text-sm mt-1 text-white truncate">{profile?.name || user.email?.split('@')[0]}</div>
          <div className="text-[10px] text-blue-400 font-bold mt-0.5">{profile?.role_name || 'مستخدم النظام'}</div>
        </div>

        {/* Sidebar Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map(({ tab, label, icon: Icon }) => (
            <motion.button
              key={tab}
              onClick={() => selectTab(tab)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              title={railCollapsed ? label : undefined}
              aria-current={activeTab === tab ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition
                ${railCollapsed ? 'md:justify-center' : ''}
                ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={railCollapsed ? 'md:hidden' : ''}>{label}</span>
            </motion.button>
          ))}

          <motion.button
            onClick={handleLogout}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title={railCollapsed ? 'تسجيل الخروج' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold text-red-400 hover:bg-red-950/30 hover:text-red-300 transition
              ${railCollapsed ? 'md:justify-center' : ''}`}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={railCollapsed ? 'md:hidden' : ''}>تسجيل الخروج</span>
          </motion.button>
        </nav>
      </aside>

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header Bar */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 sm:px-6 shadow-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile: open drawer */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-gray-500 hover:text-gray-700"
              aria-label="فتح القائمة"
              aria-expanded={sidebarOpen}
            >
              <Menu className="h-6 w-6" />
            </button>
            {/* Desktop: collapse / expand the icon rail */}
            <button
              onClick={toggleRail}
              className="hidden md:inline-flex text-gray-500 hover:text-gray-700"
              aria-label={railCollapsed ? 'توسيع القائمة الجانبية' : 'طيّ القائمة الجانبية'}
              aria-expanded={!railCollapsed}
            >
              {railCollapsed ? <PanelRightOpen className="h-5 w-5" /> : <PanelRightClose className="h-5 w-5" />}
            </button>
            <div className="font-bold text-gray-800 text-sm truncate">
              <span className="hidden md:inline">نظام إدارة المنشأة الموحد (ERP)</span>
              <span className="md:hidden">{activeItem?.label ?? 'شيلد برو'}</span>
            </div>
          </div>

          {/* Sync & Connectivity Badges */}
          <div className="flex items-center gap-2 sm:gap-4">
            {syncState?.pendingCount > 0 && (
              <button
                type="button"
                onClick={openPendingOperations}
                className="animate-pulse inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 hover:bg-yellow-200 transition"
                title="عرض العمليات بانتظار الرفع"
              >
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">{syncState.pendingCount} عملية بانتظار الرفع</span>
                <span className="sm:hidden">{syncState.pendingCount}</span>
              </button>
            )}

            {syncState?.status === 'offline' ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                <WifiOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">أوفلاين (محلي)</span>
              </span>
            ) : syncState?.status === 'syncing' ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">جاري المزامنة...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                <Wifi className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">متصل بالشبكة (أونلاين)</span>
              </span>
            )}

            <NotificationBell />
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
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

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
