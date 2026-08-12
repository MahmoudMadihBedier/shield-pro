import { useState, useEffect, useCallback } from 'react';
import { Task, EmployeeReport, Bonus, Punishment } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { ServiceFactory } from '../services/service-factory';
import { supabase } from '../../infrastructure/api/supabase';

export interface TaskEmployeeDirectoryEntry {
  id: string;
  name: string;
  role?: string;
  user_id?: string | null;
}

export function useTaskEmployeeDirectory() {
  const [employees, setEmployees] = useState<TaskEmployeeDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: requestError } = await supabase
        .from('task_employee_directory')
        .select('id, name, role, user_id')
        .order('name');
      if (requestError) throw requestError;
      setEmployees((data || []) as TaskEmployeeDirectoryEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee directory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  return { employees, loading, error, loadEmployees };
}

export function useTasks(filter?: EntityFilter, params?: PaginationParams) {
  const [tasks, setTasks] = useState<PaginatedResult<Task>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taskService = ServiceFactory.getTaskService();

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await taskService.getTasks(filter, params);
      setTasks(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filter, params, taskService]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const createTask = useCallback(async (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newTask = await taskService.createTask(task);
      await loadTasks();
      return newTask;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [taskService, loadTasks]);

  const updateTask = useCallback(async (id: string, task: Partial<Task>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedTask = await taskService.updateTask(id, task);
      await loadTasks();
      return updatedTask;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [taskService, loadTasks]);

  const deleteTask = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await taskService.deleteTask(id);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [taskService, loadTasks]);

  return {
    tasks,
    loading,
    error,
    loadTasks,
    createTask,
    updateTask,
    deleteTask
  };
}

export function useEmployeeReports(filter?: EntityFilter, params?: PaginationParams) {
  const [reports, setReports] = useState<PaginatedResult<EmployeeReport>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taskService = ServiceFactory.getTaskService();

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await taskService.getEmployeeReports(filter, params);
      setReports(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [filter, params, taskService]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const createReport = useCallback(async (report: Omit<EmployeeReport, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newReport = await taskService.createEmployeeReport(report);
      await loadReports();
      return newReport;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create report');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [taskService, loadReports]);

  const updateReport = useCallback(async (id: string, report: Partial<EmployeeReport>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedReport = await taskService.updateEmployeeReport(id, report);
      await loadReports();
      return updatedReport;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update report');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [taskService, loadReports]);

  const deleteReport = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await taskService.deleteEmployeeReport(id);
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [taskService, loadReports]);

  return {
    reports,
    loading,
    error,
    loadReports,
    createReport,
    updateReport,
    deleteReport
  };
}

export function useBonuses(filter?: EntityFilter, params?: PaginationParams) {
  const [bonuses, setBonuses] = useState<PaginatedResult<Bonus>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taskService = ServiceFactory.getTaskService();

  const loadBonuses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await taskService.getBonuses(filter, params);
      setBonuses(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bonuses');
    } finally {
      setLoading(false);
    }
  }, [filter, params, taskService]);

  useEffect(() => {
    loadBonuses();
  }, [loadBonuses]);

  const createBonus = useCallback(async (bonus: Omit<Bonus, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newBonus = await taskService.createBonus(bonus);
      await loadBonuses();
      return newBonus;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bonus');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [taskService, loadBonuses]);

  const updateBonus = useCallback(async (id: string, bonus: Partial<Bonus>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedBonus = await taskService.updateBonus(id, bonus);
      await loadBonuses();
      return updatedBonus;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bonus');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [taskService, loadBonuses]);

  const deleteBonus = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await taskService.deleteBonus(id);
      await loadBonuses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bonus');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [taskService, loadBonuses]);

  return {
    bonuses,
    loading,
    error,
    loadBonuses,
    createBonus,
    updateBonus,
    deleteBonus
  };
}

export function usePunishments(filter?: EntityFilter, params?: PaginationParams) {
  const [punishments, setPunishments] = useState<PaginatedResult<Punishment>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taskService = ServiceFactory.getTaskService();

  const loadPunishments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await taskService.getPunishments(filter, params);
      setPunishments(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load punishments');
    } finally {
      setLoading(false);
    }
  }, [filter, params, taskService]);

  useEffect(() => {
    loadPunishments();
  }, [loadPunishments]);

  const createPunishment = useCallback(async (punishment: Omit<Punishment, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newPunishment = await taskService.createPunishment(punishment);
      await loadPunishments();
      return newPunishment;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create punishment');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [taskService, loadPunishments]);

  const updatePunishment = useCallback(async (id: string, punishment: Partial<Punishment>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedPunishment = await taskService.updatePunishment(id, punishment);
      await loadPunishments();
      return updatedPunishment;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update punishment');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [taskService, loadPunishments]);

  const deletePunishment = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await taskService.deletePunishment(id);
      await loadPunishments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete punishment');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [taskService, loadPunishments]);

  return {
    punishments,
    loading,
    error,
    loadPunishments,
    createPunishment,
    updatePunishment,
    deletePunishment
  };
}
