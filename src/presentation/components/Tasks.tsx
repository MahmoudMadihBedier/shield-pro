import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '../../shared/utils/format';
import { getErrorMessage } from '../../shared/utils/errors';
import { useEmployees } from '../../application/hooks/use-hr';
import { useTasks, useEmployeeReports, useBonuses, usePunishments, useTaskEmployeeDirectory } from '../../application/hooks/use-tasks';
import { PaginationParams } from '../../core/types';
import { useToast } from './ui/Toast';
import { useAuth } from '../../application/services/auth-service';
import {
  AlertTriangle,
  DollarSign,
  Users,
  FileText
} from 'lucide-react';

const UNPAGINATED: PaginationParams = { page: 1, limit: 100000 };

export const Tasks: React.FC = () => {
  const { success, error } = useToast();
  const { user, profile } = useAuth();
  const canEdit = profile?.role_name === 'Master Admin' || Boolean(profile?.permissions?.hr?.edit);
  
  // Tabs
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'bonuses' | 'punishments' | 'reports'>('tasks');

  // Data
  const { employees: employeeProfilesResult } = useEmployees(undefined, UNPAGINATED);
  const employeeProfiles = employeeProfilesResult.data;
  const { employees } = useTaskEmployeeDirectory();

  // An employee may only work on tasks assigned to their own employee record.
  // Old profiles without a link get a one-time name fallback so existing data
  // remains usable while the administrator links accounts to employee records.
  const matchingEmployees = employeeProfiles.filter((employee) =>
    employee.user_id === user?.id || (!employee.user_id && employee.name.trim() === profile?.name?.trim())
  );
  const currentEmployee = matchingEmployees.length === 1 ? matchingEmployees[0] : undefined;
  const ownTaskFilter = canEdit ? undefined : { employee_id: currentEmployee?.id || '__unlinked_employee__' };
  const ownReportFilter = canEdit ? undefined : { reporter_id: currentEmployee?.id || '__unlinked_employee__' };

  const { tasks: tasksResult, createTask, updateTask } = useTasks(ownTaskFilter, UNPAGINATED);
  const tasks = tasksResult.data;

  const { reports: reportsResult, createReport, updateReport } = useEmployeeReports(ownReportFilter, UNPAGINATED);
  const reports = reportsResult.data;

  const { bonuses: bonusesResult, createBonus } = useBonuses(undefined, UNPAGINATED);
  const bonuses = bonusesResult.data;

  const { punishments: punishmentsResult, createPunishment } = usePunishments(undefined, UNPAGINATED);
  const punishments = punishmentsResult.data;

  // Task form state
  const [taskEmployee, setTaskEmployee] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDueDate, setTaskDueDate] = useState('');

  // Bonus form state
  const [bonusEmployee, setBonusEmployee] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusReason, setBonusReason] = useState('');
  const [bonusDate, setBonusDate] = useState(new Date().toISOString().split('T')[0]);

  // Punishment form state
  const [punishmentEmployee, setPunishmentEmployee] = useState('');
  const [punishmentAmount, setPunishmentAmount] = useState('');
  const [punishmentReason, setPunishmentReason] = useState('');
  const [punishmentDate, setPunishmentDate] = useState(new Date().toISOString().split('T')[0]);

  // Report form state
  const [reportEmployee, setReportEmployee] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSeverity, setReportSeverity] = useState('medium');

  // Task feedback state
  const [taskFeedback, setTaskFeedback] = useState<{ [key: string]: string }>({});

  // Default selection
  useEffect(() => {
    if (employees.length > 0 && !taskEmployee) {
      setTaskEmployee(employees[0].id);
      setBonusEmployee(employees[0].id);
      setPunishmentEmployee(employees[0].id);
      setReportEmployee(employees.find((employee) => employee.id !== currentEmployee?.id)?.id || '');
    }
  }, [employees, currentEmployee?.id]);

  // Helper functions
  const getEmployeeName = (employeeId: string) => {
    return employees.find(e => e.id === employeeId)?.name || 'Unknown';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'not_started': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getReportStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'under_review': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'dismissed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Handlers
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskEmployee || !taskTitle.trim()) return;

    try {
      await createTask({
        employee_id: taskEmployee,
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        status: 'not_started',
        priority: taskPriority as any,
        due_date: taskDueDate || undefined,
        created_by: user?.id
      });

      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('medium');
      setTaskDueDate('');
      success('تم تعيين المهمة للموظف بنجاح!');
    } catch (e) {
      error(getErrorMessage(e, 'فشل تعيين المهمة'));
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const feedback = taskFeedback[taskId] || '';
      await updateTask(taskId, {
        status: newStatus as any,
        feedback: feedback || undefined
      });
      success('تم تحديث حالة المهمة بنجاح!');
    } catch (e) {
      error(getErrorMessage(e, 'فشل تحديث حالة المهمة'));
    }
  };

  const handleCreateBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusEmployee || !bonusAmount) return;

    try {
      await createBonus({
        employee_id: bonusEmployee,
        amount: Number(bonusAmount),
        reason: bonusReason.trim(),
        given_by: user?.id,
        date: bonusDate
      });

      setBonusAmount('');
      setBonusReason('');
      success('تم إضافة المكافأة للموظف بنجاح!');
    } catch (e) {
      error(getErrorMessage(e, 'فشل إضافة المكافأة'));
    }
  };

  const handleCreatePunishment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!punishmentEmployee || !punishmentAmount || !punishmentReason.trim()) return;

    try {
      await createPunishment({
        employee_id: punishmentEmployee,
        amount: Number(punishmentAmount),
        reason: punishmentReason.trim(),
        given_by: user?.id,
        date: punishmentDate
      });

      setPunishmentAmount('');
      setPunishmentReason('');
      success('تم إضافة العقوبة للموظف بنجاح!');
    } catch (e) {
      error(getErrorMessage(e, 'فشل إضافة العقوبة'));
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportEmployee || !reportDescription.trim()) return;

    try {
      if (!currentEmployee) {
        error('لا يوجد ملف موظف مرتبط بحسابك. يرجى من المسؤول ربط حسابك بملف الموظف أولاً.');
        return;
      }
      if (reportEmployee === currentEmployee.id) {
        error('لا يمكن تقديم بلاغ ضد ملفك الشخصي.');
        return;
      }
      
      await createReport({
        reporter_id: currentEmployee.id,
        reported_employee_id: reportEmployee,
        description: reportDescription.trim(),
        severity: reportSeverity as any,
        status: 'pending'
      });

      setReportDescription('');
      setReportSeverity('medium');
      success('تم تقديم الشكوى بنجاح!');
    } catch (e) {
      error(getErrorMessage(e, 'فشل تقديم الشكوى'));
    }
  };

  const handleUpdateReportStatus = async (reportId: string, newStatus: string) => {
    try {
      await updateReport(reportId, {
        status: newStatus as any,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      });
      success('تم تحديث حالة الشكوى بنجاح!');
    } catch (e) {
      error(getErrorMessage(e, 'فشل تحديث حالة الشكوى'));
    }
  };

  const filteredTasks = tasks;

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة المهام والموظفين / Task Management</h1>
          <p className="text-gray-500 text-sm mt-1">تعيين المهام، المكافآت، العقوبات، ومتابعة شكاوى الموظفين</p>
        </div>
      </div>

      {/* Navigation sub-tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-lg p-1 shadow-sm">
        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'tasks' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>المهام</span>
        </button>
        {canEdit && (
          <>
            <button
              onClick={() => setActiveSubTab('bonuses')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
                activeSubTab === 'bonuses' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <DollarSign className="h-4 w-4" />
              <span>المكافآت</span>
            </button>
            <button
              onClick={() => setActiveSubTab('punishments')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
                activeSubTab === 'punishments' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>العقوبات</span>
            </button>
          </>
        )}
        <button
          onClick={() => setActiveSubTab('reports')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'reports' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>{canEdit ? 'البلاغات' : 'تقديم بلاغ'}</span>
        </button>
      </div>

      {activeSubTab === 'tasks' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Task Form (Admin only) */}
          {canEdit && (
            <div className="bg-white p-5 rounded-lg border shadow h-fit">
              <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">تعيين مهمة جديدة</h3>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">الموظف</label>
                  <select
                    required
                    value={taskEmployee}
                    onChange={(e) => setTaskEmployee(e.target.value)}
                    className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                  >
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">عنوان المهمة</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: إعداد تقرير شهري"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">وصف المهمة</label>
                  <textarea
                    placeholder="تفاصيل المهمة..."
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">الأولوية</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value)}
                      className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                    >
                      <option value="low">منخفضة</option>
                      <option value="medium">متوسطة</option>
                      <option value="high">عالية</option>
                      <option value="urgent">عاجلة</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">تاريخ الاستحقاق</label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full flex justify-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition"
                >
                  تعيين المهمة
                </button>
              </form>
            </div>
          )}

          {/* Tasks List */}
          <div className={`${canEdit ? "lg:col-span-2" : "lg:col-span-3"} bg-white p-5 rounded-lg border shadow`}>
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">
              {canEdit ? 'قائمة المهام' : 'جميع المهام'}
            </h3>
            <div className="space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  لا توجد مهام حالياً
                </div>
              ) : (
                filteredTasks.map(task => (
                  <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-800">{task.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{task.description || 'لا يوجد وصف'}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority === 'urgent' ? 'عاجل' : task.priority === 'high' ? 'عالي' : task.priority === 'medium' ? 'متوسط' : 'منخفض'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                          {task.status === 'done' ? 'مكتمل' : task.status === 'in_progress' ? 'قيد التنفيذ' : task.status === 'not_started' ? 'لم يبدأ' : 'ملغي'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
                      <div>
                        <span className="font-medium">الموظف:</span> {getEmployeeName(task.employee_id)}
                        {task.due_date && (
                          <span className="mr-4">
                            <span className="font-medium">التاريخ:</span> {formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    </div>

                    {task.feedback && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-gray-700">
                        <span className="font-medium">ملاحظات:</span> {task.feedback}
                      </div>
                    )}

                    {/* Task Actions */}
                    <div className="mt-3 flex gap-2">
                      {canEdit ? (
                        <>
                          <button
                            onClick={() => handleUpdateTaskStatus(task.id, 'done')}
                            disabled={task.status === 'done' || task.status === 'cancelled'}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 disabled:opacity-50"
                          >
                            إكمال
                          </button>
                          <button
                            onClick={() => handleUpdateTaskStatus(task.id, 'cancelled')}
                            disabled={task.status === 'cancelled'}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 disabled:opacity-50"
                          >
                            إلغاء
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                            disabled={task.status === 'done' || task.status === 'cancelled'}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 disabled:opacity-50"
                          >
                            بدء التنفيذ
                          </button>
                          <button
                            onClick={() => handleUpdateTaskStatus(task.id, 'done')}
                            disabled={task.status === 'done' || task.status === 'cancelled'}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 disabled:opacity-50"
                          >
                            إكمال
                          </button>
                        </>
                      )}
                    </div>

                    {/* Feedback Input */}
                    <div className="mt-3">
                      <input
                        type="text"
                        placeholder="أضف ملاحظات أو تغذية راجعة..."
                        value={taskFeedback[task.id] || ''}
                        onChange={(e) => setTaskFeedback({ ...taskFeedback, [task.id]: e.target.value })}
                        className="w-full rounded border border-gray-300 py-1 px-2 text-xs"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'bonuses' && canEdit && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Bonus Form */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">إضافة مكافأة</h3>
            <form onSubmit={handleCreateBonus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الموظف</label>
                <select
                  required
                  value={bonusEmployee}
                  onChange={(e) => setBonusEmployee(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المبلغ (ج.م)</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">السبب</label>
                <textarea
                  placeholder="سبب المكافأة..."
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">التاريخ</label>
                <input
                  type="date"
                  required
                  value={bonusDate}
                  onChange={(e) => setBonusDate(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-xs transition"
              >
                إضافة المكافأة
              </button>
            </form>
          </div>

          {/* Bonuses List */}
          {canEdit && (
            <div className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">سجل المكافآت</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">الموظف</th>
                    <th className="py-3 px-4">المبلغ</th>
                    <th className="py-3 px-4">السبب</th>
                    <th className="py-3 px-4">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {bonuses.map(bonus => (
                    <tr key={bonus.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-bold text-gray-800">{getEmployeeName(bonus.employee_id)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-green-600">{formatCurrency(bonus.amount)}</td>
                      <td className="py-3 px-4 text-gray-600">{bonus.reason || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">{formatDate(bonus.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'punishments' && canEdit && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Punishment Form */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">إضافة عقوبة</h3>
            <form onSubmit={handleCreatePunishment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الموظف</label>
                <select
                  required
                  value={punishmentEmployee}
                  onChange={(e) => setPunishmentEmployee(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">مبلغ الخصم (ج.م)</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={punishmentAmount}
                  onChange={(e) => setPunishmentAmount(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">السبب</label>
                <textarea
                  required
                  placeholder="سبب العقوبة..."
                  value={punishmentReason}
                  onChange={(e) => setPunishmentReason(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">التاريخ</label>
                <input
                  type="date"
                  required
                  value={punishmentDate}
                  onChange={(e) => setPunishmentDate(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-xs transition"
              >
                إضافة العقوبة
              </button>
            </form>
          </div>

          {/* Punishments List */}
          <div className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">سجل العقوبات</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">الموظف</th>
                    <th className="py-3 px-4">المبلغ</th>
                    <th className="py-3 px-4">السبب</th>
                    <th className="py-3 px-4">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {punishments.map(punishment => (
                    <tr key={punishment.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-bold text-gray-800">{getEmployeeName(punishment.employee_id)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-red-600">{formatCurrency(punishment.amount)}</td>
                      <td className="py-3 px-4 text-gray-600">{punishment.reason}</td>
                      <td className="py-3 px-4 text-gray-600">{formatDate(punishment.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Report Form - Available to all users */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">
              {canEdit ? 'تقديم شكوى' : 'تقديم بلاغ عن موظف'}
            </h3>
            <form onSubmit={handleCreateReport} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الموظف المبلغ عنه</label>
                <select
                  required
                  value={reportEmployee}
                  onChange={(e) => setReportEmployee(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  {employees.filter((employee) => employee.id !== currentEmployee?.id).map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">وصف الشكوى</label>
                <textarea
                  required
                  placeholder="تفاصيل الشكوى..."
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الخطورة</label>
                <select
                  value={reportSeverity}
                  onChange={(e) => setReportSeverity(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  <option value="low">منخفضة</option>
                  <option value="medium">متوسطة</option>
                  <option value="high">عالية</option>
                  <option value="critical">حرجة</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-bold text-xs transition"
              >
                تقديم الشكوى
              </button>
            </form>
          </div>

          {/* Escalation details are deliberately visible to administrators only. */}
          {canEdit && (
          <div className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">سجل الشكاوى</h3>
            <div className="space-y-3">
              {reports.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  لا توجد شكاوى حالياً
                </div>
              ) : (
                reports.map(report => (
                  <div key={report.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-800">المبلغ عنه:</span>
                          <span className="text-gray-700">{getEmployeeName(report.reported_employee_id)}</span>
                        </div>
                        <p className="text-sm text-gray-600">{report.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(report.severity)}`}>
                          {report.severity === 'critical' ? 'حرج' : report.severity === 'high' ? 'عالي' : report.severity === 'medium' ? 'متوسط' : 'منخفض'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getReportStatusColor(report.status)}`}>
                          {report.status === 'resolved' ? 'تم الحل' : report.status === 'under_review' ? 'قيد المراجعة' : report.status === 'pending' ? 'معلق' : 'مرفوض'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-3">
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">تاريخ:</span> {formatDate(report.created_at)}
                      </div>
                      <div className="flex gap-2">
                        {canEdit && report.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleUpdateReportStatus(report.id, 'under_review')}
                              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                            >
                              بدء المراجعة
                            </button>
                            <button
                              onClick={() => handleUpdateReportStatus(report.id, 'resolved')}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                            >
                              حل
                            </button>
                            <button
                              onClick={() => handleUpdateReportStatus(report.id, 'dismissed')}
                              className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                            >
                              رفض
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {report.resolution_notes && (
                      <div className="mt-2 p-2 bg-green-50 rounded text-sm text-gray-700">
                        <span className="font-medium">ملاحظات الحل:</span> {report.resolution_notes}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
};
