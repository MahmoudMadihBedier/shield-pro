import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../infrastructure/api/supabase';
import {
  ShoppingCart,
  Package,
  Truck,
  FileText,
  DollarSign,
  Bell,
  User,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
  LogOut
} from 'lucide-react';

type Customer = {
  id: string;
  client_id: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  opening_balance: number;
  credit_limit: number;
  credit_status: string;
  is_active: boolean;
};

type Order = {
  id: string;
  order_number: string;
  order_date: string;
  requested_delivery_date?: string;
  status: string;
  total_amount: number;
  payment_status: string;
  priority: string;
  delivery_address?: string;
  tracking_number?: string;
  delivery_status?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
};

type Invoice = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  tracking_number?: string;
  delivery_status?: string;
};

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: any;
};

type FinancialSummary = {
  customer_id: string;
  client_id: string;
  customer_name: string;
  opening_balance: number;
  credit_limit: number;
  total_invoiced: number;
  total_paid: number;
  current_balance: number;
  credit_status: string;
  last_order_date?: string;
  total_orders: number;
  total_purchased: number;
};

export function CRMClientPortal() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'invoices' | 'delivery' | 'profile'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  useEffect(() => {
    loadClientData();
    loadNotifications();
    // Set up real-time subscription for notifications
    const subscription = supabase
      .channel('client_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'client_notifications' }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadClientData = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load customer data
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (customerData) {
        setCustomer(customerData);

        // Load financial summary
        const { data: financialData } = await supabase
          .from('client_financial_summary')
          .select('*')
          .eq('customer_id', customerData.id)
          .single();

        setFinancialSummary(financialData);

        // Load orders
        const { data: ordersData } = await supabase
          .from('client_order_history')
          .select('*')
          .eq('customer_id', customerData.id)
          .order('order_date', { ascending: false });

        setOrders(ordersData || []);

        // Load invoices
        const { data: invoicesData } = await supabase
          .from('client_invoices')
          .select('*')
          .eq('customer_id', customerData.id)
          .order('invoice_date', { ascending: false });

        setInvoices(invoicesData || []);
      }
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get customer ID first
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (customerData) {
        const { data: notificationsData } = await supabase
          .from('client_notifications')
          .select('*')
          .eq('customer_id', customerData.id)
          .order('created_at', { ascending: false })
          .limit(20);

        setNotifications(notificationsData || []);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('client_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-blue-100 text-blue-800',
      'processing': 'bg-purple-100 text-purple-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'rejected': 'bg-red-100 text-red-800',
      'shipped': 'bg-blue-100 text-blue-800',
      'out_for_delivery': 'bg-orange-100 text-orange-800',
      'delivered': 'bg-green-100 text-green-800',
      'paid': 'bg-green-100 text-green-800',
      'partial': 'bg-yellow-100 text-yellow-800',
      'overdue': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'completed' || status === 'delivered' || status === 'paid') {
      return <CheckCircle className="h-4 w-4" />;
    } else if (status === 'cancelled' || status === 'rejected' || status === 'overdue') {
      return <XCircle className="h-4 w-4" />;
    } else {
      return <Clock className="h-4 w-4" />;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري تحميل البوابة...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">غير قادر على تحميل بيانات العميل</h2>
          <p className="text-gray-600 mb-6">لم يتم العثور على حساب عميل مرتبط بحسابك.</p>
          <button
            onClick={handleLogout}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-lg">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">بوابة العملاء</h1>
                <p className="text-xs text-gray-500">{customer.company_name || customer.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
                >
                  <Bell className="h-6 w-6" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-50">
                    <div className="p-4 border-b">
                      <h3 className="font-bold text-gray-900">الإشعارات</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-center text-gray-500">لا توجد إشعارات</p>
                      ) : (
                        notifications.map(notification => (
                          <div
                            key={notification.id}
                            onClick={() => markNotificationAsRead(notification.id)}
                            className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${
                              !notification.is_read ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-full ${
                                notification.type === 'order_status' ? 'bg-blue-100 text-blue-600' :
                                notification.type === 'payment_received' ? 'bg-green-100 text-green-600' :
                                notification.type === 'delivery_update' ? 'bg-orange-100 text-orange-600' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {notification.type === 'order_status' && <Package className="h-4 w-4" />}
                                {notification.type === 'payment_received' && <DollarSign className="h-4 w-4" />}
                                {notification.type === 'delivery_update' && <Truck className="h-4 w-4" />}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 text-sm">{notification.title}</p>
                                <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(notification.created_at).toLocaleDateString('ar-EG')}
                                </p>
                              </div>
                              {!notification.is_read && (
                                <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="flex items-center gap-2">
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                  <p className="text-xs text-gray-500">{customer.client_id}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                  title="تسجيل الخروج"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 space-x-reverse" aria-label="Tabs">
            {[
              { id: 'dashboard', label: 'لوحة التحكم', icon: <Package className="h-5 w-5" /> },
              { id: 'orders', label: 'طلباتي', icon: <ShoppingCart className="h-5 w-5" /> },
              { id: 'invoices', label: 'الفواتير', icon: <FileText className="h-5 w-5" /> },
              { id: 'delivery', label: 'التوصيل', icon: <Truck className="h-5 w-5" /> },
              { id: 'profile', label: 'الملف الشخصي', icon: <User className="h-5 w-5" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Financial Summary Cards */}
              {financialSummary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">الرصيد الحالي</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {financialSummary.current_balance.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-blue-100 p-3 rounded-full">
                        <DollarSign className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">حد الائتمان</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {financialSummary.credit_limit.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-green-100 p-3 rounded-full">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">إجمالي المشتريات</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {financialSummary.total_purchased.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-purple-100 p-3 rounded-full">
                        <ShoppingCart className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">عدد الطلبات</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {financialSummary.total_orders}
                        </p>
                      </div>
                      <div className="bg-orange-100 p-3 rounded-full">
                        <Package className="h-6 w-6 text-orange-600" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Orders */}
              <div className="bg-white rounded-lg shadow mb-8">
                <div className="px-6 py-4 border-b">
                  <h2 className="text-lg font-bold text-gray-900">أحدث الطلبات</h2>
                </div>
                <div className="divide-y">
                  {orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                         onClick={() => { setSelectedOrder(order); setShowOrderDetails(true); }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${getStatusColor(order.status)}`}>
                            {getStatusIcon(order.status)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{order.order_number}</p>
                            <p className="text-sm text-gray-500">{new Date(order.order_date).toLocaleDateString('ar-EG')}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-gray-900">{order.total_amount.toFixed(2)}</p>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <div className="px-6 py-8 text-center text-gray-500">
                      لا توجد طلبات حتى الآن
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button
                  onClick={() => setActiveTab('orders')}
                  className="bg-blue-600 text-white rounded-lg shadow p-6 hover:bg-blue-700 transition flex items-center gap-4"
                >
                  <Plus className="h-8 w-8" />
                  <div className="text-right">
                    <p className="font-bold">طلب جديد</p>
                    <p className="text-sm text-blue-100">إنشاء طلب جديد</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('delivery')}
                  className="bg-green-600 text-white rounded-lg shadow p-6 hover:bg-green-700 transition flex items-center gap-4"
                >
                  <Truck className="h-8 w-8" />
                  <div className="text-right">
                    <p className="font-bold">تتبع الشحنات</p>
                    <p className="text-sm text-green-100">حالة التوصيل</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('invoices')}
                  className="bg-purple-600 text-white rounded-lg shadow p-6 hover:bg-purple-700 transition flex items-center gap-4"
                >
                  <FileText className="h-8 w-8" />
                  <div className="text-right">
                    <p className="font-bold">الفواتير</p>
                    <p className="text-sm text-purple-100">عرض وسداد الفواتير</p>
                  </div>
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">طلباتي</h2>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    طلب جديد
                  </button>
                </div>
                <div className="divide-y">
                  {orders.map((order) => (
                    <div key={order.id} className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                         onClick={() => { setSelectedOrder(order); setShowOrderDetails(true); }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${getStatusColor(order.status)}`}>
                            {getStatusIcon(order.status)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{order.order_number}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(order.order_date).toLocaleDateString('ar-EG')}
                              {order.requested_delivery_date && ` • التسليم المطلوب: ${new Date(order.requested_delivery_date).toLocaleDateString('ar-EG')}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-gray-900">{order.total_amount.toFixed(2)}</p>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.payment_status)}`}>
                              {order.payment_status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <div className="px-6 py-8 text-center text-gray-500">
                      لا توجد طلبات حتى الآن
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'invoices' && (
            <motion.div
              key="invoices"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b">
                  <h2 className="text-lg font-bold text-gray-900">الفواتير</h2>
                </div>
                <div className="divide-y">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${getStatusColor(invoice.status)}`}>
                            {getStatusIcon(invoice.status)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{invoice.invoice_no}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(invoice.invoice_date).toLocaleDateString('ar-EG')}
                              {` • الاستحقاق: ${new Date(invoice.due_date).toLocaleDateString('ar-EG')}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-gray-900">{invoice.total_amount.toFixed(2)}</p>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                              {invoice.status}
                            </span>
                            <button className="text-blue-600 hover:text-blue-800">
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {invoices.length === 0 && (
                    <div className="px-6 py-8 text-center text-gray-500">
                      لا توجد فواتير حتى الآن
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'delivery' && (
            <motion.div
              key="delivery"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b">
                  <h2 className="text-lg font-bold text-gray-900">حالة التوصيل</h2>
                </div>
                <div className="divide-y">
                  {orders.filter(o => o.tracking_number).map((order) => (
                    <div key={order.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${getStatusColor(order.delivery_status || 'pending')}`}>
                            {getStatusIcon(order.delivery_status || 'pending')}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{order.order_number}</p>
                            <p className="text-sm text-gray-500">{order.tracking_number}</p>
                            {order.estimated_delivery_date && (
                              <p className="text-xs text-gray-400">
                                التسليم المتوقع: {new Date(order.estimated_delivery_date).toLocaleDateString('ar-EG')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-left">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.delivery_status || 'pending')}`}>
                            {order.delivery_status || 'قيد المعالجة'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {orders.filter(o => o.tracking_number).length === 0 && (
                    <div className="px-6 py-8 text-center text-gray-500">
                      لا توجد شحنات نشطة
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b">
                  <h2 className="text-lg font-bold text-gray-900">الملف الشخصي</h2>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-blue-100 p-4 rounded-full">
                      <User className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{customer.name}</h3>
                      <p className="text-gray-500">{customer.client_id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">اسم الشركة</label>
                      <p className="text-gray-900">{customer.company_name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                      <p className="text-gray-900">{customer.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                      <p className="text-gray-900">{customer.phone || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                      <p className="text-gray-900">{customer.address || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">حالة الائتمان</label>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(customer.credit_status)}`}>
                        {customer.credit_status}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${customer.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {customer.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">تفاصيل الطلب {selectedOrder.order_number}</h3>
              <button
                onClick={() => setShowOrderDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الطلب</label>
                  <p className="text-gray-900">{new Date(selectedOrder.order_date).toLocaleDateString('ar-EG')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ الإجمالي</label>
                  <p className="text-gray-900 font-bold">{selectedOrder.total_amount.toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">حالة الدفع</label>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.payment_status)}`}>
                    {selectedOrder.payment_status}
                  </span>
                </div>
                {selectedOrder.requested_delivery_date && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">التسليم المطلوب</label>
                    <p className="text-gray-900">{new Date(selectedOrder.requested_delivery_date).toLocaleDateString('ar-EG')}</p>
                  </div>
                )}
                {selectedOrder.tracking_number && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">رقم التتبع</label>
                    <p className="text-gray-900">{selectedOrder.tracking_number}</p>
                  </div>
                )}
              </div>
              {selectedOrder.delivery_address && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">عنوان التوصيل</label>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                    <p className="text-gray-900">{selectedOrder.delivery_address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}