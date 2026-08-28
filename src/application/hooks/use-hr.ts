import { useState, useEffect, useCallback } from 'react';
import { Employee, Attendance, PayrollRun } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { ServiceFactory } from '../services/service-factory';

export function useEmployees(filter?: EntityFilter, params?: PaginationParams) {
  const [employees, setEmployees] = useState<PaginatedResult<Employee>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hrService = ServiceFactory.getHRService();

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await hrService.getEmployees(filter, params);
      setEmployees(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [filter, params, hrService]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const createEmployee = useCallback(async (employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newEmployee = await hrService.createEmployee(employee);
      await loadEmployees();
      return newEmployee;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create employee');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [hrService, loadEmployees]);

  const updateEmployee = useCallback(async (id: string, employee: Partial<Employee>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedEmployee = await hrService.updateEmployee(id, employee);
      await loadEmployees();
      return updatedEmployee;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [hrService, loadEmployees]);

  return {
    employees,
    loading,
    error,
    loadEmployees,
    createEmployee,
    updateEmployee
  };
}

export function useAttendance(filter?: EntityFilter, params?: PaginationParams) {
  const [attendance, setAttendance] = useState<PaginatedResult<Attendance>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hrService = ServiceFactory.getHRService();

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await hrService.getAttendance(filter, params);
      setAttendance(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [filter, params, hrService]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const recordAttendance = useCallback(async (attendanceRecord: Omit<Attendance, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newAttendance = await hrService.recordAttendance(attendanceRecord);
      await loadAttendance();
      return newAttendance;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record attendance');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [hrService, loadAttendance]);

  const clockIn = useCallback(async (employeeId: string, lat?: number | null, lng?: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const record = await hrService.clockIn(employeeId, lat, lng);
      await loadAttendance();
      return record;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clock in');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [hrService, loadAttendance]);

  const clockOut = useCallback(async (employeeId: string, lat?: number | null, lng?: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const record = await hrService.clockOut(employeeId, lat, lng);
      await loadAttendance();
      return record;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clock out');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [hrService, loadAttendance]);

  return {
    attendance,
    loading,
    error,
    loadAttendance,
    recordAttendance,
    clockIn,
    clockOut
  };
}

export function usePayrollRuns(filter?: EntityFilter, params?: PaginationParams) {
  const [payrollRuns, setPayrollRuns] = useState<PaginatedResult<PayrollRun>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hrService = ServiceFactory.getHRService();

  const loadPayrollRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await hrService.getPayrollRuns(filter, params);
      setPayrollRuns(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payroll runs');
    } finally {
      setLoading(false);
    }
  }, [filter, params, hrService]);

  useEffect(() => {
    loadPayrollRuns();
  }, [loadPayrollRuns]);

  const createPayrollRun = useCallback(async (payroll: Omit<PayrollRun, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newPayrollRun = await hrService.createPayrollRun(payroll);
      await loadPayrollRuns();
      return newPayrollRun;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payroll run');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [hrService, loadPayrollRuns]);

  return {
    payrollRuns,
    loading,
    error,
    loadPayrollRuns,
    createPayrollRun
  };
}
