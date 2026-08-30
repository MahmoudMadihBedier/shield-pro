import React, { useState, useEffect } from 'react';
import { db } from '../../infrastructure/database/dexie';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';
import { getSetting } from '../../shared/utils/settings-helper';
import { useAuth } from '../../application/services/auth-service';
import { ServiceFactory } from '../../application/services/service-factory';
import { getErrorMessage } from '../../shared/utils/errors';
import { useToast } from './ui/Toast';
import { ProductionRequests } from './ProductionRequests';
import {
  Settings,
  Plus,
  Trash2,
  Info,
  Layers,
  ClipboardList,
  FlaskConical,
  PackageCheck
} from 'lucide-react';

const typesArabic: { [key: string]: string } = {
  raw_material: 'مادة خام كيميائية',
  packaging: 'مواد تعبئة وتغليف',
  intermediate: 'منتج وسيط (سائل صمغ)',
  finished_good: 'منتج نهائي تام الصنع'
};

const BATCH_STATUS: { [k: string]: { text: string; cls: string } } = {
  draft: { text: 'مسودة — لم تُنفَّذ بعد', cls: 'bg-gray-100 text-gray-700' },
  pending_qc: { text: 'بانتظار فحص الجودة', cls: 'bg-yellow-100 text-yellow-800' },
  released: { text: 'مُعتمدة — رصيد بمخزن المصنع', cls: 'bg-green-100 text-green-800' },
  rejected: { text: 'مرفوضة من الجودة', cls: 'bg-red-100 text-red-800' },
  completed: { text: 'مكتملة (سجل قديم)', cls: 'bg-blue-100 text-blue-800' },
  confirmed: { text: 'مؤكدة (سجل قديم)', cls: 'bg-blue-100 text-blue-800' }
};

