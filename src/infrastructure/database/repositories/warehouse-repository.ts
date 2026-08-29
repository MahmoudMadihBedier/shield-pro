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

  async findMain(): Promise<Warehouse | undefined> {
    return await this.table.filter((warehouse: Warehouse) => warehouse.type === 'main').first();
  }

  async findByKind(kind: Warehouse['kind']): Promise<Warehouse[]> {
    return await this.table
      .filter((w: Warehouse) => w.kind === kind && w.is_active)
      .toArray();
  }

  // The single raw-materials / factory store the cycle routes goods through.
  // If more than one is configured, the first active one wins.
  async findRawMaterials(): Promise<Warehouse | undefined> {
    return (await this.findByKind('raw_materials'))[0];
  }

  async findFactory(): Promise<Warehouse | undefined> {
    return (await this.findByKind('factory'))[0];
  }
}