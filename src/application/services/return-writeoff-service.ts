import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';
import { ReturnWriteoffRequest } from '../../core/domain/entities';
import { assertSegregationOfDuties } from './segregation-of-duties-guard';

// Phase 2.8 — a customer return or a damaged/write-off item never just
// silently vanishes from the books. A request is filed, a DIFFERENT person
// approves it, and only on approval does a real, traceable stock movement
// get posted (sales_return_in for returns, manual_adjustment for
// write-offs) — never a direct stock edit.
export class ReturnWriteoffService {
  private requestRepository = RepositoryFactory.getReturnWriteoffRequestRepository();
  private stockMovementRepository = RepositoryFactory.getStockMovementRepository();

  async createRequest(
    requestType: 'customer_return' | 'damage_writeoff',
    itemId: string,
    warehouseId: string,
    qty: number,
    reason: string,
    requestedBy: string,
    customerId?: string
  ): Promise<ReturnWriteoffRequest> {
    const request = await this.requestRepository.create({
      request_type: requestType,
      item_id: itemId,
      warehouse_id: warehouseId,
      qty: Math.abs(qty),
      customer_id: customerId ?? null,
      reason,
      requested_by: requestedBy,
      status: 'pending'
    });
    await queueOfflineWrite('return_writeoff_requests', 'insert', request.id, request);
    return request;
  }

  async getRequests(status?: string): Promise<ReturnWriteoffRequest[]> {
    return status
      ? await this.requestRepository.findByStatus(status)
      : (await this.requestRepository.findAll(undefined, { page: 1, limit: Number.MAX_SAFE_INTEGER })).data;
  }

  async approveRequest(requestId: string, approvedBy: string): Promise<ReturnWriteoffRequest> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) throw new Error('الطلب غير موجود');
    assertSegregationOfDuties({ requestedBy: request.requested_by, actingUserId: approvedBy, action: 'اعتماد طلب المرتجع/الإتلاف' });

    // Customer returns credit stock back in (sales_return_in); write-offs
    // remove it permanently (manual_adjustment, negative — the item is
    // damaged/lost, not coming back to sellable stock).
    const movement = await this.stockMovementRepository.create({
      item_id: request.item_id,
      warehouse_id: request.warehouse_id,
      qty: request.request_type === 'customer_return' ? Math.abs(request.qty) : -Math.abs(request.qty),
      movement_type: request.request_type === 'customer_return' ? 'sales_return_in' : 'manual_adjustment',
      ref_table: 'return_writeoff_requests',
      ref_id: request.id,
      moved_at: new Date().toISOString()
    });
    await queueOfflineWrite('stock_movements', 'insert', movement.id, movement);

    const updated = await this.requestRepository.update(requestId, {
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString()
    });
    await queueOfflineWrite('return_writeoff_requests', 'update', requestId, updated);
    return updated;
  }

  async rejectRequest(requestId: string, rejectedBy: string, reason: string): Promise<ReturnWriteoffRequest> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) throw new Error('الطلب غير موجود');
    assertSegregationOfDuties({ requestedBy: request.requested_by, actingUserId: rejectedBy, action: 'رفض طلب المرتجع/الإتلاف' });

    const updated = await this.requestRepository.update(requestId, {
      status: 'rejected',
      approved_by: rejectedBy,
      approved_at: new Date().toISOString(),
      rejection_reason: reason
    });
    await queueOfflineWrite('return_writeoff_requests', 'update', requestId, updated);
    return updated;
  }
}
