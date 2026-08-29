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

  // A finished/intermediate item can only be produced once its bill of
  // materials is defined — the BOM is what tells the system which raw
  // materials to withdraw and how to cost the run. Checked here (service
  // layer) so every entry point (production request, ad-hoc batch) is
  // guarded, not just one screen.
  async itemHasRecipe(itemId: string, recipeType: 'batch' | 'packaging'): Promise<boolean> {
    const recipes = await this.itemRecipeRepository.findByParentItemId(itemId);
    return recipes.some((r) => r.recipe_type === recipeType);
  }

  // ---- Production requests (factory employee -> purchasing manager) ------

  async createProductionRequest(itemId: string, requestedQty: number, requestedBy: string, rawMaterialWarehouseId: string, notes?: string): Promise<ProductionRequest> {
    if (!(await this.itemHasRecipe(itemId, 'batch'))) {
      throw new Error('لا يمكن طلب إنتاج هذا الصنف قبل تعريف تركيبته (BOM) لمرحلة الخلط. عرّف التركيبة أولاً من تبويب "تركيبات وجداول المواد".');
    }
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

  // qty of one BOM component needed to produce `outputQty` units of the parent.
  private componentQtyFor(component: ItemRecipe, outputQty: number): number {
    return component.mode === 'percentage'
      ? (Number(component.quantity_or_percentage) / 100) * outputQty
      : Number(component.quantity_or_percentage) * outputQty;
  }

  private async resolveFactoryWarehouseId(preferred?: string | null): Promise<string> {
    if (preferred) return preferred;
    const factory = await this.warehouseRepository.findFactory();
    if (!factory) {
      throw new Error('لا يوجد مخزن مصنّف كـ "مخزن المصنع" — أضف واحداً من الإعدادات > المستودعات قبل اعتماد الإنتاج.');
    }
    return factory.id;
  }

  // The materials plan for a production request/batch: how much of each raw
  // component is needed, how much is on hand at the raw store, and the
  // shortfall. Consumed by ProductionRequests.tsx before approval.
  async getProductionMaterialPlan(
    itemId: string,
    outputQty: number,
    rawWarehouseId: string
  ): Promise<{ component_item_id: string; requiredQty: number; onHand: number; shortfall: number }[]> {
    const recipes = await this.itemRecipeRepository.findByParentItemId(itemId);
    const bom = recipes.filter((r) => r.recipe_type === 'batch');
    const plan = [];
    for (const c of bom) {
      const requiredQty = this.componentQtyFor(c, outputQty);
      const onHand = await this.stockMovementRepository.calculateStock(c.component_item_id, rawWarehouseId);
      plan.push({
        component_item_id: c.component_item_id,
        requiredQty,
        onHand,
        shortfall: Math.max(0, requiredQty - onHand),
      });
    }
    return plan;
  }

  // Raw-materials warehouse keeper approves: the BOM-computed raw materials
  // for the requested quantity are TRANSFERRED from the raw store into the
  // factory (WIP) warehouse — paired transfer_out / transfer_in, so the
  // goods have physically moved, not vanished. They are consumed later, at
  // batch completion, inside the factory. Segregation of duties
  // (approver != requester) is also enforced server-side.
  async approveProductionRequestMaterials(requestId: string, approvedBy: string): Promise<ProductionRequest> {
    const request = await this.productionRequestRepository.findById(requestId);
    if (!request) throw new Error('طلب الإنتاج غير موجود');
    assertSegregationOfDuties({ requestedBy: request.requested_by, actingUserId: approvedBy, action: 'اعتماد وصرف الخامات' });

    const factoryWarehouseId = await this.resolveFactoryWarehouseId(request.factory_warehouse_id);

    const recipes = await this.itemRecipeRepository.findByParentItemId(request.item_id);
    const bomComponents = recipes.filter((r) => r.recipe_type === 'batch');
    if (bomComponents.length === 0) {
      throw new Error('لا توجد تركيبة (BOM) لمرحلة الخلط لهذا الصنف — لا يمكن اعتماد صرف الخامات.');
    }

    // Block the approval if the raw store can't cover the request, naming
    // the short items.
    const short: string[] = [];
    for (const component of bomComponents) {
      const need = this.componentQtyFor(component, request.requested_qty);
      const have = await this.stockMovementRepository.calculateStock(component.component_item_id, request.raw_material_warehouse_id);
      if (have + 1e-9 < need) short.push(`${component.component_item_id} (متاح ${have.toFixed(2)} / مطلوب ${need.toFixed(2)})`);
    }
    if (short.length > 0) {
      throw new Error(`رصيد مخزن الخامات لا يكفي: ${short.join('، ')}`);
    }

    for (const component of bomComponents) {
      const reqQty = this.componentQtyFor(component, request.requested_qty);

      const out = await this.stockMovementRepository.create({
        item_id: component.component_item_id,
        warehouse_id: request.raw_material_warehouse_id,
        qty: -reqQty,
        movement_type: 'transfer_out',
        ref_table: 'production_requests',
        ref_id: request.id,
        moved_at: new Date().toISOString()
      });
      await queueOfflineWrite('stock_movements', 'insert', out.id, out);

      const inn = await this.stockMovementRepository.create({
        item_id: component.component_item_id,
        warehouse_id: factoryWarehouseId,
        qty: reqQty,
        movement_type: 'transfer_in',
        ref_table: 'production_requests',
        ref_id: request.id,
        moved_at: new Date().toISOString()
      });
      await queueOfflineWrite('stock_movements', 'insert', inn.id, inn);
    }

    const updated = await this.productionRequestRepository.update(requestId, {
      status: 'materials_approved',
      material_approved_by: approvedBy,
      material_approved_at: new Date().toISOString(),
      factory_warehouse_id: factoryWarehouseId
    });
    await queueOfflineWrite('production_requests', 'update', requestId, updated);
    return updated;
  }

  // Factory employee starts the actual production run once materials are
  // approved. The raw materials are already sitting in the factory (WIP)
  // warehouse (moved there at approval); the batch is stamped with that
  // warehouse and its planned BOM consumption is recorded, to be posted as
  // real stock movements at completeBatch.
  async startProductionFromRequest(requestId: string, plannedQty: number): Promise<ProductionBatch> {
    const request = await this.productionRequestRepository.findById(requestId);
    if (!request) throw new Error('طلب الإنتاج غير موجود');
    if (request.status !== 'materials_approved') {
      throw new Error('لا يمكن بدء الإنتاج قبل اعتماد صرف الخامات');
    }

    const factoryWarehouseId = await this.resolveFactoryWarehouseId(request.factory_warehouse_id);

    const batchNo = `PENDING-BAT-${Date.now()}`;
    const newBatch = await this.productionBatchRepository.create({
      batch_no: batchNo,
      item_id: request.item_id,
      planned_qty: plannedQty,
      status: 'draft',
      production_request_id: request.id,
      warehouse_id: factoryWarehouseId
    });
    await queueOfflineWrite('production_batches', 'insert', newBatch.id, newBatch);

    const recipes = await this.itemRecipeRepository.findByParentItemId(request.item_id);
    for (const component of recipes.filter((r) => r.recipe_type === 'batch')) {
      const consumption = await this.productionConsumptionRepository.create({
        batch_id: newBatch.id,
        raw_item_id: component.component_item_id,
        qty_consumed: this.componentQtyFor(component, plannedQty)
      });
      await queueOfflineWrite('production_consumptions', 'insert', consumption.id, consumption);
    }

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
    if (!(await this.itemHasRecipe(batch.item_id, 'batch'))) {
      throw new Error('لا يمكن إنشاء دفعة إنتاج لصنف بدون تركيبة (BOM) معتمدة لمرحلة الخلط.');
    }
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

  // Records actuals and moves the batch to 'pending_qc' (Phase 2.7: output
  // isn't sellable stock until QC releases it — see releaseBatchQC). The
  // planned BOM consumption is posted now, at the batch's own warehouse:
  //   - request-linked batches: the factory (WIP) store the raw materials
  //     were transferred into at approval;
  //   - ad-hoc batches: the warehouseId passed by the caller.
  async completeBatch(id: string, actualQty: number, actualWastePct: number, warehouseId: string): Promise<ProductionBatch> {
    const batch = await this.productionBatchRepository.findById(id);
    if (!batch) {
      throw new Error('Production batch not found');
    }

    const consumeWarehouseId = batch.warehouse_id || warehouseId;

    const updatedBatch = await this.productionBatchRepository.update(id, {
      status: 'pending_qc',
      actual_qty: actualQty,
      actual_waste_pct: actualWastePct,
      produced_at: new Date().toISOString()
    });
    await queueOfflineWrite('production_batches', 'update', id, updatedBatch);

    const consumptions = await this.productionConsumptionRepository.findByBatchId(id);
    for (const consumption of consumptions) {
      const movement = await this.stockMovementRepository.create({
        item_id: consumption.raw_item_id,
        warehouse_id: consumeWarehouseId,
        qty: -Number(consumption.qty_consumed),
        movement_type: 'production_consumption',
        batch_no: batch.batch_no,
        ref_table: 'production_batches',
        ref_id: batch.id,
        moved_at: new Date().toISOString()
      });
      await queueOfflineWrite('stock_movements', 'insert', movement.id, movement);
    }

    return updatedBatch;
  }

  // QC release/reject — the batch producer cannot release/reject their own
  // batch (segregation of duties, enforced server-side too). Only on
  // release does the produced quantity actually become stock, credited to
  // the batch's own (factory) warehouse — a separate distribution order
  // then moves it from the factory to the main store. Rejecting leaves the
  // batch with no stock impact at all — the bad batch never reaches inventory.
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

    // Output is credited to where the batch was produced (its factory
    // warehouse); if for some reason the batch has no warehouse, fall back
    // to the main store, then to the caller's fallback.
    const mainWarehouse = await this.warehouseRepository.findMain();
    const outputWarehouseId = batch.warehouse_id || mainWarehouse?.id || warehouseIdFallback;
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
