import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '../../shared/utils/format';
import { getErrorMessage } from '../../shared/utils/errors';
import { useEmployees, useAttendance, usePayrollRuns } from '../../application/hooks/use-hr';
import { PaginationParams } from '../../core/types';
import { useToast } from './ui/Toast';
import {
  Users,
  Clock,
  Briefcase,
  CheckCircle
} from 'lucide-react';

// Stable reference (not recreated per render) so the data hooks below don't
// re-fetch in a loop — their internal useCallback/useEffect deps include
// this params object by identity.
const UNPAGINATED: PaginationParams = { page: 1, limit: 100000 };

export const HR: React.FC = () => {
  const { success, error, warning } = useToast();

  // Tabs
  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'attendance' | 'payroll'>('employees');

  // Data, sourced from the service/hook layer instead of Dexie directly.
  const { employees: employeesResult, createEmployee } = useEmployees(undefined, UNPAGINATED);
  const employees = employeesResult.data;

  const { attendance: attendanceResult, recordAttendance } = useAttendance(undefined, UNPAGINATED);
  const attendance = attendanceResult.data;
  const attendanceSorted = [...attendance].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const { payrollRuns: payrollRunsResult, createPayrollRun } = usePayrollRuns(undefined, UNPAGINATED);
  const payrollRuns = payrollRunsResult.data;

  // 1. Employee State
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('عامل تشغيل خلط السائل');
  const [empSalary, setEmpSalary] = useState('2500');
  const [empAllowances, setEmpAllowances] = useState('0');
  const [empDeductions, setEmpDeductions] = useState('0');

  // 2. Attendance State
  const [attEmployee, setAttEmployee] = useState('');
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [attCheckIn, setAttCheckIn] = useState('08:00');
  const [attCheckOut, setAttCheckOut] = useState('17:00');

  // 3. Payroll State
  const [payrollMonth, setPayrollMonth] = useState('2026-07');

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

    try {
      await createEmployee({
        name: empName.trim(),
        role: empRole,
        base_salary: Number(empSalary),
        allowances: Number(empAllowances) || 0,
        deductions: Number(empDeductions) || 0,
        join_date: new Date().toISOString().split('T')[0]
      });

      setEmpName('');
      setEmpSalary('2500');
      setEmpAllowances('0');
      setEmpDeductions('0');
      success('تم تسجيل الموظف الجديد في الموارد البشرية بنجاح!');
    } catch (e) {
      error(getErrorMessage(e, 'فشل تسجيل الموظف'));
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
    </div>
  );
};
