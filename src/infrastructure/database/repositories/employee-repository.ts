import { BaseRepository } from '../base-repository';
import { IEmployeeRepository } from '../../../core/interfaces/repository';
import { Employee } from '../../../core/domain/entities';

export class EmployeeRepository extends BaseRepository<Employee> implements IEmployeeRepository {
  constructor() {
    super('employees');
  }

  async searchByName(query: string): Promise<Employee[]> {
    const lowerQuery = query.toLowerCase();
    return await this.table
      .filter((employee: Employee) => employee.name.toLowerCase().includes(lowerQuery))
      .toArray();
  }
}
