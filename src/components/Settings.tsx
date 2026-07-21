import React, { useState, useEffect } from 'react';
import { db } from '../lib/dexie';
import { queueOfflineWrite, triggerSync, pullFromServer, subscribeToSync } from '../lib/sync';
import { getSetting, saveSetting } from '../lib/settingsHelper';
import {
  Save,
  Plus,
  Trash2,
  RefreshCw,
  Shield,
  FileText,
  Warehouse,
  History,
  Check,
  AlertCircle
} from 'lucide-react';

export const Settings: React.FC = () => {
  // Section states
  const [activeTab, setActiveTab] = useState<'general' | 'roles' | 'warehouses' | 'sync' | 'audit'>('general');
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // General Settings State
  const [companyName, setCompanyName] = useState('');
  const [companyTaxNo, setCompanyTaxNo] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatPct, setVatPct] = useState('14');
  const [printSize, setPrintSize] = useState('A4');
  const [discountLinesEnabled, setDiscountLinesEnabled] = useState(true);
  const [reorderAlertsEnabled, setReorderAlertsEnabled] = useState(true);
  const [expiryTrackingEnabled, setExpiryTrackingEnabled] = useState(false);
  const [laborOverheadPerUnit, setLaborOverheadPerUnit] = useState('0.5');

  // Roles & Permissions state
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [newRoleName, setNewRoleName] = useState('');
  const [permissions, setPermissions] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);

  // Warehouses state
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [newWhName, setNewWhName] = useState('');
  const [newWhLoc, setNewWhLoc] = useState('');
  const [multiWarehouseEnabled, setMultiWarehouseEnabled] = useState(false);

  // Sync state
  const [syncState, setSyncState] = useState<any>(null);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditUsers, setAuditUsers] = useState<any[]>([]);
  const [auditRetentionDays, setAuditRetentionDays] = useState('90');
  const [auditTableFilter, setAuditTableFilter] = useState('');

  useEffect(() => {
    loadGeneralSettings();
    loadRolesAndPermissions();
    loadWarehouses();
    loadAuditLog();

    const unsub = subscribeToSync((state) => {
      setSyncState(state);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAuditLog = async () => {
    const [logs, users] = await Promise.all([db.audit_log.toArray(), db.users.toArray()]);
    logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setAuditLogs(logs);
    setAuditUsers(users);
    setAuditRetentionDays(await getSetting('audit_log_retention_days', '90'));
  };

  const saveAuditRetention = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await saveSetting('audit_log_retention_days', auditRetentionDays);
      showNotification('success', 'تم حفظ مدة الاحتفاظ بسجل المراجعة بنجاح!');
    } finally {
      setLoading(false);
    }
  };

  const auditActionArabic: { [key: string]: string } = {
    insert: 'إضافة',
    update: 'تعديل',
    delete: 'حذف'
  };

  const loadGeneralSettings = async () => {
    setCompanyName(await getSetting('company_name', 'مؤسسة لواصق الإطارات الفورية'));
    setCompanyTaxNo(await getSetting('company_tax_no', '123-456-789'));
    setCompanyAddress(await getSetting('company_address', 'القاهرة، جمهورية مصر العربية'));
    setVatEnabled((await getSetting('vat_enabled')) === 'true');
    setVatPct(await getSetting('default_vat_pct', '14'));
    setPrintSize(await getSetting('print_size', 'A4'));
    setDiscountLinesEnabled((await getSetting('discount_lines_enabled', 'true')) === 'true');
    setReorderAlertsEnabled((await getSetting('reorder_alerts_enabled', 'true')) === 'true');
    setExpiryTrackingEnabled((await getSetting('expiry_tracking_enabled', 'false')) === 'true');
    setMultiWarehouseEnabled((await getSetting('multi_warehouse_enabled', 'false')) === 'true');
    setLaborOverheadPerUnit(await getSetting('labor_overhead_per_unit', '0.5'));
  };

  const loadRolesAndPermissions = async () => {
    const listRoles = await db.roles.toArray();
    setRoles(listRoles);
    if (listRoles.length > 0 && !selectedRoleId) {
      setSelectedRoleId(listRoles[0].id);
    }

    const listPerms = await db.permissions.toArray();
    setPermissions(listPerms);

    const listRp = await db.role_permissions.toArray();
    setRolePermissions(listRp);
  };

  const loadWarehouses = async () => {
    const listWh = await db.warehouses.toArray();
    setWarehouses(listWh);
  };

  const showNotification = (type: 'success' | 'error', text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const saveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await saveSetting('company_name', companyName);
      await saveSetting('company_tax_no', companyTaxNo);
      await saveSetting('company_address', companyAddress);
      await saveSetting('vat_enabled', String(vatEnabled));
      await saveSetting('default_vat_pct', vatPct);
      await saveSetting('print_size', printSize);
      await saveSetting('discount_lines_enabled', String(discountLinesEnabled));
      await saveSetting('reorder_alerts_enabled', String(reorderAlertsEnabled));
      await saveSetting('expiry_tracking_enabled', String(expiryTrackingEnabled));
      await saveSetting('multi_warehouse_enabled', String(multiWarehouseEnabled));
      await saveSetting('labor_overhead_per_unit', laborOverheadPerUnit);

      showNotification('success', 'تم حفظ الإعدادات العامة بنجاح!');
    } catch (err: any) {
      showNotification('error', `فشل الحفظ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      const id = crypto.randomUUID();
      const roleObj = { id, name: newRoleName.trim(), created_at: new Date().toISOString() };
      await queueOfflineWrite('roles', 'insert', id, roleObj);
      setNewRoleName('');
      await loadRolesAndPermissions();
      setSelectedRoleId(id);
      showNotification('success', 'تمت إضافة الدور الجديد!');
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const deleteRole = async (id: string) => {
    if (id === '88888888-8888-8888-8888-888888888888') {
      showNotification('error', 'لا يمكن حذف دور مدير النظام الأساسي.');
      return;
    }
    if (!window.confirm('هل أنت متأكد من حذف هذا الدور؟')) return;
    try {
      await queueOfflineWrite('roles', 'delete', id, null);
      await loadRolesAndPermissions();
      setSelectedRoleId(roles[0]?.id || '');
      showNotification('success', 'تم حذف الدور بنجاح.');
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handlePermissionToggle = async (permId: string, enabled: boolean) => {
    try {
      const existing = rolePermissions.find((rp: any) => rp.role_id === selectedRoleId && rp.permission_id === permId);
      if (enabled) {
        if (!existing) {
          const id = crypto.randomUUID();
          const rpObj = { id, role_id: selectedRoleId, permission_id: permId, created_at: new Date().toISOString() };
          await queueOfflineWrite('role_permissions', 'insert', id, rpObj);
        }
      } else {
        if (existing) {
          await queueOfflineWrite('role_permissions', 'delete', existing.id, null);
        }
      }
      await loadRolesAndPermissions();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const addWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhName.trim()) return;
    try {
      const id = crypto.randomUUID();
      const whObj = { id, name: newWhName.trim(), location: newWhLoc.trim(), is_active: true, created_at: new Date().toISOString() };
      await queueOfflineWrite('warehouses', 'insert', id, whObj);
      setNewWhName('');
      setNewWhLoc('');
      await loadWarehouses();
      showNotification('success', 'تمت إضافة المستودع بنجاح!');
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const toggleWarehouseActive = async (wh: any) => {
    try {
      const updated = { ...wh, is_active: !wh.is_active, updated_at: new Date().toISOString() };
      await queueOfflineWrite('warehouses', 'insert', wh.id, updated);
      await loadWarehouses();
      showNotification('success', 'تم تحديث حالة المستودع.');
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleTriggerSync = async () => {
    setLoading(true);
    try {
      await triggerSync();
      await loadGeneralSettings();
      await loadRolesAndPermissions();
      await loadWarehouses();
      showNotification('success', 'تمت المزامنة بنجاح!');
    } catch (err: any) {
      showNotification('error', `خطأ في المزامنة: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerPull = async () => {
    setLoading(true);
    try {
      await pullFromServer();
      await loadGeneralSettings();
      await loadRolesAndPermissions();
      await loadWarehouses();
      showNotification('success', 'تم جلب البيانات الحديثة من السيرفر بنجاح!');
    } catch (err: any) {
      showNotification('error', `خطأ في جلب البيانات: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Group permissions by module
  const modulesArabic: { [key: string]: string } = {
    sales: 'المبيعات',
    purchases: 'المشتريات',
    inventory: 'المخزون',
    manufacturing: 'التصنيع',
    accounting: 'الحسابات والمالية',
    hr: 'الموارد البشرية والرواتب',
    reports: 'التقارير والمؤشرات',
    settings: 'الإعدادات والصلاحيات'
  };

  const uniqueModules = Array.from(new Set(permissions.map((p: any) => p.module)));

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Alert Header */}
      {alertMsg && (
        <div className={`fixed top-4 left-4 right-4 z-50 rounded-lg p-4 shadow-lg flex items-center gap-2 ${
          alertMsg.type === 'success' ? 'bg-green-50 text-green-800 border-r-4 border-green-500' : 'bg-red-50 text-red-800 border-r-4 border-red-500'
        }`}>
          {alertMsg.type === 'success' ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="font-medium">{alertMsg.text}</span>
        </div>
      )}

      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إعدادات النظام / Settings</h1>
          <p className="text-gray-500 text-sm mt-1">تخصيص كامل للنظام والتحكم في الخصائص التشغيلية والصلاحيات والمزامنة</p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-lg p-1 shadow-sm">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeTab === 'general' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>الإعدادات العامة</span>
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeTab === 'roles' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>الأدوار والصلاحيات</span>
        </button>
        <button
          onClick={() => setActiveTab('warehouses')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeTab === 'warehouses' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Warehouse className="h-4 w-4" />
          <span>المستودعات والمخازن</span>
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeTab === 'sync' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <History className="h-4 w-4" />
          <span>المزامنة والأوفلاين</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeTab === 'audit' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          <span>سجل المراجعة</span>
        </button>
      </div>

      {/* Settings Body */}
      <div className="bg-white shadow rounded-lg p-6">
        {activeTab === 'general' && (
          <form onSubmit={saveGeneral} className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-3">الإعدادات العامة ومعلومات الفاتورة والضرائب</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">اسم الشركة (يظهر في المطبوعات)</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">الرقم الضريبي للمنشأة</label>
                <input
                  type="text"
                  required
                  value={companyTaxNo}
                  onChange={(e) => setCompanyTaxNo(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-left"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">عنوان الشركة / المنشأة</label>
                <input
                  type="text"
                  required
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">تفعيل ضريبة القيمة المضافة (VAT)</label>
                <select
                  value={String(vatEnabled)}
                  onChange={(e) => setVatEnabled(e.target.value === 'true')}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-blue-500"
                >
                  <option value="false">تعطيل الضريبة</option>
                  <option value="true">تفعيل الضريبة</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">نسبة ضريبة القيمة المضافة %</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  value={vatPct}
                  onChange={(e) => setVatPct(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 text-left"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">تكلفة العمالة والتشغيل لكل وحدة (ج.م)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={laborOverheadPerUnit}
                  onChange={(e) => setLaborOverheadPerUnit(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 text-left"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">حجم الطباعة الافتراضي للفواتير</label>
                <select
                  value={printSize}
                  onChange={(e) => setPrintSize(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-blue-500"
                >
                  <option value="A4">A4 حجم عادي</option>
                  <option value="Thermal">حراري (80mm Thermal)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">تفعيل خصومات السطور الفرعية للفاتورة</label>
                <select
                  value={String(discountLinesEnabled)}
                  onChange={(e) => setDiscountLinesEnabled(e.target.value === 'true')}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-blue-500"
                >
                  <option value="true">مسموح بالخصم الفرعي</option>
                  <option value="false">غير مسموح (التحكم بالخصم الكلي فقط)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">تنبيهات انخفاض المخزون (لوحة التحكم)</label>
                <select
                  value={String(reorderAlertsEnabled)}
                  onChange={(e) => setReorderAlertsEnabled(e.target.value === 'true')}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-blue-500"
                >
                  <option value="true">تفعيل التنبيهات</option>
                  <option value="false">تعطيل التنبيهات</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">تفعيل تتبع تاريخ الصلاحية للمواد الكيميائية</label>
                <select
                  value={String(expiryTrackingEnabled)}
                  onChange={(e) => setExpiryTrackingEnabled(e.target.value === 'true')}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-blue-500"
                >
                  <option value="false">لا يتطلب تاريخ صلاحية</option>
                  <option value="true">تفعيل تتبع الصلاحية الإلزامي</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>حفظ جميع الإعدادات</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === 'roles' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-gray-800 border-b pb-3 mb-4">إدارة الأدوار والمسميات الوظيفية</h3>
              <form onSubmit={addRole} className="flex gap-4 max-w-md">
                <input
                  type="text"
                  required
                  placeholder="مسمى الدور الجديد (مثلاً: مبيعات)"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة</span>
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {/* Roles List */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-bold text-gray-700 mb-3 text-sm">الأدوار الحالية بالنظام:</h4>
                  <div className="space-y-1">
                    {roles.map(r => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRoleId(r.id)}
                        className={`flex justify-between items-center p-2.5 rounded-md cursor-pointer text-sm font-medium transition ${
                          selectedRoleId === r.id ? 'bg-blue-100 text-blue-700' : 'bg-white hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <span>{r.name}</span>
                        {r.id !== '88888888-8888-8888-8888-888888888888' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteRole(r.id);
                            }}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Permissions Matrix */}
                <div className="md:col-span-2 border rounded-lg p-6 bg-white">
                  <h4 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <span>مصفوفة صلاحيات الدور المحدد: {roles.find(r => r.id === selectedRoleId)?.name}</span>
                  </h4>

                  {selectedRoleId === '88888888-8888-8888-8888-888888888888' ? (
                    <div className="p-4 bg-yellow-50 text-yellow-800 rounded border border-yellow-100 text-sm">
                      دور مدير النظام (Master Admin) يمتلك صلاحيات كاملة ومطلقة على جميع الشاشات بشكل تلقائي ولا يمكن تعديلها.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-right">
                        <thead>
                          <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <th className="py-3 px-4">الموديل / الشاشة</th>
                            <th className="py-3 px-4 text-center">عرض (View)</th>
                            <th className="py-3 px-4 text-center">إضافة (Add)</th>
                            <th className="py-3 px-4 text-center">تعديل (Edit)</th>
                            <th className="py-3 px-4 text-center">حذف (Delete)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                          {uniqueModules.map(m => {
                            const arabicModule = modulesArabic[m] || m;
                            return (
                              <tr key={m} className="hover:bg-gray-50">
                                <td className="py-3 px-4 font-semibold text-gray-700">{arabicModule}</td>
                                {['view', 'add', 'edit', 'delete'].map(act => {
                                  const perm = permissions.find((p: any) => p.module === m && p.action === act);
                                  if (!perm) return <td key={act} className="text-center">-</td>;
                                  const hasIt = rolePermissions.some((rp: any) => rp.role_id === selectedRoleId && rp.permission_id === perm.id);
                                  return (
                                    <td key={act} className="py-3 px-4 text-center">
                                      <input
                                        type="checkbox"
                                        checked={hasIt}
                                        onChange={(e) => handlePermissionToggle(perm.id, e.target.checked)}
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'warehouses' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-gray-800">إدارة المستودعات ونظام الفروع</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">تفعيل تعدد المستودعات:</span>
                <button
                  type="button"
                  onClick={async () => {
                    const nextVal = !multiWarehouseEnabled;
                    setMultiWarehouseEnabled(nextVal);
                    await saveSetting('multi_warehouse_enabled', String(nextVal));
                    showNotification('success', nextVal ? 'تم تفعيل تعدد المستودعات.' : 'تم تعطيل تعدد المستودعات (المستودع الرئيسي فقط)');
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    multiWarehouseEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    multiWarehouseEnabled ? '-translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            <form onSubmit={addWarehouse} className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl bg-gray-50 p-4 rounded-lg border">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اسم المستودع</label>
                <input
                  type="text"
                  required
                  placeholder="مستودع المواد الكيميائية"
                  value={newWhName}
                  onChange={(e) => setNewWhName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 py-1.5 px-3 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الموقع / العنوان</label>
                <input
                  type="text"
                  placeholder="القاهرة، المنطقة الصناعية"
                  value={newWhLoc}
                  onChange={(e) => setNewWhLoc(e.target.value)}
                  className="w-full rounded-md border border-gray-300 py-1.5 px-3 text-sm bg-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة مستودع</span>
                </button>
              </div>
            </form>

            <div className="overflow-x-auto mt-6">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500 uppercase">
                    <th className="py-3 px-4">اسم المستودع</th>
                    <th className="py-3 px-4">الموقع</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {warehouses.map(wh => (
                    <tr key={wh.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-semibold text-gray-800">{wh.name}</td>
                      <td className="py-3 px-4 text-gray-600">{wh.location || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          wh.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {wh.is_active ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleWarehouseActive(wh)}
                          className={`text-xs font-bold px-3 py-1 rounded transition ${
                            wh.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {wh.is_active ? 'تعطيل' : 'تنشيط'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'sync' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-3 mb-4">مراقبة حالة المزامنة والربط السحابي</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Sync Status Cards */}
              <div className="border rounded-lg p-5 bg-blue-50/50 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">حالة الاتصال بالإنترنت</span>
                  <div className="text-2xl font-bold mt-2 text-gray-800">
                    {syncState?.status === 'online' && 'متصل بالشبكة'}
                    {syncState?.status === 'offline' && 'غير متصل (وضع الأوفلاين)'}
                    {syncState?.status === 'syncing' && 'جاري المزامنة الآن...'}
                    {syncState?.status === 'error' && 'خطأ في الربط!'}
                  </div>
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  يقوم النظام بحفظ جميع العمليات تلقائياً على جهازك في حال انقطاع الشبكة.
                </div>
              </div>

              <div className="border rounded-lg p-5 bg-yellow-50/50 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-yellow-600 uppercase tracking-wider">العمليات المعلقة للمزامنة</span>
                  <div className="text-4xl font-extrabold mt-2 text-gray-900">
                    {syncState?.pendingCount || 0}
                  </div>
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  عدد الفواتير وحركات المخزون والمصروفات التي تم إنشاؤها أوفلاين وتنتظر الرفع للسيرفر.
                </div>
              </div>

              <div className="border rounded-lg p-5 bg-green-50/50 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-green-600 uppercase tracking-wider">آخر مزامنة ناجحة للبيانات</span>
                  <div className="text-lg font-bold mt-2 text-gray-800">
                    {syncState?.lastSyncedAt || 'لم تتم المزامنة بعد'}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleTriggerSync}
                    disabled={loading || !navigator.onLine}
                    className="flex-1 flex justify-center items-center gap-1 bg-green-600 hover:bg-green-700 text-white rounded py-2 px-3 text-xs font-bold transition disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>مزامنة الصادر</span>
                  </button>
                  <button
                    onClick={handleTriggerPull}
                    disabled={loading || !navigator.onLine}
                    className="flex-1 flex justify-center items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded py-2 px-3 text-xs font-bold transition disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>جلب الوارد</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sync History Logs */}
            <div className="mt-6 border rounded-lg bg-gray-900 text-green-400 p-4 font-mono text-xs rounded-lg shadow-inner h-64 overflow-y-auto">
              <div className="text-gray-400 border-b border-gray-800 pb-2 mb-2 font-bold flex justify-between">
                <span>سجل عمليات المزامنة (Sync Logs):</span>
                <span>Active</span>
              </div>
              {syncState?.syncLogs && syncState.syncLogs.length > 0 ? (
                syncState.syncLogs.map((log: string, idx: number) => (
                  <div key={idx} className="py-1">
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-gray-500 italic py-2">لا يوجد سجلات مزامنة معروضة حالياً.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-3 mb-4">سجل مراجعة العمليات (Audit Log)</h3>

            <form onSubmit={saveAuditRetention} className="flex flex-wrap items-end gap-4 bg-gray-50 border rounded-lg p-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">مدة الاحتفاظ بسجل المراجعة (بالأيام)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={auditRetentionDays}
                  onChange={(e) => setAuditRetentionDays(e.target.value)}
                  className="mt-1 block w-40 rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 text-left"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded py-2 px-4 text-sm font-bold transition disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>حفظ</span>
              </button>
              <div className="w-full sm:w-auto">
                <label className="block text-sm font-medium text-gray-700">تصفية حسب الجدول</label>
                <input
                  type="text"
                  value={auditTableFilter}
                  onChange={(e) => setAuditTableFilter(e.target.value)}
                  placeholder="مثال: sales_invoices"
                  className="mt-1 block w-full sm:w-56 rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 text-left"
                />
              </div>
            </form>

            <div className="text-xs text-gray-500">
              يقوم النظام بتسجيل كل عملية إضافة أو تعديل أو حذف تلقائياً (متاح فقط للمستخدمين الذين لديهم صلاحية الإعدادات). يتم عرض آخر 200 عملية فقط أدناه.
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2 px-3 text-right font-medium text-gray-500">التاريخ والوقت</th>
                    <th className="py-2 px-3 text-right font-medium text-gray-500">المستخدم</th>
                    <th className="py-2 px-3 text-right font-medium text-gray-500">الجدول</th>
                    <th className="py-2 px-3 text-right font-medium text-gray-500">العملية</th>
                    <th className="py-2 px-3 text-right font-medium text-gray-500">رقم السجل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLogs
                    .filter((log: any) => !auditTableFilter || log.table_name?.includes(auditTableFilter))
                    .slice(0, 200)
                    .map((log: any) => {
                      const auditUser = auditUsers.find((u: any) => u.id === log.user_id);
                      return (
                        <tr key={log.id}>
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-xs text-gray-600">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString('ar-EG') : '-'}
                          </td>
                          <td className="py-2 px-3">{auditUser?.name || auditUser?.email || 'غير معروف'}</td>
                          <td className="py-2 px-3 font-mono text-xs">{log.table_name}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                log.action === 'insert'
                                  ? 'bg-green-100 text-green-700'
                                  : log.action === 'delete'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {auditActionArabic[log.action] || log.action}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-gray-500">{log.record_id}</td>
                        </tr>
                      );
                    })}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-400">
                        لا توجد عمليات مسجلة بعد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
