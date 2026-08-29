import React, { useCallback, useEffect, useState } from 'react';
import { db } from '../../infrastructure/database/dexie';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { ServiceFactory } from '../../application/services/service-factory';
import { useAuth } from '../../application/services/auth-service';
import { useToast } from './ui/Toast';
import { getErrorMessage } from '../../shared/utils/errors';
import { ClipboardList } from 'lucide-react';

// The workflow the owner described: a factory employee requests production
// of an already-defined product; the purchasing warehouse manager reviews
// and either withdraws the raw materials (approving) or rejects it with a
// reason; only then can the factory employee start the actual production
// run. Segregation of duties (requester != approver) is enforced
// server-side regardless of what this UI allows.
export const ProductionRequests: React.FC = () => {
  const { profile, checkPermission } = useAuth();
  const { success, error } = useToast();
  const manufacturingService = ServiceFactory.getManufacturingService();

  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [recipeParentIds, setRecipeParentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const [reqItemId, setReqItemId] = useState('');
  const [reqQty, setReqQty] = useState('1');
  const [reqWarehouseId, setReqWarehouseId] = useState('');
  const [reqNotes, setReqNotes] = useState('');

  const [rejectReasonById, setRejectReasonById] = useState<{ [id: string]: string }>({});
  const [startQtyById, setStartQtyById] = useState<{ [id: string]: string }>({});

  const canApprove = checkPermission('purchases', 'edit') || checkPermission('inventory', 'edit');

  const loadData = useCallback(async () => {
    const [listItems, listWarehouses, listRequests, listRecipes] = await Promise.all([
      db.items.toArray(),
      RepositoryFactory.getWarehouseRepository().findActive(),
      db.production_requests.toArray(),
      db.item_recipes.toArray()
    ]);
    setItems(listItems.filter((i: any) => i.type === 'finished_good' || i.type === 'intermediate'));
    setWarehouses(listWarehouses);
    setRequests(listRequests.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setRecipeParentIds(new Set(listRecipes.filter((r: any) => r.recipe_type === 'batch').map((r: any) => r.parent_item_id)));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const itemName = (id: string) => items.find((i) => i.id === id)?.name || id;
  const userName = (id: string) => (id ? id.slice(0, 8) : '-');
  const selectedHasRecipe = !reqItemId || recipeParentIds.has(reqItemId);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !reqItemId || !reqWarehouseId || Number(reqQty) <= 0) {
      error('يرجى اختيار المنتج والمخزن وإدخال كمية صحيحة');
      return;
    }
    setLoading(true);
    try {
      await manufacturingService.createProductionRequest(reqItemId, Number(reqQty), profile.id, reqWarehouseId, reqNotes || undefined);
      success('تم إرسال طلب الإنتاج بانتظار اعتماد صرف الخامات');
      setReqQty('1');
      setReqNotes('');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل إرسال طلب الإنتاج'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      await manufacturingService.approveProductionRequestMaterials(requestId, profile.id);
      success('تم اعتماد وصرف الخامات');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل اعتماد الطلب'));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!profile?.id) return;
    const reason = rejectReasonById[requestId];
    if (!reason?.trim()) {
      error('يرجى إدخال سبب الرفض');
      return;
    }
    setLoading(true);
    try {
      await manufacturingService.rejectProductionRequest(requestId, profile.id, reason.trim());
      success('تم رفض الطلب');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل رفض الطلب'));
    } finally {
      setLoading(false);
    }
  };

  const handleStartProduction = async (requestId: string) => {
    const qty = Number(startQtyById[requestId]);
    if (!qty || qty <= 0) {
      error('يرجى إدخال الكمية المخطط إنتاجها');
      return;
    }
    setLoading(true);
    try {
      await manufacturingService.startProductionFromRequest(requestId, qty);
      success('تم بدء أمر الإنتاج — أكمله من تبويب أوامر الإنتاج بإدخال الكمية الفعلية');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'فشل بدء الإنتاج'));
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = (status: string) => ({
    pending_materials: { text: 'بانتظار صرف الخامات', cls: 'bg-yellow-100 text-yellow-800' },
    materials_approved: { text: 'تم اعتماد الخامات', cls: 'bg-blue-100 text-blue-800' },
    rejected: { text: 'مرفوض', cls: 'bg-red-100 text-red-800' },
    in_production: { text: 'قيد الإنتاج', cls: 'bg-purple-100 text-purple-800' },
    completed: { text: 'مكتمل', cls: 'bg-green-100 text-green-800' }
  }[status] || { text: status, cls: 'bg-gray-100 text-gray-800' });

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-lg border shadow">
        <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-600" />
          طلب إنتاج جديد
        </h3>
        <form onSubmit={handleCreateRequest} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">المنتج</label>
            <select value={reqItemId} onChange={(e) => setReqItemId(e.target.value)} className="border rounded p-2 text-sm w-full">
              <option value="">-- اختر --</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}{recipeParentIds.has(i.id) ? '' : ' (بدون تركيبة)'}
                </option>
              ))}
            </select>
            {reqItemId && !selectedHasRecipe && (
              <p className="text-[11px] text-amber-700 mt-1">
                لا توجد تركيبة (BOM) لمرحلة الخلط لهذا الصنف — عرّفها من تبويب «تركيبات وجداول المواد» قبل طلب الإنتاج.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">الكمية المطلوبة</label>
            <input type="number" min={1} value={reqQty} onChange={(e) => setReqQty(e.target.value)} className="border rounded p-2 text-sm w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">مخزن صرف الخامات</label>
            <select value={reqWarehouseId} onChange={(e) => setReqWarehouseId(e.target.value)} className="border rounded p-2 text-sm w-full">
              <option value="">-- اختر --</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading || !selectedHasRecipe} className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            إرسال الطلب
          </button>
          <input
            type="text"
            value={reqNotes}
            onChange={(e) => setReqNotes(e.target.value)}
            placeholder="ملاحظات (اختياري)"
            className="border rounded p-2 text-sm md:col-span-4"
          />
        </form>
      </div>

      <div className="bg-white p-5 rounded-lg border shadow">
        <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">طلبات الإنتاج</h3>
        {requests.length === 0 ? (
          <p className="text-gray-400 text-sm">لا توجد طلبات إنتاج بعد.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const label = statusLabel(r.status);
              return (
                <div key={r.id} className="border rounded p-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-gray-800">{itemName(r.item_id)} — {r.requested_qty}</div>
                    <div className="text-xs text-gray-500">
                      طلب بواسطة {userName(r.requested_by)} · {new Date(r.created_at).toLocaleString('ar-EG')}
                    </div>
                    {r.rejection_reason && <div className="text-xs text-red-600 mt-1">سبب الرفض: {r.rejection_reason}</div>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${label.cls}`}>{label.text}</span>

                  {r.status === 'pending_materials' && canApprove && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="سبب الرفض"
                        value={rejectReasonById[r.id] || ''}
                        onChange={(e) => setRejectReasonById({ ...rejectReasonById, [r.id]: e.target.value })}
                        className="border rounded p-1 text-xs w-32"
                      />
                      <button onClick={() => handleReject(r.id)} disabled={loading} className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200">
                        رفض
                      </button>
                      <button onClick={() => handleApprove(r.id)} disabled={loading} className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded hover:bg-green-200">
                        اعتماد وصرف الخامات
                      </button>
                    </div>
                  )}

                  {r.status === 'materials_approved' && r.requested_by === profile?.id && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="الكمية المخططة"
                        value={startQtyById[r.id] || r.requested_qty}
                        onChange={(e) => setStartQtyById({ ...startQtyById, [r.id]: e.target.value })}
                        className="border rounded p-1 text-xs w-28"
                      />
                      <button onClick={() => handleStartProduction(r.id)} disabled={loading} className="text-xs bg-purple-100 text-purple-800 px-3 py-1 rounded hover:bg-purple-200">
                        بدء الإنتاج
                      </button>
                    </div>
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
