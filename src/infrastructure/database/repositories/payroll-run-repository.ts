import { BaseRepository } from '../base-repository';
import { IPayrollRunRepository } from '../../../core/interfaces/repository';
import { PayrollRun } from '../../../core/domain/entities';

export class PayrollRunRepository extends BaseRepository<PayrollRun> implements IPayrollRunRepository {
  constructor() {
    super('payroll_runs');
  }

  async findByMonth(month: string): Promise<PayrollRun[]> {
    return await this.table.filter((run: PayrollRun) => run.month === month).toArray();
  }

  async findByEmployeeId(employeeId: string): Promise<PayrollRun[]> {
    return await this.table.filter((run: PayrollRun) => run.employee_id === employeeId).toArray();
  }
}
