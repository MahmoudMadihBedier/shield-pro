import { IManufacturingService } from '../../core/interfaces/services';
import { ItemRecipe, ProductionBatch, ProductionConsumption, ProductionRequest } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';
import { getSetting } from '../../shared/utils/settings-helper';
import { assertSegregationOfDuties } from './segregation-of-duties-guard';

export class ManufacturingService implements IManufacturingService {
  private itemRecipeRepository = RepositoryFactory.getItemRecipeRepository();
  private productionBatchRepository = RepositoryFactory.getProductionBatchRepository();
  private productionConsumptionRepository = RepositoryFactory.getProductionConsumptionRepository();
  private stockMovementRepository = RepositoryFactory.getStockMovementRepository();
  private productionRequestRepository = RepositoryFactory.getProductionRequestRepository();
  private warehouseRepository = RepositoryFactory.getWarehouseRepository();

  // ---- Production requests (factory employee -> purchasing manager) ------

  async createProductionRequest(itemId: string, requestedQty: number, requestedBy: string, rawMaterialWarehouseId: string, notes?: string): Promise<ProductionRequest> {
    const request = await this.productionRequestRepository.create({
      item_id: itemId,
      requested_qty: requestedQty,
      requested_by: requestedBy,
      raw_material_warehouse_id: rawMaterialWarehouseId,
      status: 'pending_materials',
      notes
    });
    await queueOfflineWrite('production_requests', 'insert', request.id, request);
    return request;
  }

