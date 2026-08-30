import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../../infrastructure/database/dexie';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { ServiceFactory } from '../../application/services/service-factory';
import { useAuth } from '../../application/services/auth-service';
import { useToast } from './ui/Toast';
import { useConfirm } from './ui/ConfirmDialog';
import { DocList, type DocColumn } from './ui/DocList';
import { DocForm } from './ui/DocForm';
import { StatusBadge } from './ui/StatusBadge';
import { EntitySelect, type EntityOption } from './ui/EntitySelect';
import { NumberInput } from './ui/NumberInput';
import { FormField } from './ui/ValidationMessage';
import { getErrorMessage } from '../../shared/utils/errors';
import { enumLabel } from '../../shared/i18n/labels';
import { formatDateTime, formatQty } from '../../shared/utils/format';

// ERPNext-style "أمر تشغيل" (Work Order): one document that spans what used
// to be split across the production-request form, the approve cards and the
// batch log. Data model is unchanged — a production_requests row plus its
// optional production_batches row — this just presents them as one document
// with a List view + a Form view + an action bar that offers the single
// next step for the current state.
type WOReq = any;
type WOBatch = any;

export const WorkOrders: React.FC = () => {
  const { profile, checkPermission } = useAuth();
  const { success, error } = useToast();
  const confirm = useConfirm();
  const svc = ServiceFactory.getManufacturingService();

  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [requests, setRequests] = useState<WOReq[]>([]);
  const [batches, setBatches] = useState<WOBatch[]>([]);
  const [recipeParentIds, setRecipeParentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // view: list | form(id) | new
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // new-order form
  const [nItem, setNItem] = useState('');
  const [nQty, setNQty] = useState<number | ''>('');
  const [nRawWh, setNRawWh] = useState('');
  const [nNotes, setNNotes] = useState('');

  // per-open-order action inputs
  const [rejectReason, setRejectReason] = useState('');
  const [startQty, setStartQty] = useState<number | ''>('');
  const [prodQty, setProdQty] = useState<number | ''>('');
  const [wastePct, setWastePct] = useState<number | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    const [it, wh, us, reqs, bs, recs] = await Promise.all([
      db.items.toArray(),
      RepositoryFactory.getWarehouseRepository().findActive(),
      db.users.toArray(),
      db.production_requests.toArray(),
      db.production_batches.toArray(),
      db.item_recipes.toArray(),
    ]);
    setItems(it);
    setWarehouses(wh);
    setUsers(us);
    setRequests(reqs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setBatches(bs);
    setRecipeParentIds(new Set(recs.filter((r: any) => r.recipe_type === 'batch').map((r: any) => r.parent_item_id)));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const itemName = (id: string) => items.find((i) => i.id === id)?.name || '—';
  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name || '—';
  const userName = (id: string) => users.find((u) => u.id === id)?.name || '—';
  const batchFor = (req: WOReq) => batches.find((b) => b.production_request_id === req.id) || null;

  const producibleItems: EntityOption[] = useMemo(
    () => items
      .filter((i) => i.type === 'finished_good' || i.type === 'intermediate')
      .map((i) => ({ value: i.id, label: i.name, sub: recipeParentIds.has(i.id) ? undefined : 'بدون مكوّنات — عرّفها أولاً' })),
    [items, recipeParentIds],
  );
  const rawWhOptions: EntityOption[] = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.name, sub: w.kind ? enumLabel('warehouseKind', w.kind) : undefined })),
    [warehouses],
  );

  const canApprove = checkPermission('purchases', 'edit') || checkPermission('inventory', 'edit');

  // ---- state machine: the single next action for a work order --------------
  const nextAction = (req: WOReq): string => {
    const b = batchFor(req);
    if (req.status === 'rejected') return 'مرفوض';
    if (req.status === 'pending_materials') return canApprove ? 'اعتماد صرف الخامات' : 'بانتظار اعتماد الخامات';
    if (req.status === 'materials_approved') return req.requested_by === profile?.id ? 'بدء التشغيل' : 'بانتظار بدء التشغيل';
    if (req.status === 'in_production') {
      if (!b || b.status === 'draft') return 'تسجيل الإنتاج الفعلي';
      if (b.status === 'pending_qc') return 'بانتظار فحص الجودة';
      if (b.status === 'rejected') return 'رفضته الجودة';
      return 'اكتمل';
    }
    return 'اكتمل';
  };

  // ---- actions -----------------------------------------------------------
  const resetActionInputs = () => { setRejectReason(''); setStartQty(''); setProdQty(''); setWastePct(''); };

  const doCreate = async () => {
    if (!profile?.id || !nItem || !nRawWh || !nQty || Number(nQty) <= 0) {
      error('اختار المنتج والكمية ومخزن الخامات');
      return;
    }
    setBusy(true);
    try {
      const r = await svc.createProductionRequest(nItem, Number(nQty), profile.id, nRawWh, nNotes || undefined);
      success('اتسجّل أمر التشغيل — بانتظار اعتماد صرف الخامات');
      setCreating(false);
      setNItem(''); setNQty(''); setNNotes('');
      await load();
      setOpenId(r.id);
    } catch (e) { error(getErrorMessage(e, 'تعذّر حفظ أمر التشغيل')); }
    finally { setBusy(false); }
  };

  const doApprove = async (req: WOReq) => {
    if (!profile?.id) return;
    if (!(await confirm({
      title: 'اعتماد وصرف الخامات؟',
      message: `هيتحوّل مكوّنات ${itemName(req.item_id)} لعدد ${req.requested_qty} من مخزن الخامات لمخزن المصنع. مش هينفع تتراجع.`,
      confirmText: 'اعتماد',
    }))) return;
    setBusy(true);
    try {
      await svc.approveProductionRequestMaterials(req.id, profile.id);
      success('اتصرفت الخامات واتحوّلت لمخزن المصنع');
      resetActionInputs();
      await load();
    } catch (e) { error(getErrorMessage(e, 'تعذّر اعتماد الخامات')); }
    finally { setBusy(false); }
  };

  const doReject = async (req: WOReq) => {
    if (!profile?.id || !rejectReason.trim()) { error('اكتب سبب الرفض'); return; }
    setBusy(true);
    try {
      await svc.rejectProductionRequest(req.id, profile.id, rejectReason.trim());
      success('اترفض أمر التشغيل');
      resetActionInputs();
      await load();
    } catch (e) { error(getErrorMessage(e, 'تعذّر الرفض')); }
    finally { setBusy(false); }
  };

  const doStart = async (req: WOReq) => {
    const qty = Number(startQty || req.requested_qty);
    if (!qty || qty <= 0) { error('اكتب الكمية المخطط إنتاجها'); return; }
    setBusy(true);
    try {
      await svc.startProductionFromRequest(req.id, qty);
      success('اتبدأ التشغيل — سجّل الكمية اللي هتطلع لما تخلص');
      resetActionInputs();
      await load();
    } catch (e) { error(getErrorMessage(e, 'تعذّر بدء التشغيل')); }
    finally { setBusy(false); }
  };

  const doRecordProduction = async (req: WOReq) => {
    const b = batchFor(req);
    if (!b) return;
    const qty = Number(prodQty || b.planned_qty);
    if (!qty || qty <= 0) { error('اكتب الكمية اللي طلعت فعلاً'); return; }
    setBusy(true);
    try {
      await svc.completeBatch(b.id, qty, Number(wastePct || 0), b.warehouse_id || '');
      success('اتسجّل الإنتاج — راح لفحص الجودة');
      resetActionInputs();
      await load();
    } catch (e) { error(getErrorMessage(e, 'تعذّر تسجيل الإنتاج')); }
    finally { setBusy(false); }
  };

  // ---- LIST VIEW -------------------------------------------------------------
  const columns: DocColumn<WOReq>[] = [
    { key: 'item', label: 'المنتج', primary: true, render: (r) => itemName(r.item_id) },
    { key: 'qty', label: 'الكمية', render: (r) => formatQty(r.requested_qty) },
    {
      key: 'status', label: 'الحالة', render: (r) => {
        const b = batchFor(r);
        return (
          <span className="flex flex-wrap gap-1">
            <StatusBadge group="productionRequestStatus" value={r.status} />
            {b && <StatusBadge group="batchStatus" value={b.status} />}
          </span>
        );
      },
    },
    { key: 'next', label: 'المطلوب دلوقتي', render: (r) => <span className="text-xs text-blue-700 font-semibold">{nextAction(r)}</span> },
    { key: 'date', label: 'التاريخ', hideOnCard: true, render: (r) => formatDateTime(r.created_at) },
  ];

  if (!openId && !creating) {
    return (
      <DocList
        rows={requests}
        columns={columns}
        getId={(r) => r.id}
        onOpen={(r) => { resetActionInputs(); setOpenId(r.id); }}
        onNew={() => { resetActionInputs(); setCreating(true); }}
        newLabel="أمر تشغيل جديد"
        loading={loading}
        emptyTitle="لا توجد أوامر تشغيل"
        emptyHint="اضغط «أمر تشغيل جديد» علشان تطلب تصنيع كمية من منتج معرّفة مكوّناته."
        search={(r, q) => itemName(r.item_id).toLowerCase().includes(q.toLowerCase())}
      />
    );
  }

  // ---- NEW ORDER FORM -----------------------------------------------------
  if (creating) {
    return (
      <DocForm
        title="أمر تشغيل جديد"
        actions={
          <>
            <button onClick={() => setCreating(false)} className="text-sm font-semibold px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">
              رجوع
            </button>
            <button onClick={doCreate} disabled={busy} className="text-sm font-bold px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
              حفظ أمر التشغيل
            </button>
          </>
        }
      >
        <DocForm.Section title="تفاصيل أمر التشغيل">
          <FormField label="المنتج المطلوب تصنيعه" required>
            <EntitySelect options={producibleItems} value={nItem} onChange={setNItem} placeholder="اختر المنتج" />
          </FormField>
          <FormField label="الكمية المطلوبة" required>
            <NumberInput value={nQty} onChange={setNQty} min={1} placeholder="مثال: 50" />
          </FormField>
          <FormField label="مخزن صرف الخامات" required helpText="المخزن اللي هيتصرف منه المواد الخام">
            <EntitySelect options={rawWhOptions} value={nRawWh} onChange={setNRawWh} placeholder="اختر المخزن" />
          </FormField>
          <FormField label="ملاحظات">
            <input value={nNotes} onChange={(e) => setNNotes(e.target.value)} className="w-full border rounded-lg py-2 px-3 text-sm" placeholder="اختياري" />
          </FormField>
        </DocForm.Section>
        {nItem && !recipeParentIds.has(nItem) && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            المنتج ده لسه مالوش مكوّنات (BOM). عرّفها من تبويب «تركيبات وجداول المواد» قبل ما تطلب تصنيعه.
          </p>
        )}
      </DocForm>
    );
  }

  // ---- OPEN ORDER FORM -----------------------------------------------------
  const req = requests.find((r) => r.id === openId);
  if (!req) { setOpenId(null); return null; }
  const batch = batchFor(req);

  const timeline = [
    { text: `اتسجّل الأمر — ${userName(req.requested_by)}`, at: req.created_at },
    req.material_approved_at && { text: req.status === 'rejected' ? `اترفض — ${userName(req.material_approved_by)}` : `اعتماد صرف الخامات — ${userName(req.material_approved_by)}`, at: req.material_approved_at },
    batch && { text: `اتبدأ التشغيل — دفعة ${batch.batch_no}`, at: batch.created_at },
    batch?.produced_at && { text: `اتسجّل الإنتاج الفعلي (${formatQty(batch.actual_qty)})`, at: batch.produced_at },
    batch?.qc_released_at && { text: batch.status === 'rejected' ? 'رفضته الجودة' : 'اعتمدته الجودة', at: batch.qc_released_at },
  ].filter(Boolean) as { text: string; at: string }[];

  return (
    <DocForm
      title={`أمر تشغيل — ${itemName(req.item_id)}`}
      status={{ group: 'productionRequestStatus', value: req.status }}
      meta={[
        { label: 'الكمية', value: formatQty(req.requested_qty) },
        { label: 'مخزن الخامات', value: whName(req.raw_material_warehouse_id) },
        { label: 'طلبه', value: userName(req.requested_by) },
        req.material_approved_by ? { label: 'اعتمده', value: userName(req.material_approved_by) } : null,
        batch ? { label: 'رقم الدفعة', value: batch.batch_no } : null,
      ].filter(Boolean) as any}
      timeline={timeline}
      connections={batch ? [{ label: `دفعة الإنتاج — ${enumLabel('batchStatus', batch.status)}`, count: 1 }] : []}
      actions={
        <>
          <button onClick={() => { setOpenId(null); resetActionInputs(); }} className="text-sm font-semibold px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">
            رجوع للقائمة
          </button>

          {req.status === 'pending_materials' && canApprove && (
            <>
              <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="سبب الرفض" className="border rounded-lg py-2 px-3 text-sm w-40" />
              <button onClick={() => doReject(req)} disabled={busy} className="text-sm font-bold px-4 py-2 rounded-lg bg-red-100 text-red-800 hover:bg-red-200">رفض</button>
              <button onClick={() => doApprove(req)} disabled={busy} className="text-sm font-bold px-4 py-2 rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">اعتماد وصرف الخامات</button>
            </>
          )}

          {req.status === 'materials_approved' && req.requested_by === profile?.id && (
            <>
              <NumberInput value={startQty} onChange={setStartQty} min={1} placeholder={String(req.requested_qty)} className="w-32" />
              <button onClick={() => doStart(req)} disabled={busy} className="text-sm font-bold px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">بدء التشغيل</button>
            </>
          )}

          {req.status === 'in_production' && batch?.status === 'draft' && (
            <>
              <NumberInput value={prodQty} onChange={setProdQty} min={0} placeholder={`فعلي (${batch.planned_qty})`} className="w-32" />
              <NumberInput value={wastePct} onChange={setWastePct} min={0} max={100} placeholder="فاقد %" className="w-24" />
              <button onClick={() => doRecordProduction(req)} disabled={busy} className="text-sm font-bold px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">سجّل الإنتاج</button>
            </>
          )}
        </>
      }
    >
      <DocForm.Section title="الخامات المطلوبة">
        <div className="sm:col-span-2">
          <RequiredItemsTable
            reqId={req.id}
            itemId={req.item_id}
            qty={req.requested_qty}
            rawWhId={req.raw_material_warehouse_id}
            svc={svc}
            itemName={itemName}
          />
        </div>
      </DocForm.Section>

      {req.rejection_reason && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">سبب الرفض: {req.rejection_reason}</p>
      )}
      {req.notes && <p className="text-xs text-gray-500">ملاحظات: {req.notes}</p>}

      {req.status === 'in_production' && batch?.status === 'pending_qc' && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          الدفعة راحت لفحص الجودة — تُعتمد من شاشة «ضوابط المخزون ← فحص الجودة»، وبعدها يتضاف رصيد المنتج التام لمخزن المصنع.
        </p>
      )}
    </DocForm>
  );
};

