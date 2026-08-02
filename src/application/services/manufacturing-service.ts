import { IManufacturingService } from '../../core/interfaces/services';
import { ItemRecipe, ProductionBatch, ProductionConsumption } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';

export class ManufacturingService implements IManufacturingService {
  private itemRecipeRepository = RepositoryFactory.getItemRecipeRepository();
  private productionBatchRepository = RepositoryFactory.getProductionBatchRepository();
  private productionConsumptionRepository = RepositoryFactory.getProductionConsumptionRepository();
  private stockMovementRepository = RepositoryFactory.getStockMovementRepository();

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
    const batch = await this.productionBatchRepository.findById(id);
    if (!batch) {
      throw new Error('Production batch not found');
    }

    // Consumption movements for raw materials, mirroring Manufacturing.tsx
    // confirmProductionBatch: required qty is driven by the recipe (BOM) for
    // this batch's item, scaled by the actual produced qty, deducted as
    // negative 'consumption' stock movements and recorded in
    // production_consumptions.
    const recipes = await this.itemRecipeRepository.findByParentItemId(batch.item_id);
    const productionRecipes = recipes.filter((r) => r.recipe_type === 'production');

    for (const recipe of productionRecipes) {
      const plannedQty = recipe.quantity_or_percentage * batch.planned_qty;
      const consumedQty = recipe.quantity_or_percentage * actualQty;

      const consumption = await this.productionConsumptionRepository.create({
        batch_id: batch.id,
        raw_item_id: recipe.component_item_id,
        planned_qty: plannedQty,
        actual_qty: consumedQty
      });
      await queueOfflineWrite('production_consumptions', 'insert', consumption.id, consumption);

      const consumptionMovement = await this.stockMovementRepository.create({
        item_id: recipe.component_item_id,
        warehouse_id: batch.warehouse_id,
        qty: -consumedQty,
        movement_type: 'consumption',
        batch_no: batch.batch_no,
        reference_type: 'production_batches',
        reference_id: batch.id
      });
      // See SalesService.createInvoice for why ref_table/ref_id/moved_at are
      // bridged onto the synced payload here (real runtime schema, not what
      // the StockMovement entity type declares).
      await queueOfflineWrite('stock_movements', 'insert', consumptionMovement.id, {
        ...consumptionMovement,
        ref_table: 'production_batches',
        ref_id: batch.id,
        moved_at: consumptionMovement.created_at
      });
    }

    // Production/receipt movement for the finished item, mirroring
    // Manufacturing.tsx: positive qty for the actual produced amount.
    const outputMovement = await this.stockMovementRepository.create({
      item_id: batch.item_id,
      warehouse_id: batch.warehouse_id,
      qty: actualQty,
      movement_type: 'production',
      batch_no: batch.batch_no,
      reference_type: 'production_batches',
      reference_id: batch.id
    });
    await queueOfflineWrite('stock_movements', 'insert', outputMovement.id, {
      ...outputMovement,
      ref_table: 'production_batches',
      ref_id: batch.id,
      moved_at: outputMovement.created_at
    });

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
