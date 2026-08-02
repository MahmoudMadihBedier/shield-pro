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

  // Mirrors Manufacturing.tsx's original handleCreateProductionOrder: create
  // the draft batch, then pre-compute (but don't yet move stock for) the
  // BOM-driven consumption plan from the 'batch'-stage recipe, storing one
  // production_consumptions row per component. Actual stock movements only
  // happen later, in completeBatch, using these stored quantities.
  async createBatch(batch: Omit<ProductionBatch, 'id' | 'created_at' | 'updated_at'>): Promise<ProductionBatch> {
    const newBatch = await this.productionBatchRepository.create(batch);
    await queueOfflineWrite('production_batches', 'insert', newBatch.id, newBatch);

    const recipes = await this.itemRecipeRepository.findByParentItemId(newBatch.item_id);
    const bomComponents = recipes.filter((r) => r.recipe_type === 'batch');

    for (const component of bomComponents) {
      const reqQty = component.mode === 'percentage'
        ? (component.quantity_or_percentage / 100) * newBatch.planned_qty
        : component.quantity_or_percentage * newBatch.planned_qty;

      const consumption = await this.productionConsumptionRepository.create({
        batch_id: newBatch.id,
        raw_item_id: component.component_item_id,
        qty_consumed: reqQty
      });
      await queueOfflineWrite('production_consumptions', 'insert', consumption.id, consumption);
    }

    return newBatch;
  }

  async updateBatch(id: string, batch: Partial<ProductionBatch>): Promise<ProductionBatch> {
    const updatedBatch = await this.productionBatchRepository.update(id, batch);
    await queueOfflineWrite('production_batches', 'update', id, updatedBatch);
    return updatedBatch;
  }

  // Mirrors Manufacturing.tsx's original confirmProductionBatch: mark the
  // batch completed, deduct the *stored* consumption-plan quantities (not
  // recomputed from the recipe again) as 'production_consumption' stock
  // movements, and add a 'production_output' movement for the actual
  // produced qty. warehouseId is passed in (not read off the batch) because
  // production_batches has no warehouse_id column — only stock_movements does.
  async completeBatch(id: string, actualQty: number, actualWastePct: number, warehouseId: string): Promise<ProductionBatch> {
    const batch = await this.productionBatchRepository.findById(id);
    if (!batch) {
      throw new Error('Production batch not found');
    }

    const updatedBatch = await this.productionBatchRepository.update(id, {
      status: 'completed',
      actual_qty: actualQty,
      actual_waste_pct: actualWastePct,
      produced_at: new Date().toISOString()
    });
    await queueOfflineWrite('production_batches', 'update', id, updatedBatch);

    const consumptions = await this.productionConsumptionRepository.findByBatchId(id);
    for (const consumption of consumptions) {
      const movement = await this.stockMovementRepository.create({
        item_id: consumption.raw_item_id,
        warehouse_id: warehouseId,
        qty: -Number(consumption.qty_consumed),
        movement_type: 'production_consumption',
        batch_no: batch.batch_no,
        ref_table: 'production_batches',
        ref_id: batch.id,
        moved_at: new Date().toISOString()
      });
      await queueOfflineWrite('stock_movements', 'insert', movement.id, movement);
    }

    const outputMovement = await this.stockMovementRepository.create({
      item_id: batch.item_id,
      warehouse_id: warehouseId,
      qty: actualQty,
      movement_type: 'production_output',
      batch_no: batch.batch_no,
      ref_table: 'production_batches',
      ref_id: batch.id,
      moved_at: new Date().toISOString()
    });
    await queueOfflineWrite('stock_movements', 'insert', outputMovement.id, outputMovement);

    return updatedBatch;
  }

  async getBatchConsumptions(batchId: string): Promise<ProductionConsumption[]> {
    return await this.productionConsumptionRepository.findByBatchId(batchId);
  }
}
