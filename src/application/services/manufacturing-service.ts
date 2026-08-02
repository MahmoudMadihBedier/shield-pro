import { IManufacturingService } from '../../core/interfaces/services';
import { ItemRecipe, ProductionBatch, ProductionConsumption } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';

export class ManufacturingService implements IManufacturingService {
  private itemRecipeRepository = RepositoryFactory.getItemRecipeRepository();
  private productionBatchRepository = RepositoryFactory.getProductionBatchRepository();
  private productionConsumptionRepository = RepositoryFactory.getProductionConsumptionRepository();

  async getRecipes(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<ItemRecipe>> {
    return await this.itemRecipeRepository.findAll(filter, params);
  }

  async createRecipe(recipe: Omit<ItemRecipe, 'id' | 'created_at' | 'updated_at'>): Promise<ItemRecipe> {
    const newRecipe = await this.itemRecipeRepository.create(recipe);
    await queueOfflineWrite('item_recipes', 'insert', newRecipe.id, newRecipe);
    return newRecipe;
  }

  async getBatches(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<ProductionBatch>> {
    return await this.productionBatchRepository.findAll(filter, params);
  }

  async createBatch(batch: Omit<ProductionBatch, 'id' | 'created_at' | 'updated_at'>): Promise<ProductionBatch> {
    const newBatch = await this.productionBatchRepository.create(batch);
    await queueOfflineWrite('production_batches', 'insert', newBatch.id, newBatch);
    return newBatch;
  }

  async updateBatch(id: string, batch: Partial<ProductionBatch>): Promise<ProductionBatch> {
    const updatedBatch = await this.productionBatchRepository.update(id, batch);
    await queueOfflineWrite('production_batches', 'update', id, updatedBatch);
    return updatedBatch;
  }

  async completeBatch(id: string, actualQty: number): Promise<ProductionBatch> {
    // NOTE: The current UI handler (Manufacturing.tsx) also creates stock
    // movements here (consuming raw materials, producing finished goods).
    // Those side effects stay in the component for this pass and will move
    // into this service in the next phase.
    const updatedBatch = await this.productionBatchRepository.update(id, {
      status: 'completed',
      actual_qty: actualQty
    });
    await queueOfflineWrite('production_batches', 'update', id, updatedBatch);
    return updatedBatch;
  }

  async getBatchConsumptions(batchId: string): Promise<ProductionConsumption[]> {
    return await this.productionConsumptionRepository.findByBatchId(batchId);
  }
}
