import { BaseRepository } from '../base-repository';
import { ISupplierRepository } from '../../../core/interfaces/repository';
import { Supplier } from '../../../core/domain/entities';

export class SupplierRepository extends BaseRepository<Supplier> implements ISupplierRepository {
  constructor() {
    super('suppliers');
  }

  async searchByName(query: string): Promise<Supplier[]> {
    const lowerQuery = query.toLowerCase();
    return await this.table
      .filter((supplier: Supplier) => supplier.name.toLowerCase().includes(lowerQuery))
      .toArray();
  }
}
