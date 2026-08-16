import { IHRService } from '../../core/interfaces/services';
import { Employee, Attendance, PayrollRun } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';
import { postDoubleEntry } from './accounting-helpers';

// Salaries Expense account code, matching the lookup HR.tsx handleRunPayroll
// already does: accounts.find(a => a.code === '60101').
const SALARIES_EXPENSE_ACCOUNT_CODE = '60101';

export class HRService implements IHRService {
  private employeeRepository = RepositoryFactory.getEmployeeRepository();
  private attendanceRepository = RepositoryFactory.getAttendanceRepository();
  private payrollRunRepository = RepositoryFactory.getPayrollRunRepository();
  private accountRepository = RepositoryFactory.getAccountRepository();

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
    // Mirrors HR.tsx handleRunPayroll's formula: net = base + allowances - deductions,
    // computed fresh here rather than trusting the caller-supplied net_pay.
    const netPay = Number(payroll.base) + Number(payroll.allowances) - Number(payroll.deductions);
    const newPayrollRun = await this.payrollRunRepository.create({ ...payroll, net_pay: netPay });
    await queueOfflineWrite('payroll_runs', 'insert', newPayrollRun.id, newPayrollRun);

    // Journal entry, mirroring HR.tsx handleRunPayroll: debit the Salaries
    // Expense account (code '60101'), credit the 'cash' category account.
    const salariesExpAcc = await this.accountRepository.findByCode(SALARIES_EXPENSE_ACCOUNT_CODE);
    const cashAcc = (await this.accountRepository.findByCategory('cash'))[0]?.id;
    if (!salariesExpAcc) {
      console.warn('Salaries expense account not found, skipping journal entry for payroll:', newPayrollRun.id);
    } else if (!cashAcc) {
      console.warn('Cash account not found, skipping journal entry for payroll:', newPayrollRun.id);
    } else {
      await postDoubleEntry({
        refTable: 'payroll_runs',
        refId: newPayrollRun.id,
        debitAccountId: salariesExpAcc.id,
        creditAccountId: cashAcc,
        amount: netPay
      });
    }

    return newPayrollRun;
  }
}