export const Manufacturing: React.FC = () => {
  const { checkPermission } = useAuth();
  const { success, error } = useToast();
  const manufacturingService = ServiceFactory.getManufacturingService();
  const canEditRecipes = checkPermission('manufacturing', 'add') || checkPermission('manufacturing', 'edit');

  const [activeSubTab, setActiveSubTab] = useState<'recipes' | 'requests' | 'produce' | 'batches'>('recipes');

  // Master lists
  const [items, setItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [productionBatches, setProductionBatches] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [laborOverheadPerUnit, setLaborOverheadPerUnit] = useState(0);

  // «تسجيل الإنتاج الفعلي» — per-draft-batch actual qty + waste inputs
  const [produceInputs, setProduceInputs] = useState<Record<string, { qty: string; waste: string }>>({});
  const [producing, setProducing] = useState(false);

  // Recipe Editor State
  const [recipeParentId, setRecipeParentId] = useState('');
  const [recipeType, setRecipeType] = useState<'batch' | 'packaging'>('batch');
  const [recipeMode, setRecipeMode] = useState<'percentage' | 'fixed_qty'>('percentage');
  const [ingredientRows, setIngredientRows] = useState<any[]>([{ component_item_id: '', quantity_or_percentage: 0 }]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const listItems = await db.items.toArray();
    const listRecipes = await db.item_recipes.toArray();
    const listBatches = await db.production_batches.toArray();
    const listWh = await db.warehouses.filter((w: any) => w.is_active).toArray();

    setItems(listItems);
    setRecipes(listRecipes);
    setProductionBatches(listBatches.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setWarehouses(listWh);

    const intermediates = listItems.filter((i: any) => i.type === 'intermediate');
    const finished = listItems.filter((i: any) => i.type === 'finished_good');
    const firstParent = intermediates[0] || finished[0];
    if (firstParent) setRecipeParentId(firstParent.id);

    setLaborOverheadPerUnit(Number(await getSetting('labor_overhead_per_unit', '0')) || 0);
  };

  const runningTotal = ingredientRows.reduce((sum, row) => sum + Number(row.quantity_or_percentage), 0);

  const handleAddIngredientRow = () => {
    setIngredientRows([...ingredientRows, { component_item_id: '', quantity_or_percentage: 0 }]);
  };

  const handleRemoveIngredientRow = (index: number) => {
    const updated = [...ingredientRows];
    updated.splice(index, 1);
    setIngredientRows(updated);
  };

  const handleIngredientChange = (index: number, field: string, value: any) => {
    const updated = [...ingredientRows];
    updated[index] = { ...updated[index], [field]: value };
    setIngredientRows(updated);
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeParentId) return;
    if (!canEditRecipes) {
      alert('لا تملك صلاحية تعديل التركيبات.');
      return;
    }

    if (recipeMode === 'percentage' && Math.abs(runningTotal - 100) > 0.001) {
      alert('خطأ: مجموع النسب المئوية يجب أن يساوي 100% تماماً لحفظ التركيبة!');
      return;
    }

    try {
      // Replace the existing recipe for this parent + stage.
      const existing = recipes.filter((r: any) => r.parent_item_id === recipeParentId && r.recipe_type === recipeType);
      for (const r of existing) {
        await queueOfflineWrite('item_recipes', 'delete', r.id, null);
      }

      for (const row of ingredientRows) {
        if (!row.component_item_id) continue;
        const id = crypto.randomUUID();
        await queueOfflineWrite('item_recipes', 'insert', id, {
          id,
          parent_item_id: recipeParentId,
          component_item_id: row.component_item_id,
          quantity_or_percentage: Number(row.quantity_or_percentage),
          recipe_type: recipeType,
          mode: recipeMode,
          created_at: new Date().toISOString()
        });
      }

      await loadData();
      alert('تم حفظ تركيبة الصنف بنجاح!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleParentChange = (parentId: string, type: 'batch' | 'packaging') => {
    setRecipeParentId(parentId);
    setRecipeType(type);

    const match = recipes.filter((r: any) => r.parent_item_id === parentId && r.recipe_type === type);
    if (match.length > 0) {
      setRecipeMode(match[0].mode);
      setIngredientRows(match.map((r: any) => ({
        component_item_id: r.component_item_id,
        quantity_or_percentage: r.quantity_or_percentage
      })));
    } else {
      setIngredientRows([{ component_item_id: '', quantity_or_percentage: 0 }]);
    }
  };

  // Cost per produced unit. Recipe quantities are authored in the
  // component's own stock unit, so cost = per-unit quantity x that
  // component's cost_price. Components with no cost_price are surfaced, not
  // faked with a fallback price.
  const calculateRealCostPerUnit = (item: any) => {
    const bom = recipes.filter((r: any) => r.parent_item_id === item.id);
    let materialCost = 0;
    const missing: string[] = [];
    bom.forEach((component: any) => {
      const compItem = items.find((i: any) => i.id === component.component_item_id);
      const unitCost = compItem?.cost_price;
      if (unitCost == null || Number.isNaN(Number(unitCost))) {
        missing.push(compItem?.name || 'مكوّن غير معروف');
        return;
      }
      const perUnitQty = component.mode === 'percentage'
        ? Number(component.quantity_or_percentage) / 100
        : Number(component.quantity_or_percentage);
      materialCost += perUnitQty * Number(unitCost);
    });
    return { materialCost, missing, totalCost: materialCost + laborOverheadPerUnit };
  };

  const itemName = (id: string) => items.find((i: any) => i.id === id)?.name || id;
  const warehouseName = (id: string) => warehouses.find((w: any) => w.id === id)?.name || (id ? id.slice(0, 8) : '-');

  // Batches that were started from an approved production request but whose
  // actual produced quantity hasn't been recorded yet. Recording it (via
  // completeBatch) consumes the raw materials at the factory store and sends
  // the batch to quality check.
  const draftBatches = productionBatches.filter((b: any) => b.status === 'draft');

  const handleRecordProduction = async (batch: any) => {
    const input = produceInputs[batch.id] || { qty: '', waste: '' };
    const actualQty = Number(input.qty || batch.planned_qty);
    const wastePct = Number(input.waste || 0);
    if (!actualQty || actualQty <= 0) {
      error('اكتب الكمية اللي طلعت فعلاً من الدفعة');
      return;
    }
    setProducing(true);
    try {
      await manufacturingService.completeBatch(batch.id, actualQty, wastePct, batch.warehouse_id || '');
      success('اتسجّل إنتاج الدفعة — راحت لفحص الجودة في شاشة «ضوابط المخزون»');
      await loadData();
    } catch (e) {
      error(getErrorMessage(e, 'تعذّر تسجيل الإنتاج'));
    } finally {
      setProducing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">إدارة التصنيع والتركيبات / Manufacturing</h1>
        <p className="text-gray-500 text-sm mt-1">
          عرّف مكوّنات المنتج، وبعدين شغّله من «طلبات الإنتاج»: طلب ← اعتماد صرف الخامات ← بدء ←
          «تسجيل الإنتاج الفعلي» ← فحص الجودة (من شاشة «ضوابط المخزون») ← تحويل للمخزن الرئيسي.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-gray-200 mb-6 bg-white rounded-lg p-1 shadow-sm">
        <button
          onClick={() => setActiveSubTab('recipes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'recipes' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>تركيبات وجداول المواد (Recipe/BOM)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('requests')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'requests' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>طلبات الإنتاج</span>
        </button>
        <button
          onClick={() => setActiveSubTab('produce')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'produce' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <PackageCheck className="h-4 w-4" />
          <span>تسجيل الإنتاج الفعلي</span>
          {draftBatches.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center">
              {draftBatches.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('batches')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'batches' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>سجل دفعات الإنتاج</span>
        </button>
      </div>

      {activeSubTab === 'requests' && <ProductionRequests />}

      {activeSubTab === 'recipes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recipe Editor Form */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-3 mb-6">إعداد تركيبة الـ BOM للمواد الخام والإنتاج</h3>
            {!canEditRecipes && (
              <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                وضع العرض فقط — لا تملك صلاحية «إضافة/تعديل التصنيع».
              </div>
            )}
            <form onSubmit={handleSaveRecipe} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">المنتج المستهدف بالتركيبة</label>
                  <select
                    value={recipeParentId}
                    onChange={(e) => handleParentChange(e.target.value, recipeType)}
                    className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white font-semibold"
                  >
                    <optgroup label="منتجات وسيطة (سائل الخلط)">
                      {items.filter((i: any) => i.type === 'intermediate').map((i: any) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="منتجات تامة الصنع (عبوات للبيع)">
                      {items.filter((i: any) => i.type === 'finished_good').map((i: any) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">مرحلة التركيبة</label>
                  <select
                    value={recipeType}
                    onChange={(e) => handleParentChange(recipeParentId, e.target.value as any)}
                    className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                  >
                    <option value="batch">التصنيع (الخامات → المنتج) — تُستخدم في طلبات الإنتاج</option>
                    <option value="packaging">تعبئة وتغليف إضافية (اختياري)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">طريقة الحساب</label>
                  <select
                    value={recipeMode}
                    onChange={(e) => setRecipeMode(e.target.value as any)}
                    className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                  >
                    <option value="percentage">نسب مئوية % (يجب أن يساوي 100%)</option>
                    <option value="fixed_qty">كميات ثابتة لكل وحدة منتجة</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                  <span className="text-xs font-bold text-gray-600">
                    المكونات الداخلة بالتركيبة —{' '}
                    {recipeMode === 'percentage'
                      ? 'النسبة المئوية من وزن/حجم الوحدة الواحدة (المجموع = 100%)'
                      : 'الكمية الثابتة لكل وحدة منتجة، بوحدة تخزين المادة نفسها'}
                    :
                  </span>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>إضافة مكون</span>
                  </button>
                </div>

                {ingredientRows.map((row, idx) => (
                  <div key={idx} className="flex gap-4 items-center">
                    <div className="flex-1">
                      <select
                        required
                        value={row.component_item_id}
                        onChange={(e) => handleIngredientChange(idx, 'component_item_id', e.target.value)}
                        className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                      >
                        <option value="">-- اختر المادة المكونة --</option>
                        {items.filter((i: any) => i.id !== recipeParentId).map((i: any) => (
                          <option key={i.id} value={i.id}>{i.name} ({typesArabic[i.type] || i.type})</option>
                        ))}
                      </select>
                    </div>

                    <div className="w-1/4">
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        required
                        placeholder={recipeMode === 'percentage' ? 'النسبة %' : 'الكمية'}
                        value={row.quantity_or_percentage}
                        onChange={(e) => handleIngredientChange(idx, 'quantity_or_percentage', e.target.value)}
                        className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left font-semibold"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveIngredientRow(idx)}
                      className="text-red-500 hover:text-red-700 p-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-lg border">
                <div className="text-sm">
                  <span className="font-bold text-gray-700">إجمالي مدخلات التركيبة: </span>
                  <span className={`text-lg font-extrabold ${
                    recipeMode === 'percentage' && Math.abs(runningTotal - 100) > 0.001 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {runningTotal} {recipeMode === 'percentage' ? '%' : ''}
                  </span>
                </div>
                {recipeMode === 'percentage' && Math.abs(runningTotal - 100) > 0.001 && (
                  <div className="text-xs text-red-600 flex items-center gap-1.5">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>يجب أن تكون النسب 100% تماماً ليتم تفعيل زر الحفظ.</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!canEditRecipes || (recipeMode === 'percentage' && Math.abs(runningTotal - 100) > 0.001)}
                className="w-full flex justify-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold text-sm transition disabled:opacity-50"
              >
                حفظ وتثبيت التركيبة (Save BOM)
              </button>
            </form>
          </div>

          {/* Recipe Cost Estimation */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">تقدير التكلفة لكل وحدة (Costing)</h3>
            <div className="space-y-4">
              <div className="text-xs text-gray-500 leading-relaxed">
                لكل صنف: <span className="font-semibold">تكلفة المواد</span> = مجموع (كمية المكوّن في التركيبة × تكلفة شراء المكوّن
                <span dir="ltr"> cost_price</span>)، ثم يُضاف <span className="font-semibold">تحميل العمالة والتشغيل</span> لكل وحدة
                (<span dir="ltr">{laborOverheadPerUnit.toFixed(2)}</span> ج.م، يُضبط من الإعدادات).
              </div>
              {items.filter((i: any) => i.type === 'finished_good' || i.type === 'intermediate').map((i: any) => {
                const c = calculateRealCostPerUnit(i);
                return (
                  <div key={i.id} className="p-3 border rounded bg-gray-50 space-y-1.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-800 text-sm">{i.name}</div>
                        <div className="text-xs text-gray-500">النوع: {typesArabic[i.type]}</div>
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-blue-600 font-mono text-base">{c.totalCost.toFixed(2)} ج.م</div>
                        <div className="text-[10px] text-gray-400">التكلفة التقديرية للوحدة</div>
                      </div>
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-500 font-mono">
                      <span>تكلفة المواد</span><span>{c.materialCost.toFixed(2)} ج.م</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-500 font-mono">
                      <span>عمالة وتشغيل / وحدة</span><span>{laborOverheadPerUnit.toFixed(2)} ج.م</span>
                    </div>
                    {c.missing.length > 0 && (
                      <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        التكلفة غير محددة لـ: {c.missing.join('، ')} — سجّل سعر الشراء لهذه المواد ليكتمل التقدير.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'produce' && (
        <div className="bg-white p-5 rounded-lg border shadow">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-blue-600" />
            <span>تسجيل الإنتاج الفعلي</span>
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            لما تبدأ دفعة إنتاج من «طلبات الإنتاج»، تظهر هنا. اكتب الكمية اللي طلعت فعلاً ونسبة الفاقد،
            واضغط «سجّل الإنتاج» — النظام يصرف الخامات من مخزن المصنع ويبعت الدفعة لفحص الجودة.
          </p>
          {draftBatches.length === 0 ? (
            <p className="text-gray-400 italic text-sm py-6 text-center">
              مفيش دفعات بانتظار تسجيل الإنتاج. ابدأ دفعة من تبويب «طلبات الإنتاج» الأول.
            </p>
          ) : (
            <div className="space-y-3">
              {draftBatches.map((b: any) => {
                const input = produceInputs[b.id] || { qty: '', waste: '' };
                return (
                  <div key={b.id} className="border rounded-lg p-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-[180px]">
                      <div className="font-bold text-gray-800">{itemName(b.item_id)}</div>
                      <div className="text-xs text-gray-500 font-mono">{b.batch_no}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        الكمية المخططة: {b.planned_qty} · مخزن المصنع: {b.warehouse_id ? warehouseName(b.warehouse_id) : '—'}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">الكمية اللي طلعت فعلاً</label>
                      <input
                        type="number" min={0} step="any"
                        placeholder={String(b.planned_qty)}
                        value={input.qty}
                        onChange={(e) => setProduceInputs({ ...produceInputs, [b.id]: { ...input, qty: e.target.value } })}
                        className="border rounded p-2 text-sm w-28"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">نسبة الفاقد %</label>
                      <input
                        type="number" min={0} max={100} step="any"
                        placeholder="0"
                        value={input.waste}
                        onChange={(e) => setProduceInputs({ ...produceInputs, [b.id]: { ...input, waste: e.target.value } })}
                        className="border rounded p-2 text-sm w-24"
                      />
                    </div>
                    <button
                      onClick={() => handleRecordProduction(b)}
                      disabled={producing}
                      className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      سجّل الإنتاج
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'batches' && (
        <div className="bg-white p-5 rounded-lg border shadow">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-blue-600" />
            <span>سجل دفعات الإنتاج</span>
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            تُنشأ الدفعات من تبويب «طلبات الإنتاج». الدفعات «بانتظار فحص الجودة» تُعتمد من شاشة «ضوابط المخزون (QC/جرد)» —
            وعندها فقط يُضاف رصيد المنتج التام إلى مخزن المصنع، ثم يُنقل إلى المخزن الرئيسي بطلب توزيع.
          </p>
          {productionBatches.length === 0 ? (
            <p className="text-gray-400 italic text-sm py-6 text-center">لا يوجد سجل دفعات إنتاج بعد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-right">
                <thead className="text-xs font-bold text-gray-500 border-b">
                  <tr>
                    <th className="py-2 px-3">رقم الدفعة</th>
                    <th className="py-2 px-3">المنتج</th>
                    <th className="py-2 px-3">مخطط</th>
                    <th className="py-2 px-3">فعلي</th>
                    <th className="py-2 px-3">فاقد %</th>
                    <th className="py-2 px-3">مخزن المصنع</th>
                    <th className="py-2 px-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productionBatches.map((b: any) => {
                    const st = BATCH_STATUS[b.status] || { text: b.status, cls: 'bg-gray-100 text-gray-700' };
                    return (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono text-xs">{b.batch_no}</td>
                        <td className="py-2 px-3 font-semibold text-gray-800">{itemName(b.item_id)}</td>
                        <td className="py-2 px-3">{b.planned_qty}</td>
                        <td className="py-2 px-3">{b.actual_qty ?? '—'}</td>
                        <td className="py-2 px-3">{b.actual_waste_pct ?? '—'}</td>
                        <td className="py-2 px-3 text-gray-600">{b.warehouse_id ? warehouseName(b.warehouse_id) : '—'}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>{st.text}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
