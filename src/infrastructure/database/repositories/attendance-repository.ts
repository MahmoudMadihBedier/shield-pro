import { BaseRepository } from '../base-repository';
import { IAttendanceRepository } from '../../../core/interfaces/repository';
import { Attendance } from '../../../core/domain/entities';

export class AttendanceRepository extends BaseRepository<Attendance> implements IAttendanceRepository {
  constructor() {
    super('attendance');
  }

  async findByEmployeeId(employeeId: string): Promise<Attendance[]> {
    return await this.table.filter((attendance: Attendance) => attendance.employee_id === employeeId).toArray();
  }

  async findByDateRange(startDate: string, endDate: string): Promise<Attendance[]> {
    return await this.table
      .filter((attendance: Attendance) => attendance.date >= startDate && attendance.date <= endDate)
      .toArray();
  }
}
