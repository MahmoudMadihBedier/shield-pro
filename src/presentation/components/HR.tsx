import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '../../shared/utils/format';
import { getErrorMessage } from '../../shared/utils/errors';
import { useEmployees, useAttendance, usePayrollRuns } from '../../application/hooks/use-hr';
import { PaginationParams } from '../../core/types';
import { useToast } from './ui/Toast';
import { Tasks } from './Tasks';
import { db } from '../../infrastructure/database/dexie';
import { User } from '../../core/domain/entities';
import { useAuth } from '../../application/services/auth-service';
import {
  Users,
  Clock,
  Briefcase,
  CheckCircle,
  FileText
} from 'lucide-react';

// Stable reference (not recreated per render) so the data hooks below don't
// re-fetch in a loop — their internal useCallback/useEffect deps include
// this params object by identity.
const UNPAGINATED: PaginationParams = { page: 1, limit: 100000 };

export const HR: React.FC = () => {
  const { success, error, warning } = useToast();
  const { profile } = useAuth();

  // Tabs
  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'attendance' | 'payroll' | 'tasks'>('employees');

  // Data, sourced from the service/hook layer instead of Dexie directly.
  const { employees: employeesResult, createEmployee, updateEmployee } = useEmployees(undefined, UNPAGINATED);
  const employees = employeesResult.data;
  const [systemUsers, setSystemUsers] = useState<User[]>([]);

  const { attendance: attendanceResult, recordAttendance, clockIn, clockOut } = useAttendance(undefined, UNPAGINATED);
  const attendance = attendanceResult.data;
  const attendanceSorted = [...attendance].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // The logged-in user's own linked employee record, if any — drives the
  // self clock-in/out card (only the employee themselves can use it,
  // enforced server-side too by enforce_self_attendance).
  const myEmployee = employees.find((e) => e.user_id === profile?.id);
  const myTodayAttendance = attendance.find((a) => a.employee_id === myEmployee?.id && a.date === new Date().toISOString().split('T')[0]);
  const isMasterAdmin = profile?.role_name === 'Master Admin';

  const captureLocation = (): Promise<{ lat: number | null; lng: number | null }> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve({ lat: null, lng: null }); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { timeout: 5000, maximumAge: 60000 }
      );
    });

  const handleClockIn = async () => {
    if (!myEmployee) return;
    try {
      const { lat, lng } = await captureLocation();
      await clockIn(myEmployee.id, lat, lng);
      success('تم تسجيل حضورك بنجاح');
    } catch (e) {
      error(getErrorMessage(e, 'فشل تسجيل الحضور'));
    }
  };

  const handleClockOut = async () => {
    if (!myEmployee) return;
    try {
      const { lat, lng } = await captureLocation();
      await clockOut(myEmployee.id, lat, lng);
      success('تم تسجيل انصرافك بنجاح');
    } catch (e) {
      error(getErrorMessage(e, 'فشل تسجيل الانصراف'));
    }
  };

  const handlePrintPayroll = () => {
    const runsForMonth = payrollRuns.filter((pr) => pr.month === payrollMonth);
    const rows = runsForMonth.map((pr) => {
      const emp = employees.find((e) => e.id === pr.employee_id);
      return `<tr><td>${emp?.name || pr.employee_id}</td><td>${emp?.role || ''}</td><td>${pr.base}</td><td>${pr.bonuses_total || 0}</td><td>${pr.punishments_total || 0}</td><td>${pr.net_pay}</td></tr>`;
    }).join('');
    const win = window.open('', '_blank', 'width=700,height=800');
    if (!win) return;
    win.document.write(`
      <html dir="rtl"><head><title>مسير رواتب ${payrollMonth}</title>
      <style>body{font-family:sans-serif;padding:16px}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #ddd;text-align:right}</style>
      </head><body>
      <h2>مسير رواتب شهر ${payrollMonth}</h2>
      <table><thead><tr><th>الموظف</th><th>الوظيفة</th><th>الأساسي</th><th>المكافآت</th><th>الخصومات (عقوبات)</th><th>الصافي</th></tr></thead><tbody>${rows}</tbody></table>
      <script>window.print()</script>
      </body></html>
    `);
    win.document.close();
  };

  const { payrollRuns: payrollRunsResult, createPayrollRun } = usePayrollRuns(undefined, UNPAGINATED);
  const payrollRuns = payrollRunsResult.data;

  // 1. Employee State
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('عامل تشغيل خلط السائل');
  const [empSalary, setEmpSalary] = useState('');
  const [empAllowances, setEmpAllowances] = useState('0');
  const [empDeductions, setEmpDeductions] = useState('0');
  const [empUserId, setEmpUserId] = useState('');

  useEffect(() => {
    db.users.toArray().then((users) => setSystemUsers(users as User[]));
  }, []);

  // 2. Attendance State
  const [attEmployee, setAttEmployee] = useState('');
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [attCheckIn, setAttCheckIn] = useState('08:00');
  const [attCheckOut, setAttCheckOut] = useState('17:00');

  // 3. Payroll State
  const [payrollMonth, setPayrollMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Default selection, once the employees list has loaded (mirrors the old
  // loadData() one-time defaulting, but reactive to the hook's own load
  // instead of a single combined fetch).
  useEffect(() => {
    if (employees.length > 0 && !attEmployee) {
      setAttEmployee(employees[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees]);

  // Add Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim()) return;
    if (!empSalary || Number(empSalary) <= 0) { alert('يرجى إدخال الراتب الأساسي.'); return; }

    try {
      await createEmployee({
        name: empName.trim(),
        role: empRole,
        base_salary: Number(empSalary),
        allowances: Number(empAllowances) || 0,
        deductions: Number(empDeductions) || 0,
        user_id: empUserId || null,
        join_date: new Date().toISOString().split('T')[0]
      });

      setEmpName('');
      setEmpSalary('');
      setEmpAllowances('0');
      setEmpDeductions('0');
      setEmpUserId('');
      success('تم تسجيل الموظف الجديد في الموارد البشرية بنجاح!');
    } catch (e) {
      error(getErrorMessage(e, 'فشل تسجيل الموظف'));
    }
  };

  const handleEmployeeAccountLink = async (employeeId: string, userId: string) => {
    try {
      await updateEmployee(employeeId, { user_id: userId || null });
      success('تم ربط حساب النظام بملف الموظف.');
    } catch (err) {
      error(getErrorMessage(err, 'فشل ربط حساب الموظف'));
    }
  };

  // Check-in / Attendance Logging
  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attEmployee || !attDate) return;

    try {
      await recordAttendance({
        employee_id: attEmployee,
        date: attDate,
        check_in: attCheckIn,
        check_out: attCheckOut
      });
      success('تم تسجيل حضور وانصراف الموظف لهذا اليوم بنجاح!');
    } catch (err) {
      error(getErrorMessage(err, 'خطأ: الموظف قد يكون مسجلاً بالفعل حضور لهذا التاريخ.'));
    }
  };

  // Payroll execution — net-salary calculation and journal-entry posting
  // (debit Salaries Expense / credit cash) now happen inside
  // HRService.createPayrollRun instead of here.
  const handleRunPayroll = async () => {
    if (!payrollMonth) return;
    if (employees.length === 0) {
      warning('لا يوجد موظفون مسجلون لتوليد الرواتب لهم.');
      return;
    }

    try {
      let runCount = 0;
      for (const emp of employees) {
        // Check if already run for this employee and month
        const exists = payrollRuns.some((pr) => pr.month === payrollMonth && pr.employee_id === emp.id);
        if (exists) continue;

        await createPayrollRun({
          month: payrollMonth,
          employee_id: emp.id,
          base: Number(emp.base_salary) || 0,
          allowances: Number(emp.allowances) || 0,
          deductions: Number(emp.deductions) || 0,
          // overwritten by HRService.createPayrollRun with the real computed net pay
          net_pay: 0
        });
        runCount++;
      }

      if (runCount > 0) {
        success(`تم ترحيل مسيرات الرواتب لشهر ${payrollMonth} لعدد ${runCount} موظفاً وتوليد مصروفات الحسابات تلقائياً!`);
      } else {
        warning('مسيرات الرواتب لهذا الشهر تم توليدها مسبقاً بالكامل.');
      }
    } catch (e) {
      error(getErrorMessage(e, 'فشل ترحيل الرواتب'));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">شؤون الموظفين والرواتب / Human Resources</h1>
          <p className="text-gray-500 text-sm mt-1">تنظيم ملفات الموظفين، الحضور والانصراف اليومي، واحتساب الرواتب التلقائي مع المحاسبة</p>
        </div>
      </div>

      {/* Navigation sub-tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-lg p-1 shadow-sm">
        <button
          onClick={() => setActiveSubTab('employees')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'employees' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>ملفات وسجل الموظفين</span>
        </button>
        <button
          onClick={() => setActiveSubTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'attendance' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>سجل الحضور والانصراف اليومي</span>
        </button>
        <button
          onClick={() => setActiveSubTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'payroll' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          <span>مسيرات رواتب الموظفين الشهرية</span>
        </button>
        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'tasks' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>إدارة المهام والشكاوى</span>
        </button>
      </div>

      {activeSubTab === 'employees' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Employee Form */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">إنشاء ملف موظف جديد</h3>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اسم الموظف الكامل</label>
                <input
                  type="text"
                  required
                  placeholder="سليمان عبد الله"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المسمى الوظيفي</label>
                <select
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  <option value="عامل تشغيل خلط السائل">عامل تشغيل خلط السائل</option>
                  <option value="عامل تعبئة وتغليف كرتون">عامل تعبئة وتغليف كرتون</option>
                  <option value="محاسب المصنع الجاري">محاسب المصنع الجاري</option>
                  <option value="سائق فروع لوجستي">سائق فروع لوجستي</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الراتب الأساسي الشهري (ج.م)</label>
                <input
                  type="number"
                  required
                  value={empSalary}
                  onChange={(e) => setEmpSalary(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">بدلات (ج.م)</label>
                  <input
                    type="number"
                    value={empAllowances}
                    onChange={(e) => setEmpAllowances(e.target.value)}
                    className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">خصومات ثابتة (ج.م)</label>
                  <input
                    type="number"
                    value={empDeductions}
                    onChange={(e) => setEmpDeductions(e.target.value)}
                    className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">حساب النظام المرتبط (اختياري)</label>
                <select
                  value={empUserId}
                  onChange={(e) => setEmpUserId(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  <option value="">يربط لاحقاً</option>
                  {systemUsers.map((systemUser) => (
                    <option key={systemUser.id} value={systemUser.id}>{systemUser.name} ({systemUser.email})</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition"
              >
                تثبيت وحفظ الموظف
              </button>
            </form>
          </div>

          {/* Employees List */}
          <div className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">قائمة الكادر الموظف</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">اسم الموظف</th>
                    <th className="py-3 px-4">المسمى الوظيفي</th>
                    <th className="py-3 px-4 text-center">الراتب الشهري</th>
                    <th className="py-3 px-4">حساب النظام</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-bold text-gray-800">{emp.name}</td>
                      <td className="py-3 px-4 text-gray-600">{emp.role || '-'}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-blue-600">
                        {formatCurrency(Number(emp.base_salary) || 0)}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={emp.user_id || ''}
                          onChange={(e) => handleEmployeeAccountLink(emp.id, e.target.value)}
                          className="w-full rounded border border-gray-300 py-1.5 px-2 text-xs bg-white"
                        >
                          <option value="">غير مرتبط</option>
                          {systemUsers.map((systemUser) => (
                            <option key={systemUser.id} value={systemUser.id}>{systemUser.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {myEmployee && (
            <div className="bg-blue-50 p-5 rounded-lg border border-blue-200 shadow h-fit lg:col-span-3">
              <h3 className="font-bold text-blue-900 mb-2">تسجيل حضوري / انصرافي</h3>
              <p className="text-xs text-blue-700 mb-3">تسجيل ذاتي مرتبط بموقعك الجغرافي — لا يمكن لأحد آخر تسجيل الحضور نيابة عنك.</p>
              <div className="flex gap-3">
                <button
                  onClick={handleClockIn}
                  disabled={!!myTodayAttendance?.check_in}
                  className="bg-green-600 text-white text-sm px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {myTodayAttendance?.check_in ? `تم الحضور (${myTodayAttendance.check_in})` : 'تسجيل حضور'}
                </button>
                <button
                  onClick={handleClockOut}
                  disabled={!myTodayAttendance?.check_in || !!myTodayAttendance?.check_out}
                  className="bg-red-600 text-white text-sm px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {myTodayAttendance?.check_out ? `تم الانصراف (${myTodayAttendance.check_out})` : 'تسجيل انصراف'}
                </button>
              </div>
            </div>
          )}
          {/* Create attendance */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">ساعة الحضور اليومية (Time Clock)</h3>
            <form onSubmit={handleSaveAttendance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اسم الموظف</label>
                <select
                  required
                  value={attEmployee}
                  onChange={(e) => setAttEmployee(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">تاريخ اليوم</label>
                <input
                  type="date"
                  required
                  value={attDate}
                  onChange={(e) => setAttDate(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">وقت الحضور</label>
                  <input
                    type="time"
                    required
                    value={attCheckIn}
                    onChange={(e) => setAttCheckIn(e.target.value)}
                    className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">وقت الانصراف</label>
                  <input
                    type="time"
                    required
                    value={attCheckOut}
                    onChange={(e) => setAttCheckOut(e.target.value)}
                    className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-xs transition"
              >
                تأكيد وبصمة الموظف
              </button>
            </form>
          </div>

          {/* Attendance log */}
          <div className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">دفتر سجل حضور وانصراف الموظفين</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">اسم الموظف</th>
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4 text-center">الحضور</th>
                    <th className="py-3 px-4 text-center">الانصراف</th>
                    <th className="py-3 px-4 text-center">حالة البصمة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {attendanceSorted.map(a => {
                    const empName = employees.find(e => e.id === a.employee_id)?.name || '';
                    return (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-bold text-gray-800">{empName}</td>
                        <td className="py-3 px-4 text-gray-600 text-xs">{formatDate(a.date)}</td>
                        <td className="py-3 px-4 text-center font-mono text-green-600">{a.check_in}</td>
                        <td className="py-3 px-4 text-center font-mono text-red-600">{a.check_out || 'مستمر بالعمل'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Clock className="h-3 w-3" />
                            <span>مؤكدة</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'payroll' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-gray-800 text-base">ترحيل واعتماد مسيرات الرواتب الشهرية</h3>
              <p className="text-xs text-gray-500">يقوم النظام باحتساب صافي رواتب جميع الموظفين وترحيلها تلقائياً للمصاريف المحاسبية بضغطة زر واحدة</p>
            </div>

            <div className="flex gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">الشهر المستهدف للرواتب</label>
                <input
                  type="month"
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(e.target.value)}
                  className="rounded border py-1.5 px-3 text-sm bg-white text-left font-bold"
                />
              </div>

              <button
                onClick={handleRunPayroll}
                className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition"
              >
                ترحيل رواتب الشهر المستهدف
              </button>

              {isMasterAdmin && (
                <button
                  onClick={handlePrintPayroll}
                  title="طباعة الرواتب — صلاحية حصرية لمدير النظام"
                  className="py-2 px-5 bg-gray-800 hover:bg-gray-900 text-white rounded font-bold text-xs transition"
                >
                  طباعة رواتب الشهر
                </button>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">مسيرات الرواتب المعتمدة تاريخياً</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">الموظف</th>
                    <th className="py-3 px-4">الشهر</th>
                    <th className="py-3 px-4 text-center">الراتب الأساسي</th>
                    <th className="py-3 px-4 text-center">البدلات والخصومات</th>
                    <th className="py-3 px-4 text-center">صافي المبلغ المدفوع</th>
                    <th className="py-3 px-4 text-center">حالة الترحيل المحاسبي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {payrollRuns.map(pr => {
                    const empName = employees.find(e => e.id === pr.employee_id)?.name || '';
                    return (
                      <tr key={pr.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-bold text-gray-800">{empName}</td>
                        <td className="py-3 px-4 font-bold font-mono text-gray-700">{pr.month}</td>
                        <td className="py-3 px-4 text-center font-mono">{formatCurrency(pr.base)}</td>
                        <td className="py-3 px-4 text-center font-mono">+{formatCurrency(pr.allowances)} / -{formatCurrency(pr.deductions)}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-green-600">{formatCurrency(pr.net_pay)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <CheckCircle className="h-3 w-3" />
                            <span>مرحل للمصروفات</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'tasks' && (
        <Tasks />
      )}
    </div>
  );
};
