import { IHRService } from '../../core/interfaces/services';
import { Employee, Attendance, PayrollRun } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';

export class HRService implements IHRService {
  private employeeRepository = RepositoryFactory.getEmployeeRepository();
  private attendanceRepository = RepositoryFactory.getAttendanceRepository();
  private payrollRunRepository = RepositoryFactory.getPayrollRunRepository();

  async getEmployees(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Employee>> {
    return await this.employeeRepository.findAll(filter, params);
  }

  async createEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee> {
    const newEmployee = await this.employeeRepository.create(employee);
    await queueOfflineWrite('employees', 'insert', newEmployee.id, newEmployee);
    return newEmployee;
  }

  async updateEmployee(id: string, employee: Partial<Employee>): Promise<Employee> {
    const updatedEmployee = await this.employeeRepository.update(id, employee);
    await queueOfflineWrite('employees', 'update', id, updatedEmployee);
    return updatedEmployee;
  }

  async getAttendance(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Attendance>> {
    return await this.attendanceRepository.findAll(filter, params);
  }

  async recordAttendance(attendance: Omit<Attendance, 'id' | 'created_at' | 'updated_at'>): Promise<Attendance> {
    const newAttendance = await this.attendanceRepository.create(attendance);
    await queueOfflineWrite('attendance', 'insert', newAttendance.id, newAttendance);
    return newAttendance;
  }

  async getPayrollRuns(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<PayrollRun>> {
    return await this.payrollRunRepository.findAll(filter, params);
  }

  async createPayrollRun(payroll: Omit<PayrollRun, 'id' | 'created_at' | 'updated_at'>): Promise<PayrollRun> {
    // NOTE: The current UI handler (HR.tsx) also posts accounting journal
    // entries (salary expense) via postDoubleEntry when a payroll run is
    // created. That side effect stays in the component for this pass and
    // will move into this service in the next phase.
    const newPayrollRun = await this.payrollRunRepository.create(payroll);
    await queueOfflineWrite('payroll_runs', 'insert', newPayrollRun.id, newPayrollRun);
    return newPayrollRun;
  }
}
