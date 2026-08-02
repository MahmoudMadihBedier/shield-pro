import { BaseRepository } from '../base-repository';
import { ICustomerRepository } from '../../../core/interfaces/repository';
import { Customer } from '../../../core/domain/entities';

export class CustomerRepository extends BaseRepository<Customer> implements ICustomerRepository {
  constructor() {
    super('customers');
  }

  async searchByName(query: string): Promise<Customer[]> {
    const lowerQuery = query.toLowerCase();
    return await this.table
      .filter((customer: Customer) => customer.name.toLowerCase().includes(lowerQuery))
      .toArray();
  }
}
