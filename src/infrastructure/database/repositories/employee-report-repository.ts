import { BaseRepository } from '../base-repository';
import { IEmployeeReportRepository } from '../../../core/interfaces/repository';
import { EmployeeReport } from '../../../core/domain/entities';

export class EmployeeReportRepository extends BaseRepository<EmployeeReport> implements IEmployeeReportRepository {
  constructor() {
    super('employee_reports');
  }

  async findByReporterId(reporterId: string): Promise<EmployeeReport[]> {
    return await this.table
      .filter((report: EmployeeReport) => report.reporter_id === reporterId)
      .toArray();
  }

  async findByReportedEmployeeId(reportedEmployeeId: string): Promise<EmployeeReport[]> {
    return await this.table
      .filter((report: EmployeeReport) => report.reported_employee_id === reportedEmployeeId)
      .toArray();
  }

  async findByStatus(status: string): Promise<EmployeeReport[]> {
    return await this.table
      .filter((report: EmployeeReport) => report.status === status)
      .toArray();
  }
}
