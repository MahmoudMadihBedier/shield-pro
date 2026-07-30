import { BaseRepository } from '../base-repository';
import { IWarehouseRepository } from '../../../core/interfaces/repository';
import { Warehouse } from '../../../core/domain/entities';

export class WarehouseRepository extends BaseRepository<Warehouse> implements IWarehouseRepository {
  constructor() {
    super('warehouses');
  }

  async findActive(): Promise<Warehouse[]> {
    return await this.table.filter((warehouse: Warehouse) => warehouse.is_active).toArray();
  }
}