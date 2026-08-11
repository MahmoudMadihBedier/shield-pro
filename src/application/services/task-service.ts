import { Task, EmployeeReport, Bonus, Punishment } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';

export class TaskService {
  private taskRepository = RepositoryFactory.getTaskRepository();
  private employeeReportRepository = RepositoryFactory.getEmployeeReportRepository();
  private bonusRepository = RepositoryFactory.getBonusRepository();
  private punishmentRepository = RepositoryFactory.getPunishmentRepository();

  // Task methods
  async getTasks(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Task>> {
    return await this.taskRepository.findAll(filter, params);
  }

  async createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
    const newTask = await this.taskRepository.create(task);
    await queueOfflineWrite('tasks', 'insert', newTask.id, newTask);
    return newTask;
  }

  async updateTask(id: string, task: Partial<Task>): Promise<Task> {
    const updatedTask = await this.taskRepository.update(id, task);
    await queueOfflineWrite('tasks', 'update', id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: string): Promise<void> {
    await this.taskRepository.delete(id);
    await queueOfflineWrite('tasks', 'delete', id, null);
  }

  async getTasksByEmployeeId(employeeId: string): Promise<Task[]> {
    return await this.taskRepository.findByEmployeeId(employeeId);
  }

  async getTasksByStatus(status: string): Promise<Task[]> {
    return await this.taskRepository.findByStatus(status);
  }

  // Employee Report methods
  async getEmployeeReports(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<EmployeeReport>> {
    return await this.employeeReportRepository.findAll(filter, params);
  }

  async createEmployeeReport(report: Omit<EmployeeReport, 'id' | 'created_at' | 'updated_at'>): Promise<EmployeeReport> {
    const newReport = await this.employeeReportRepository.create(report);
    await queueOfflineWrite('employee_reports', 'insert', newReport.id, newReport);
    return newReport;
  }

  async updateEmployeeReport(id: string, report: Partial<EmployeeReport>): Promise<EmployeeReport> {
    const updatedReport = await this.employeeReportRepository.update(id, report);
    await queueOfflineWrite('employee_reports', 'update', id, updatedReport);
    return updatedReport;
  }

  async deleteEmployeeReport(id: string): Promise<void> {
    await this.employeeReportRepository.delete(id);
    await queueOfflineWrite('employee_reports', 'delete', id, null);
  }

  async getReportsByReporterId(reporterId: string): Promise<EmployeeReport[]> {
    return await this.employeeReportRepository.findByReporterId(reporterId);
  }

  async getReportsByReportedEmployeeId(reportedEmployeeId: string): Promise<EmployeeReport[]> {
    return await this.employeeReportRepository.findByReportedEmployeeId(reportedEmployeeId);
  }

  async getReportsByStatus(status: string): Promise<EmployeeReport[]> {
    return await this.employeeReportRepository.findByStatus(status);
  }

  // Bonus methods
  async getBonuses(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Bonus>> {
    return await this.bonusRepository.findAll(filter, params);
  }

  async createBonus(bonus: Omit<Bonus, 'id' | 'created_at' | 'updated_at'>): Promise<Bonus> {
    const newBonus = await this.bonusRepository.create(bonus);
    await queueOfflineWrite('bonuses', 'insert', newBonus.id, newBonus);
    return newBonus;
  }

  async updateBonus(id: string, bonus: Partial<Bonus>): Promise<Bonus> {
    const updatedBonus = await this.bonusRepository.update(id, bonus);
    await queueOfflineWrite('bonuses', 'update', id, updatedBonus);
    return updatedBonus;
  }

  async deleteBonus(id: string): Promise<void> {
    await this.bonusRepository.delete(id);
    await queueOfflineWrite('bonuses', 'delete', id, null);
  }

  async getBonusesByEmployeeId(employeeId: string): Promise<Bonus[]> {
    return await this.bonusRepository.findByEmployeeId(employeeId);
  }

  // Punishment methods
  async getPunishments(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Punishment>> {
    return await this.punishmentRepository.findAll(filter, params);
  }

  async createPunishment(punishment: Omit<Punishment, 'id' | 'created_at' | 'updated_at'>): Promise<Punishment> {
    const newPunishment = await this.punishmentRepository.create(punishment);
    await queueOfflineWrite('punishments', 'insert', newPunishment.id, newPunishment);
    return newPunishment;
  }

  async updatePunishment(id: string, punishment: Partial<Punishment>): Promise<Punishment> {
    const updatedPunishment = await this.punishmentRepository.update(id, punishment);
    await queueOfflineWrite('punishments', 'update', id, updatedPunishment);
    return updatedPunishment;
  }

  async deletePunishment(id: string): Promise<void> {
    await this.punishmentRepository.delete(id);
    await queueOfflineWrite('punishments', 'delete', id, null);
  }

  async getPunishmentsByEmployeeId(employeeId: string): Promise<Punishment[]> {
    return await this.punishmentRepository.findByEmployeeId(employeeId);
  }
}
