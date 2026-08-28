import { IInventoryService } from '../../core/interfaces/services';
import { Item, StockMovement } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';

export class InventoryService implements IInventoryService {
  private itemRepository = RepositoryFactory.getItemRepository();
  private stockMovementRepository = RepositoryFactory.getStockMovementRepository();

  async getItems(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Item>> {
    return await this.itemRepository.findAll(filter, params);
  }

  async getItemById(id: string): Promise<Item | undefined> {
    return await this.itemRepository.findById(id);
  }

  async createItem(item: Omit<Item, 'id' | 'created_at' | 'updated_at'>): Promise<Item> {
    const newItem = await this.itemRepository.create(item);
    await queueOfflineWrite('items', 'insert', newItem.id, newItem);
    return newItem;
  }

  async updateItem(id: string, item: Partial<Item>): Promise<Item> {
    const updatedItem = await this.itemRepository.update(id, item);
    await queueOfflineWrite('items', 'update', id, updatedItem);
    return updatedItem;
  }

  async deleteItem(id: string): Promise<void> {
    await this.itemRepository.delete(id);
    await queueOfflineWrite('items', 'delete', id, { id });
  }

  async searchItems(query: string): Promise<Item[]> {
    return await this.itemRepository.searchByName(query);
  }

  async calculateStock(itemId: string, warehouseId?: string): Promise<number> {
    return await this.stockMovementRepository.calculateStock(itemId, warehouseId);
  }

  async getLowStockItems(threshold?: number): Promise<Item[]> {
    const items = await this.itemRepository.findAll();
    const lowStockItems: Item[] = [];

    for (const item of items.data) {
      const stock = await this.calculateStock(item.id);
      const reorderLevel = threshold !== undefined ? threshold : item.reorder_level;
      if (stock <= reorderLevel) {
        lowStockItems.push({ ...item, currentStock: stock });
      }
    }

    return lowStockItems;
  }

  async createStockMovement(movement: Omit<StockMovement, 'id' | 'created_at' | 'updated_at'>): Promise<StockMovement> {
    const newMovement = await this.stockMovementRepository.create(movement);
    await queueOfflineWrite('stock_movements', 'insert', newMovement.id, newMovement);
    return newMovement;
  }

  async getStockMovements(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<StockMovement>> {
    return await this.stockMovementRepository.findAll(filter, params);
  }
}