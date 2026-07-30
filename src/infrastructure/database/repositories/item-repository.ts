import { BaseRepository } from '../base-repository';
import { IItemRepository } from '../../../core/interfaces/repository';
import { Item } from '../../../core/domain/entities';

export class ItemRepository extends BaseRepository<Item> implements IItemRepository {
  constructor() {
    super('items');
  }

  async findByType(type: string): Promise<Item[]> {
    return await this.table.filter((item: Item) => item.type === type).toArray();
  }

  async findByBarcode(barcode: string): Promise<Item | undefined> {
    return await this.table
      .filter((item: Item) => item.barcode === barcode || item.carton_barcode === barcode)
      .first();
  }

  async searchByName(query: string): Promise<Item[]> {
    const lowerQuery = query.toLowerCase();
    return await this.table
      .filter((item: Item) => item.name.toLowerCase().includes(lowerQuery))
      .toArray();
  }
}