  async getProductionRequests(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<ProductionRequest>> {
    return await this.productionRequestRepository.findAll(filter, params);
  }

  // Purchasing warehouse manager approves: withdraws the BOM-computed raw
  // materials from raw_material_warehouse_id right away (the actual
  // withdrawal act the workflow describes), and unblocks production.
  // Segregation of duties (approver != requester) is enforced server-side by
  // enforce_production_request_segregation_of_duties regardless of this check.
  async approveProductionRequestMaterials(requestId: string, approvedBy: string): Promise<ProductionRequest> {
    const request = await this.productionRequestRepository.findById(requestId);
    if (!request) throw new Error('طلب الإنتاج غير موجود');
    assertSegregationOfDuties({ requestedBy: request.requested_by, actingUserId: approvedBy, action: 'اعتماد وصرف الخامات' });

    const recipes = await this.itemRecipeRepository.findByParentItemId(request.item_id);
    const bomComponents = recipes.filter((r) => r.recipe_type === 'batch');

    for (const component of bomComponents) {
      const reqQty = component.mode === 'percentage'
        ? (component.quantity_or_percentage / 100) * request.requested_qty
        : component.quantity_or_percentage * request.requested_qty;

      const movement = await this.stockMovementRepository.create({
        item_id: component.component_item_id,
        warehouse_id: request.raw_material_warehouse_id,
        qty: -reqQty,
        movement_type: 'production_consumption',
        ref_table: 'production_requests',
        ref_id: request.id,
        moved_at: new Date().toISOString()
      });
      await queueOfflineWrite('stock_movements', 'insert', movement.id, movement);
    }

    const updated = await this.productionRequestRepository.update(requestId, {
      status: 'materials_approved',
      material_approved_by: approvedBy,
      material_approved_at: new Date().toISOString()
    });
    await queueOfflineWrite('production_requests', 'update', requestId, updated);
    return updated;
  }

  // Factory employee starts the actual production run once materials are
  // approved. Creates the batch WITHOUT re-planning a BOM consumption (the
  // materials were already withdrawn in approveProductionRequestMaterials
  // above) and links it back to the request so completeBatch knows not to
  // deduct raw materials a second time.
  async startProductionFromRequest(requestId: string, plannedQty: number): Promise<ProductionBatch> {
    const request = await this.productionRequestRepository.findById(requestId);
    if (!request) throw new Error('طلب الإنتاج غير موجود');
    if (request.status !== 'materials_approved') {
      throw new Error('لا يمكن بدء الإنتاج قبل اعتماد صرف الخامات');
    }

    const batchNo = `PENDING-BAT-${Date.now()}`;
    const newBatch = await this.productionBatchRepository.create({
      batch_no: batchNo,
      item_id: request.item_id,
      planned_qty: plannedQty,
      status: 'draft',
      production_request_id: request.id
    });
    await queueOfflineWrite('production_batches', 'insert', newBatch.id, newBatch);

    const updatedRequest = await this.productionRequestRepository.update(requestId, {
      status: 'in_production',
      production_batch_id: newBatch.id
    });
    await queueOfflineWrite('production_requests', 'update', requestId, updatedRequest);

    return newBatch;
  }

  async rejectProductionRequest(requestId: string, rejectedBy: string, reason: string): Promise<ProductionRequest> {
    const request = await this.productionRequestRepository.findById(requestId);
    if (!request) throw new Error('طلب الإنتاج غير موجود');
    const updated = await this.productionRequestRepository.update(requestId, {
      status: 'rejected',
      material_approved_by: rejectedBy,
      material_approved_at: new Date().toISOString(),
      rejection_reason: reason
    });
    await queueOfflineWrite('production_requests', 'update', requestId, updated);
    return updated;
  }

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

  // Mirrors Manufacturing.tsx's original confirmProductionBatch, with three
  // additions: (1) if this batch originated from an approved
  // ProductionRequest, its raw materials were already withdrawn at approval
  // time — posting a second consumption deduction here would double-count
  // it, so that step is skipped; (2) output does NOT become sellable stock
  // yet — status goes to 'pending_qc', not 'completed' (Phase 2.7: a bad
  // batch must be caught before reaching a customer) — see releaseBatchQC
  // for the step that actually posts the output movement; (3) once
  // released, the produced quantity is auto-routed to the MAIN warehouse,
  // scaled by the admin-configurable main_warehouse_auto_stock_pct setting.
  async completeBatch(id: string, actualQty: number, actualWastePct: number, warehouseId: string): Promise<ProductionBatch> {
    const batch = await this.productionBatchRepository.findById(id);
    if (!batch) {
      throw new Error('Production batch not found');
    }

    const updatedBatch = await this.productionBatchRepository.update(id, {
      status: 'pending_qc',
      actual_qty: actualQty,
      actual_waste_pct: actualWastePct,
      produced_at: new Date().toISOString()
    });
    await queueOfflineWrite('production_batches', 'update', id, updatedBatch);

    if (!batch.production_request_id) {
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
    }

    return updatedBatch;
  }

  // QC release/reject — the batch producer cannot release/reject their own
  // batch (segregation of duties, enforced server-side too). Only on
  // release does the produced quantity actually become stock, auto-routed
  // to the main warehouse per main_warehouse_auto_stock_pct. Rejecting
  // leaves the batch with no stock impact at all — the bad batch never
  // reaches inventory.
  async releaseBatchQC(batchId: string, releasedBy: string, approve: boolean, warehouseIdFallback: string, rejectionReason?: string): Promise<ProductionBatch> {
    const batch = await this.productionBatchRepository.findById(batchId);
    if (!batch) throw new Error('Production batch not found');
    if (batch.status !== 'pending_qc') throw new Error('هذه الدفعة ليست بانتظار فحص الجودة');
    if (batch.created_by) {
      assertSegregationOfDuties({ requestedBy: batch.created_by, actingUserId: releasedBy, action: 'اعتماد/رفض فحص الجودة' });
    }

    if (!approve) {
      const rejected = await this.productionBatchRepository.update(batchId, {
        status: 'rejected',
        qc_released_by: releasedBy,
        qc_released_at: new Date().toISOString(),
        qc_rejection_reason: rejectionReason
      });
      await queueOfflineWrite('production_batches', 'update', batchId, rejected);
      return rejected;
    }

    const mainWarehouse = await this.warehouseRepository.findMain();
    const outputWarehouseId = mainWarehouse?.id || warehouseIdFallback;
    const autoStockPct = Number(await getSetting('main_warehouse_auto_stock_pct', '100'));
    const creditedQty = Number(batch.actual_qty || 0) * (autoStockPct / 100);

    const outputMovement = await this.stockMovementRepository.create({
      item_id: batch.item_id,
      warehouse_id: outputWarehouseId,
      qty: creditedQty,
      movement_type: 'production_output',
      batch_no: batch.batch_no,
      ref_table: 'production_batches',
      ref_id: batch.id,
      moved_at: new Date().toISOString()
    });
    await queueOfflineWrite('stock_movements', 'insert', outputMovement.id, outputMovement);

    const released = await this.productionBatchRepository.update(batchId, {
      status: 'released',
      qc_released_by: releasedBy,
      qc_released_at: new Date().toISOString()
    });
    await queueOfflineWrite('production_batches', 'update', batchId, released);

    if (batch.production_request_id) {
      const req = await this.productionRequestRepository.findById(batch.production_request_id);
      if (req) {
        const updatedReq = await this.productionRequestRepository.update(req.id, { status: 'completed' });
        await queueOfflineWrite('production_requests', 'update', req.id, updatedReq);
      }
    }

    return released;
  }

  async getBatchConsumptions(batchId: string): Promise<ProductionConsumption[]> {
    return await this.productionConsumptionRepository.findByBatchId(batchId);
  }
}
