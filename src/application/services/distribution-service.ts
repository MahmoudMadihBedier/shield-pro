import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';
import { DistributionOrder } from '../../core/domain/entities';

// Main-warehouse -> branch distribution: request -> admin approval -> ship
// (deduct main warehouse stock, "in transit") -> branch physical count ->
// match (auto-confirmed) or mismatch (routed to admin as a discrepancy,
// never silently adjusted by the receiver). Segregation of duties
// (requester != approver, sender != receiver) is enforced server-side by
// enforce_distribution_order_segregation_of_duties regardless of this layer.
export class DistributionService {
  private orderRepository = RepositoryFactory.getDistributionOrderRepository();
  private lineRepository = RepositoryFactory.getDistributionOrderLineRepository();
  private stockMovementRepository = RepositoryFactory.getStockMovementRepository();

  async createOrder(
    fromWarehouseId: string,
    toWarehouseId: string,
    requestedBy: string,
    lines: { item_id: string; qty: number }[],
    notes?: string
  ): Promise<DistributionOrder> {
    const order = await this.orderRepository.create({
      order_no: `PENDING-DIST-${Date.now()}`,
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      requested_by: requestedBy,
      status: 'pending_approval',
      notes
    });
    await queueOfflineWrite('distribution_orders', 'insert', order.id, order);

    for (const line of lines) {
      const newLine = await this.lineRepository.create({
        order_id: order.id,
        item_id: line.item_id,
        requested_qty: Math.abs(line.qty),
        received_qty: null
      });
      await queueOfflineWrite('distribution_order_lines', 'insert', newLine.id, newLine);
    }

    return order;
  }

  async getOrderLines(orderId: string) {
    return await this.lineRepository.findByOrderId(orderId);
  }

  async approveOrder(orderId: string, approvedBy: string): Promise<DistributionOrder> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new Error('طلب التوزيع غير موجود');
    if (order.requested_by === approvedBy) {
      throw new Error('لا يمكن لمن أنشأ الطلب اعتماده بنفسه');
    }
    const updated = await this.orderRepository.update(orderId, {
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString()
    });
    await queueOfflineWrite('distribution_orders', 'update', orderId, updated);
    return updated;
  }

  async rejectOrder(orderId: string, rejectedBy: string, reason: string): Promise<DistributionOrder> {
    const updated = await this.orderRepository.update(orderId, {
      status: 'rejected',
      approved_by: rejectedBy,
      approved_at: new Date().toISOString(),
      rejection_reason: reason
    });
    await queueOfflineWrite('distribution_orders', 'update', orderId, updated);
    return updated;
  }

  // Executed by the main warehouse manager once approved: deducts the main
  // warehouse's stock now (the goods are physically leaving), moving the
  // order to "in transit" until the branch confirms what actually arrived.
  async shipOrder(orderId: string): Promise<DistributionOrder> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new Error('طلب التوزيع غير موجود');
    if (order.status !== 'approved') throw new Error('لا يمكن الشحن قبل اعتماد الطلب');

    const lines = await this.lineRepository.findByOrderId(orderId);
    for (const line of lines) {
      const movement = await this.stockMovementRepository.create({
        item_id: line.item_id,
        warehouse_id: order.from_warehouse_id,
        qty: -Math.abs(line.requested_qty),
        movement_type: 'transfer_out',
        ref_table: 'distribution_orders',
        ref_id: order.id,
        moved_at: new Date().toISOString()
      });
      await queueOfflineWrite('stock_movements', 'insert', movement.id, movement);
    }

    const updated = await this.orderRepository.update(orderId, {
      status: 'in_transit',
      shipped_at: new Date().toISOString()
    });
    await queueOfflineWrite('distribution_orders', 'update', orderId, updated);
    return updated;
  }

  // Branch confirms what physically arrived. Matching quantities post
  // straight to branch stock; any mismatch stops short of touching stock at
  // all and instead flags the order for admin resolution (see
  // resolveDiscrepancy) — the receiver can never just silently adjust the number.
  async confirmReceipt(
    orderId: string,
    receivedBy: string,
    counts: { item_id: string; receivedQty: number }[]
  ): Promise<DistributionOrder> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new Error('طلب التوزيع غير موجود');
    if (order.status !== 'in_transit') throw new Error('لا يمكن تأكيد الاستلام قبل الشحن');
    if (order.requested_by === receivedBy) {
      throw new Error('لا يمكن لمن أرسل الشحنة تأكيد استلامها بنفسه');
    }

    const lines = await this.lineRepository.findByOrderId(orderId);
    let matched = true;

    for (const line of lines) {
      const counted = counts.find((c) => c.item_id === line.item_id)?.receivedQty ?? 0;
      const updatedLine = await this.lineRepository.update(line.id, { received_qty: counted });
      await queueOfflineWrite('distribution_order_lines', 'update', line.id, updatedLine);
      if (Number(counted) !== Number(line.requested_qty)) matched = false;
    }

    if (matched) {
      for (const line of lines) {
        const movement = await this.stockMovementRepository.create({
          item_id: line.item_id,
          warehouse_id: order.to_warehouse_id,
          qty: Math.abs(line.requested_qty),
          movement_type: 'transfer_in',
          ref_table: 'distribution_orders',
          ref_id: order.id,
          moved_at: new Date().toISOString()
        });
        await queueOfflineWrite('stock_movements', 'insert', movement.id, movement);
      }
    }

    const updated = await this.orderRepository.update(orderId, {
      status: matched ? 'received_matched' : 'received_discrepancy',
      received_by: receivedBy,
      received_at: new Date().toISOString()
    });
    await queueOfflineWrite('distribution_orders', 'update', orderId, updated);
    return updated;
  }

  // Admin investigates a flagged discrepancy and posts the final, agreed
  // quantity to branch stock — this is the only path that credits stock
  // after a mismatch, and it's a distinct step from the branch's own count.
  async resolveDiscrepancy(
    orderId: string,
    resolvedBy: string,
    finalCounts: { item_id: string; finalQty: number }[],
    notes?: string
  ): Promise<DistributionOrder> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new Error('طلب التوزيع غير موجود');
    if (order.status !== 'received_discrepancy') throw new Error('لا يوجد فرق بانتظار الحل لهذا الطلب');

    for (const c of finalCounts) {
      if (c.finalQty <= 0) continue;
      const movement = await this.stockMovementRepository.create({
        item_id: c.item_id,
        warehouse_id: order.to_warehouse_id,
        qty: Math.abs(c.finalQty),
        movement_type: 'transfer_in',
        ref_table: 'distribution_orders',
        ref_id: order.id,
        moved_at: new Date().toISOString()
      });
      await queueOfflineWrite('stock_movements', 'insert', movement.id, movement);
    }

    const updated = await this.orderRepository.update(orderId, {
      status: 'discrepancy_resolved',
      discrepancy_resolved_by: resolvedBy,
      discrepancy_resolved_at: new Date().toISOString(),
      discrepancy_notes: notes
    });
    await queueOfflineWrite('distribution_orders', 'update', orderId, updated);
    return updated;
  }
}
