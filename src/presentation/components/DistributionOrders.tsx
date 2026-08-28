import React, { useCallback, useEffect, useState } from 'react';
import { db } from '../../infrastructure/database/dexie';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { ServiceFactory } from '../../application/services/service-factory';
import { useAuth } from '../../application/services/auth-service';
import { useToast } from './ui/Toast';
import { getErrorMessage } from '../../shared/utils/errors';
import { Truck } from 'lucide-react';

// Main warehouse -> branch distribution: request -> admin approval -> ship
// (main stock deducted, "in transit") -> branch physical count -> matched
// (auto-confirmed) or a discrepancy routed to an admin to resolve. Every
// hand-off here is a different person by design (segregation of duties),
// enforced server-side too — this UI just reflects what's actually allowed.
export const DistributionOrders: React.FC = () => {
  const { profile, checkPermission } = useAuth();
  const { success, error } = useToast();
  const distributionService = ServiceFactory.getDistributionService();

  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [linesByOrder, setLinesByOrder] = useState<{ [orderId: string]: any[] }>({});
  const [loading, setLoading] = useState(false);

  const [fromWh, setFromWh] = useState('');
  const [toWh, setToWh] = useState('');
  const [orderLines, setOrderLines] = useState<{ item_id: string; qty: number }[]>([{ item_id: '', qty: 1 }]);

  const [rejectReasonById, setRejectReasonById] = useState<{ [id: string]: string }>({});
  const [receiveCountsById, setReceiveCountsById] = useState<{ [orderId: string]: { [itemId: string]: string } }>({});

  const canApprove = checkPermission('settings', 'edit') || checkPermission('inventory', 'edit');
  const canShip = checkPermission('inventory', 'edit');
  const canReceive = checkPermission('inventory', 'edit');

  const loadData = useCallback(async () => {
    const [listItems, listWarehouses, listOrders, listLines] = await Promise.all([
      db.items.toArray(),
      RepositoryFactory.getWarehouseRepository().findActive(),
      db.distribution_orders.toArray(),
      db.distribution_order_lines.toArray()
    ]);
    setItems(listItems);
    setWarehouses(listWarehouses);
    setOrders(listOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    const grouped: { [orderId: string]: any[] } = {};
    for (const l of listLines) {
      grouped[l.order_id] = grouped[l.order_id] || [];
      grouped[l.order_id].push(l);
    }
    setLinesByOrder(grouped);

    const main = listWarehouses.find((w: any) => w.type === 'main');
    if (main && !fromWh) setFromWh(main.id);
  }, [fromWh]);

  useEffect(() => { loadData(); }, [loadData]);

  const itemName = (id: string) => items.find((i) => i.id === id)?.name || id;
  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name || id;

  const handleAddLine = () => setOrderLines([...orderLines, { item_id: '', qty: 1 }]);
  const handleLineChange = (idx: number, field: 'item_id' | 'qty', value: string) => {
    const updated = [...orderLines];
    updated[idx] = { ...updated[idx], [field]: field === 'qty' ? Number(value) : value };
    setOrderLines(updated);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !fromWh || !toWh || fromWh === toWh || orderLines.some((l) => !l.item_id || l.qty <= 0)) {
      error('يرجى اختيار مخزنين مختلفين وتعبئة كل الأصناف والكميات');
      return;
    }
    setLoading(true);
    try {
      await distributionService.createOrder(fromWh, toWh, profile.id, orderLines);
      success('تم إرسال طلب التوزيع بانتظار الاعتماد');
      setOrderLines([{ item_id: '', qty: 1 }]);
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل إرسال طلب التوزيع'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (orderId: string) => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      await distributionService.approveOrder(orderId, profile.id);
      success('تم اعتماد طلب التوزيع');
      await loadData();
    } catch (e) { error(getErrorMessage(e, 'فشل اعتماد الطلب')); } finally { setLoading(false); }
  };

  const handleReject = async (orderId: string) => {
    if (!profile?.id) return;
    const reason = rejectReasonById[orderId];
    if (!reason?.trim()) { error('يرجى إدخال سبب الرفض'); return; }
    setLoading(true);
    try {
      await distributionService.rejectOrder(orderId, profile.id, reason.trim());
      success('تم رفض الطلب');
      await loadData();
    } catch (e) { error(getErrorMessage(e, 'فشل رفض الطلب')); } finally { setLoading(false); }
  };

  const handleShip = async (orderId: string) => {
    setLoading(true);
    try {
      await distributionService.shipOrder(orderId);
      success('تم شحن الطلب وخصم الكمية من المخزن الرئيسي');
      await loadData();
    } catch (e) { error(getErrorMessage(e, 'فشل تنفيذ الشحن')); } finally { setLoading(false); }
  };

  const handleConfirmReceipt = async (orderId: string) => {
    if (!profile?.id) return;
    const lines = linesByOrder[orderId] || [];
    const counts = lines.map((l) => ({
      item_id: l.item_id,
      receivedQty: Number(receiveCountsById[orderId]?.[l.item_id] ?? l.requested_qty)
    }));
    setLoading(true);
    try {
      const updated = await distributionService.confirmReceipt(orderId, profile.id, counts);
      success(updated.status === 'received_matched' ? 'تم تأكيد الاستلام والكمية مطابقة' : 'تم رصد فرق في الكمية، تم تحويله للمدير للحل');
      await loadData();
    } catch (e) { error(getErrorMessage(e, 'فشل تأكيد الاستلام')); } finally { setLoading(false); }
  };

  const handleResolveDiscrepancy = async (orderId: string) => {
    if (!profile?.id) return;
    const lines = linesByOrder[orderId] || [];
    const finalCounts = lines.map((l) => ({ item_id: l.item_id, finalQty: Number(l.received_qty ?? 0) }));
    setLoading(true);
    try {
      await distributionService.resolveDiscrepancy(orderId, profile.id, finalCounts, 'تم اعتماد الكمية المستلمة فعلياً بعد المراجعة');
      success('تم حل الفرق واعتماد الكمية في مخزون الفرع');
      await loadData();
    } catch (e) { error(getErrorMessage(e, 'فشل حل الفرق')); } finally { setLoading(false); }
  };

  const statusLabel = (status: string) => ({
    pending_approval: { text: 'بانتظار الاعتماد', cls: 'bg-yellow-100 text-yellow-800' },
    approved: { text: 'معتمد - بانتظار الشحن', cls: 'bg-blue-100 text-blue-800' },
    rejected: { text: 'مرفوض', cls: 'bg-red-100 text-red-800' },
    in_transit: { text: 'في الطريق', cls: 'bg-purple-100 text-purple-800' },
    received_matched: { text: 'تم الاستلام (مطابق)', cls: 'bg-green-100 text-green-800' },
    received_discrepancy: { text: 'يوجد فرق - بانتظار الحل', cls: 'bg-red-100 text-red-800' },
    discrepancy_resolved: { text: 'تم حل الفرق', cls: 'bg-green-100 text-green-800' }
  }[status] || { text: status, cls: 'bg-gray-100 text-gray-800' });

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="h-6 w-6" />
          طلبات التوزيع بين الفروع
        </h1>
      </div>

      <div className="bg-white p-5 rounded-lg border shadow">
        <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">طلب توزيع جديد</h3>
        <form onSubmit={handleCreateOrder} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={fromWh} onChange={(e) => setFromWh(e.target.value)} className="border rounded p-2 text-sm">
              <option value="">-- من مخزن --</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}{w.type === 'main' ? ' (الرئيسي)' : ''}</option>)}
            </select>
            <select value={toWh} onChange={(e) => setToWh(e.target.value)} className="border rounded p-2 text-sm">
              <option value="">-- إلى فرع --</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {orderLines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-3">
              <select value={line.item_id} onChange={(e) => handleLineChange(idx, 'item_id', e.target.value)} className="border rounded p-2 text-sm col-span-2">
                <option value="">-- الصنف --</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <input type="number" min={1} value={line.qty} onChange={(e) => handleLineChange(idx, 'qty', e.target.value)} className="border rounded p-2 text-sm" />
            </div>
          ))}
          <div className="flex justify-between">
            <button type="button" onClick={handleAddLine} className="text-xs text-blue-600 hover:underline">+ إضافة صنف</button>
            <button type="submit" disabled={loading} className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
              إرسال الطلب
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-5 rounded-lg border shadow">
        <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">الطلبات</h3>
        {orders.length === 0 ? (
          <p className="text-gray-400 text-sm">لا توجد طلبات توزيع بعد.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => {
              const label = statusLabel(o.status);
              const lines = linesByOrder[o.id] || [];
              return (
                <div key={o.id} className="border rounded p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="font-bold text-gray-800">{whName(o.from_warehouse_id)} ← {whName(o.to_warehouse_id)}</div>
                    <span className={`text-xs px-2 py-1 rounded-full ${label.cls}`}>{label.text}</span>
                  </div>
                  <ul className="text-xs text-gray-600 mb-2">
                    {lines.map((l) => (
                      <li key={l.id}>
                        {itemName(l.item_id)}: مطلوب {l.requested_qty}{l.received_qty != null ? ` / مستلم ${l.received_qty}` : ''}
                      </li>
                    ))}
                  </ul>

                  {o.status === 'pending_approval' && canApprove && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="سبب الرفض"
                        value={rejectReasonById[o.id] || ''}
                        onChange={(e) => setRejectReasonById({ ...rejectReasonById, [o.id]: e.target.value })}
                        className="border rounded p-1 text-xs w-32"
                      />
                      <button onClick={() => handleReject(o.id)} disabled={loading} className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200">رفض</button>
                      <button onClick={() => handleApprove(o.id)} disabled={loading} className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded hover:bg-green-200">اعتماد</button>
                    </div>
                  )}

                  {o.status === 'approved' && canShip && (
                    <button onClick={() => handleShip(o.id)} disabled={loading} className="text-xs bg-purple-100 text-purple-800 px-3 py-1 rounded hover:bg-purple-200">
                      تنفيذ الشحن
                    </button>
                  )}

                  {o.status === 'in_transit' && canReceive && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {lines.map((l) => (
                          <div key={l.id} className="flex items-center gap-1">
                            <span className="text-xs">{itemName(l.item_id)}:</span>
                            <input
                              type="number"
                              className="border rounded p-1 w-20 text-xs"
                              value={receiveCountsById[o.id]?.[l.item_id] ?? l.requested_qty}
                              onChange={(e) => setReceiveCountsById({
                                ...receiveCountsById,
                                [o.id]: { ...(receiveCountsById[o.id] || {}), [l.item_id]: e.target.value }
                              })}
                            />
                          </div>
                        ))}
                      </div>
                      <button onClick={() => handleConfirmReceipt(o.id)} disabled={loading} className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200">
                        تأكيد الاستلام
                      </button>
                    </div>
                  )}

                  {o.status === 'received_discrepancy' && canApprove && (
                    <button onClick={() => handleResolveDiscrepancy(o.id)} disabled={loading} className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200">
                      حل الفرق واعتماد الكمية المستلمة
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
