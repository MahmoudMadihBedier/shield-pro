import { BaseRepository } from '../base-repository';
import { ITaskRepository } from '../../../core/interfaces/repository';
import { Task } from '../../../core/domain/entities';

export class TaskRepository extends BaseRepository<Task> implements ITaskRepository {
  constructor() {
    super('tasks');
  }

  async findByEmployeeId(employeeId: string): Promise<Task[]> {
    return await this.table
      .filter((task: Task) => task.employee_id === employeeId)
      .toArray();
  }

  async findByStatus(status: string): Promise<Task[]> {
    return await this.table
      .filter((task: Task) => task.status === status)
      .toArray();
  }
}