// The BOM explosion vs on-hand-at-raw-store, computed on open (the helper
// already exists in the service).
const RequiredItemsTable: React.FC<{
  reqId: string; itemId: string; qty: number; rawWhId: string; svc: any; itemName: (id: string) => string;
}> = ({ itemId, qty, rawWhId, svc, itemName }) => {
  const [plan, setPlan] = useState<any[] | null>(null);
  useEffect(() => {
    let alive = true;
    svc.getProductionMaterialPlan(itemId, qty, rawWhId).then((p: any) => { if (alive) setPlan(p); }).catch(() => setPlan([]));
    return () => { alive = false; };
  }, [itemId, qty, rawWhId, svc]);

  if (!plan) return <p className="text-xs text-gray-400">جاري الحساب...</p>;
  if (plan.length === 0) return <p className="text-xs text-amber-700">لا توجد مكوّنات معرّفة لهذا المنتج.</p>;

  return (
    <table className="w-full text-xs">
      <thead className="text-gray-400 border-b">
        <tr>
          <th className="text-right font-medium py-1">المكوّن</th>
          <th className="text-left font-medium py-1">المطلوب</th>
          <th className="text-left font-medium py-1">المتاح بمخزن الخامات</th>
          <th className="text-left font-medium py-1">النقص</th>
        </tr>
      </thead>
      <tbody>
        {plan.map((p) => (
          <tr key={p.component_item_id} className={p.shortfall > 0 ? 'text-red-600' : 'text-gray-700'}>
            <td className="py-1">{itemName(p.component_item_id)}</td>
            <td className="text-left py-1 font-mono">{formatQty(p.requiredQty)}</td>
            <td className="text-left py-1 font-mono">{formatQty(p.onHand)}</td>
            <td className="text-left py-1 font-mono">{p.shortfall > 0 ? formatQty(p.shortfall) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
