import React, { useState, useEffect } from 'react';
import { db } from '../lib/dexie';
import { queueOfflineWrite } from '../lib/sync';
import { getSetting } from '../lib/settingsHelper';
import {
  Settings,
  Plus,
  Trash2,
  CheckCircle,
  TrendingDown,
  Info,
  Layers
} from 'lucide-react';

export const Manufacturing: React.FC = () => {
  // Navigation tabs
  const [activeSubTab, setActiveSubTab] = useState<'recipes' | 'production' | 'filling'>('recipes');

  // Master lists
  const [items, setItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [productionBatches, setProductionBatches] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // 1. Recipe Editor State
  const [recipeParentId, setRecipeParentId] = useState('');
  const [recipeType, setRecipeType] = useState<'batch' | 'packaging'>('batch');
  const [recipeMode, setRecipeMode] = useState<'percentage' | 'fixed_qty'>('percentage');
  const [expectedWaste, setExpectedWaste] = useState('0');

  // Recipe ingredient rows state
  const [ingredientRows, setIngredientRows] = useState<any[]>([{ component_item_id: '', quantity_or_percentage: 0 }]);

  // 2. Production Batch State
  const [prodProduct, setProdProduct] = useState(''); // intermediate bulk liquid product
  const [prodBatchNo, setProdBatchNo] = useState('');
  const [prodPlannedQty, setProdPlannedQty] = useState('20'); // in kg
  const [prodWarehouseId, setProdWarehouseId] = useState('');
  const [prodExpiry, setProdExpiry] = useState('');

  // 3. Packaging/Filling Flow State
  const [fillFinishedGood, setFillFinishedGood] = useState('');
  const [fillBatchNo, setFillBatchNo] = useState('');
  const [fillQty, setFillQty] = useState('100'); // number of bottles
  const [fillBulkBatchId, setFillBulkBatchId] = useState(''); // source bulk liquid batch
  const [fillWarehouseId, setFillWarehouseId] = useState('');
  const [fillLaborCost, setFillLaborCost] = useState('0'); // overhead allocation

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

    if (listWh.length > 0) {
      setProdWarehouseId(listWh[0].id);
      setFillWarehouseId(listWh[0].id);
    }

    const intermediates = listItems.filter((i: any) => i.type === 'intermediate');
    if (intermediates.length > 0) {
      setRecipeParentId(intermediates[0].id);
      setProdProduct(intermediates[0].id);
    }
    const finished = listItems.filter((i: any) => i.type === 'finished_good');
    if (finished.length > 0) {
      setFillFinishedGood(finished[0].id);
    }

    // Default expected waste
    const waste = await getSetting('expected_waste_pct', '0');
    setExpectedWaste(waste);
  };

  // Live total helper for recipe editor
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

    // Check validation if percentage mode
    if (recipeMode === 'percentage' && Math.abs(runningTotal - 100) > 0.001) {
      alert('خطأ: مجموع النسب المئوية يجب أن يساوي 100% تماماً لحفظ التركيبة!');
      return;
    }

    try {
      // Clear existing recipes for this parent & type
      const existing = recipes.filter((r: any) => r.parent_item_id === recipeParentId && r.recipe_type === recipeType);
      for (const r of existing) {
        await queueOfflineWrite('item_recipes', 'delete', r.id, null);
      }

      // Save new recipe components
      for (const row of ingredientRows) {
        if (!row.component_item_id) continue;
        const id = crypto.randomUUID();
        const rObj = {
          id,
          parent_item_id: recipeParentId,
          component_item_id: row.component_item_id,
          quantity_or_percentage: Number(row.quantity_or_percentage),
          recipe_type: recipeType,
          mode: recipeMode,
          created_at: new Date().toISOString()
        };
        await queueOfflineWrite('item_recipes', 'insert', id, rObj);
      }

      await loadData();
      alert('تم حفظ تركيبة الصنف بنجاح!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Load recipe when parent changes
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

  // 2. Manufacturing Flow Execution
  const handleCreateProductionOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodProduct || !prodPlannedQty || !prodWarehouseId) return;

    // Retrieve recipe for intermediate liquid
    const currentRecipe = recipes.filter((r: any) => r.parent_item_id === prodProduct && r.recipe_type === 'batch');
    if (currentRecipe.length === 0) {
      alert('عذراً، لا توجد تركيبة (BOM) مسجلة لهذا المنتج الوسيط. يرجى تهيئتها أولاً.');
      return;
    }

    try {
      const plannedQtyNum = Number(prodPlannedQty);
      const bId = crypto.randomUUID();
      const generatedBatchNo = prodBatchNo || `PENDING-BAT-${Date.now()}`;

      // Insert production batch
      const batchObj = {
        id: bId,
        batch_no: generatedBatchNo,
        item_id: prodProduct,
        planned_qty: plannedQtyNum,
        actual_qty: null,
        expected_waste_pct: Number(expectedWaste),
        actual_waste_pct: null,
        expiry_date: prodExpiry || null,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await queueOfflineWrite('production_batches', 'insert', bId, batchObj);

      // System automatically calculates required raw materials based on batch size and recipe multiplier
      for (const component of currentRecipe) {
        let reqQty = 0;
        if (component.mode === 'percentage') {
          // If percentage: (percentage / 100) * batch size
          reqQty = (Number(component.quantity_or_percentage) / 100) * plannedQtyNum;
        } else {
          // If fixed_qty: component quantity * batch size multiplier
          reqQty = Number(component.quantity_or_percentage) * plannedQtyNum;
        }

        // Add consumption plan record
        const consId = crypto.randomUUID();
        const consObj = {
          id: consId,
          batch_id: bId,
          raw_item_id: component.component_item_id,
          qty_consumed: reqQty,
          created_at: new Date().toISOString()
        };
        await queueOfflineWrite('production_consumptions', 'insert', consId, consObj);
      }

      setProdBatchNo('');
      await loadData();
      alert('تم إنشاء أمر الإنتاج كمسودة بنجاح! يرجى تأكيده لصرف المواد الخام.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const confirmProductionBatch = async (batch: any, actualQtyInput: string, actualWasteInput: string) => {
    try {
      const actualQtyNum = Number(actualQtyInput);
      const actualWastePctNum = Number(actualWasteInput);

      // 1. Update batch record to 'completed'
      const updatedBatch = {
        ...batch,
        actual_qty: actualQtyNum,
        actual_waste_pct: actualWastePctNum,
        status: 'completed',
        produced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await queueOfflineWrite('production_batches', 'insert', batch.id, updatedBatch);

      // 2. Fetch computed raw consumptions for this batch
      const consumptions = await db.production_consumptions.filter((c: any) => c.batch_id === batch.id).toArray();

      // Deduct raw materials from stock
      for (const c of consumptions) {
        const mId = crypto.randomUUID();
        const movOut = {
          id: mId,
          item_id: c.raw_item_id,
          warehouse_id: prodWarehouseId,
          batch_no: batch.batch_no,
          movement_type: 'production_consumption',
          qty: -Number(c.qty_consumed),
          ref_table: 'production_batches',
          ref_id: batch.id,
          moved_at: new Date().toISOString()
        };
        await queueOfflineWrite('stock_movements', 'insert', mId, movOut);
      }

      // Add bulk liquid output to stock
      const outId = crypto.randomUUID();
      const movIn = {
        id: outId,
        item_id: batch.item_id,
        warehouse_id: prodWarehouseId,
        batch_no: batch.batch_no,
        movement_type: 'production_output',
        qty: actualQtyNum,
        ref_table: 'production_batches',
        ref_id: batch.id,
        moved_at: new Date().toISOString()
      };
      await queueOfflineWrite('stock_movements', 'insert', outId, movIn);

      await loadData();
      alert('تم إكمال وتأكيد دفعة الإنتاج بنجاح وصرف الكميات من المخزون!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 3. Packaging & Filling Order (Bulk Liquid -> Finished Good)
  const handleCreateFillingOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fillFinishedGood || !fillQty || !fillWarehouseId) return;

    // Fetch Packaging BOM
    const currentBOM = recipes.filter((r: any) => r.parent_item_id === fillFinishedGood && r.recipe_type === 'packaging');
    if (currentBOM.length === 0) {
      alert('عذراً، لا توجد قائمة مواد تعبئة وتغليف (BOM) مهيأة لهذا المنتج النهائي. يرجى تهيئتها أولاً.');
      return;
    }

    try {
      const fillQtyNum = Number(fillQty);
      const generatedBatchNo = fillBatchNo || `PENDING-BAT-${Date.now()}`;
      const fId = crypto.randomUUID();

      // Consumables and liquid subtraction
      for (const component of currentBOM) {
        const reqQty = Number(component.quantity_or_percentage) * fillQtyNum;
        const mId = crypto.randomUUID();
        const movOut = {
          id: mId,
          item_id: component.component_item_id,
          warehouse_id: fillWarehouseId,
          batch_no: generatedBatchNo,
          movement_type: 'production_consumption',
          qty: -reqQty,
          ref_table: 'filling',
          ref_id: fId,
          moved_at: new Date().toISOString()
        };
        await queueOfflineWrite('stock_movements', 'insert', mId, movOut);
      }

      // Add produced finished good to stock
      const inId = crypto.randomUUID();
      const movIn = {
        id: inId,
        item_id: fillFinishedGood,
        warehouse_id: fillWarehouseId,
        batch_no: generatedBatchNo,
        movement_type: 'production_output',
        qty: fillQtyNum,
        ref_table: 'filling',
        ref_id: fId,
        moved_at: new Date().toISOString()
      };
      await queueOfflineWrite('stock_movements', 'insert', inId, movIn);

      // Create a Completed Production Batch for the finished good
      const batchObj = {
        id: fId,
        batch_no: generatedBatchNo,
        item_id: fillFinishedGood,
        planned_qty: fillQtyNum,
        actual_qty: fillQtyNum,
        expected_waste_pct: 0,
        actual_waste_pct: 0,
        status: 'completed',
        produced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await queueOfflineWrite('production_batches', 'insert', fId, batchObj);

      setFillBatchNo('');
      await loadData();
      alert('تمت عملية التعبئة والتغليف بنجاح وإضافة رصيد المنتج النهائي للمخازن!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Cost analysis helper
  const calculateRealCostPerUnit = (item: any) => {
    const bom = recipes.filter((r: any) => r.parent_item_id === item.id);
    let totalMatCost = 0;
    bom.forEach((component: any) => {
      const compItem = items.find((i: any) => i.id === component.component_item_id);
      const price = compItem?.default_price || 1.5;
      totalMatCost += Number(component.quantity_or_percentage) * Number(price);
    });
    return totalMatCost;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة التصنيع والتركيبات / Manufacturing</h1>
          <p className="text-gray-500 text-sm mt-1">إعداد خطوط إنتاج السائل، وإدخال الخلطة، وعمليات التعبئة والتغليف للمنتج النهائي</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-lg p-1 shadow-sm">
        <button
          onClick={() => {
            setActiveSubTab('recipes');
            const intermediates = items.filter((i: any) => i.type === 'intermediate');
            if (intermediates.length > 0) handleParentChange(intermediates[0].id, 'batch');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'recipes' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>تركيبات وجداول المواد (Recipe/BOM)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('production')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'production' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>أوامر إنتاج خلطة الصمغ (سائل)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('filling')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
            activeSubTab === 'filling' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle className="h-4 w-4" />
          <span>التعبئة والتغليف والمنتج النهائي</span>
        </button>
      </div>

      {activeSubTab === 'recipes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recipe Editor Form */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-3 mb-6">إعداد تركيبة الـ BOM للمواد الخام والإنتاج</h3>
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
                  <label className="block text-xs font-bold text-gray-600 mb-1">نوع التركيبة / المرحلة</label>
                  <select
                    value={recipeType}
                    onChange={(e) => handleParentChange(recipeParentId, e.target.value as any)}
                    className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                  >
                    <option value="batch">مرحلة 1: خلط السائل الخام (kg/liters)</option>
                    <option value="packaging">مرحلة 2: تعبئة وتغليف للعلب (عبوة للبيع)</option>
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
                    <option value="fixed_qty">كميات ثابتة / كمية مطلقة</option>
                  </select>
                </div>
              </div>

              {/* Ingredients rows */}
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                  <span className="text-xs font-bold text-gray-600">المكونات الداخلة بالتركيبة (المكون + الكمية/النسبة):</span>
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
                        placeholder={recipeMode === 'percentage' ? 'النسبة %' : 'الكمية المطلوبة'}
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

              {/* Running Total indicator */}
              <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-lg border">
                <div className="text-sm">
                  <span className="font-bold text-gray-700">إجمالي مدخلات التركيبة الجاري: </span>
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
                disabled={recipeMode === 'percentage' && Math.abs(runningTotal - 100) > 0.001}
                className="w-full flex justify-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold text-sm transition disabled:opacity-50"
              >
                حفظ وتثبيت التركيبة (Save BOM)
              </button>
            </form>
          </div>

          {/* Recipe Cost Estimation */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">تقدير التكاليف الفعلي (Costing)</h3>
            <div className="space-y-4">
              <div className="text-xs text-gray-500 leading-relaxed">
                يقوم محرك التكاليف بضرب نسب ومكونات الـ BOM بأسعار شراء المواد المسجلة لتقدير تكلفة الصنف.
              </div>
              {items.filter((i: any) => i.type === 'finished_good' || i.type === 'intermediate').map((i: any) => {
                const cost = calculateRealCostPerUnit(i);
                return (
                  <div key={i.id} className="p-3 border rounded bg-gray-50 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">{i.name}</div>
                      <div className="text-xs text-gray-500">النوع: {typesArabic[i.type]}</div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-blue-600 font-mono text-base">{cost.toFixed(2)} ر.س</div>
                      <div className="text-[10px] text-gray-400">تكلفة المواد التقريبية</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'production' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Production Batch */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">بدء خلطة / دفعة تصنيع جديدة</h3>
            <form onSubmit={handleCreateProductionOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المنتج المستهدف (السائل السائب)</label>
                <select
                  value={prodProduct}
                  onChange={(e) => setProdProduct(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm"
                >
                  {items.filter((i: any) => i.type === 'intermediate').map((i: any) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المستودع المنفذ</label>
                <select
                  value={prodWarehouseId}
                  onChange={(e) => setProdWarehouseId(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الكمية المستهدفة للخلطة (بالكيلوغرام)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={prodPlannedQty}
                  onChange={(e) => setProdPlannedQty(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">رقم الدفعة / التشغيلة (Batch No)</label>
                <input
                  type="text"
                  placeholder="مثال: BAT-1002"
                  value={prodBatchNo}
                  onChange={(e) => setProdBatchNo(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">تاريخ انتهاء الصلاحية (اختياري)</label>
                <input
                  type="date"
                  value={prodExpiry}
                  onChange={(e) => setProdExpiry(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition"
              >
                توليد خلطة / كمسودة
              </button>
            </form>
          </div>

          {/* Current Production Orders List */}
          <div className="lg:col-span-2 bg-white p-5 rounded-lg border shadow">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-1">
              <Layers className="h-5 w-5 text-blue-600" />
              <span>جداول الخلطات النشطة وتاريخ الإنتاج</span>
            </h3>

            <div className="space-y-4 overflow-y-auto h-[500px]">
              {productionBatches.length > 0 ? (
                productionBatches.map(batch => {
                  const pItem = items.find((i: any) => i.id === batch.item_id);
                  if (!pItem) return null;

                  return (
                    <div key={batch.id} className="p-4 border rounded-lg bg-gray-50 flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-sm">{pItem.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            batch.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {batch.status === 'completed' ? 'مكتمل وإنتاج مخزن' : 'مسودة خلطة'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">رقم التشغيلة: <span className="font-mono text-gray-800">{batch.batch_no}</span></div>
                        <div className="text-xs text-gray-500">الكمية المخططة: <span className="font-bold">{batch.planned_qty} كغم</span></div>
                        {batch.status === 'completed' && (
                          <div className="text-xs text-gray-500">الكمية الفعلية: <span className="font-bold text-green-600">{batch.actual_qty} كغم</span> | الفاقد الفعلي: <span className="font-bold text-red-600">{batch.actual_waste_pct}%</span></div>
                        )}
                      </div>

                      {batch.status === 'draft' && (
                        <div className="flex items-center">
                          {/* Confirm formulation form */}
                          <ConfirmBatchForm
                            batch={batch}
                            onConfirm={(actualQty, actualWaste) => confirmProductionBatch(batch, actualQty, actualWaste)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-gray-400 italic py-10">لا يوجد سجل خلطات أو إنتاج حالي.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'filling' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Packaging form */}
          <div className="bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">عملية تعبئة السائل بعبوات نهائية للبيع</h3>
            <form onSubmit={handleCreateFillingOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المنتج النهائي التام (عبوة البيع)</label>
                <select
                  value={fillFinishedGood}
                  onChange={(e) => setFillFinishedGood(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm"
                >
                  {items.filter((i: any) => i.type === 'finished_good').map((i: any) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المستودع المنفذ والمخزن</label>
                <select
                  value={fillWarehouseId}
                  onChange={(e) => setFillWarehouseId(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">رقم تشغيلة الخلط السائب للمصدر</label>
                <select
                  value={fillBulkBatchId}
                  onChange={(e) => setFillBulkBatchId(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  <option value="">-- خيار تلقائي / أحدث دفعة خلط --</option>
                  {productionBatches.filter((b: any) => b.status === 'completed').map((b: any) => (
                    <option key={b.id} value={b.id}>{b.batch_no} (سائل الصمغ)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">عدد العبوات التامة للإنتاج (قطعة/عبوة)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={fillQty}
                  onChange={(e) => setFillQty(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">أجور العمالة وتكاليف تشغيل إضافية (ر.س)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={fillLaborCost}
                  onChange={(e) => setFillLaborCost(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">رقم الدفعة النهائي للمنتج</label>
                <input
                  type="text"
                  placeholder="مثال: BAT-FILL-301"
                  value={fillBatchNo}
                  onChange={(e) => setFillBatchNo(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-xs transition"
              >
                تعبئة وخصم السائل والعلب وإنتاج التام
              </button>
            </form>
          </div>

          {/* Quick BOM breakdown for packaging preview */}
          <div className="lg:col-span-2 bg-white p-5 rounded-lg border shadow h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-1.5">
              <TrendingDown className="h-5 w-5 text-blue-600" />
              <span>المكونات المستهلكة المتوقعة للتعبئة</span>
            </h3>
            <div className="text-sm text-gray-600 space-y-3 leading-relaxed">
              <p>عند تعبئة عبوة واحدة من منتج الـ 600مل، يقوم النظام تلقائياً بخصم كمية السائل المناسبة من الخزان وخصم مكونات العلب التغليفية المسجلة:</p>
              <div className="bg-blue-50 p-3 rounded text-xs border">
                <ul className="list-disc pr-4 space-y-1 font-semibold text-gray-700">
                  <li>الستيكر (ستيكر) قطعة واحدة</li>
                  <li>غطاء العلبة (غطاء) قطعة واحدة</li>
                  <li>عبوة فارغة ملائمة (عبوة فارغة) قطعة واحدة</li>
                  <li>برشامة السد (برشامة) قطعة واحدة</li>
                  <li>السائل السائب المعبأ (0.600 لتر)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component helper for confirming batch actuals
interface ConfirmBatchFormProps {
  batch: any;
  onConfirm: (actualQty: string, actualWaste: string) => void;
}

const ConfirmBatchForm: React.FC<ConfirmBatchFormProps> = ({ batch, onConfirm }) => {
  const [actualQty, setActualQty] = useState(String(batch.planned_qty));
  const [actualWaste, setActualWaste] = useState('0');

  return (
    <div className="bg-white p-3 border rounded-lg shadow-sm flex flex-col md:flex-row gap-2 items-end">
      <div>
        <label className="block text-[10px] font-bold text-gray-500 mb-0.5">الوزن الفعلي الناتج (kg)</label>
        <input
          type="number"
          step="0.01"
          value={actualQty}
          onChange={(e) => setActualQty(e.target.value)}
          className="w-24 rounded border py-1 px-2 text-xs text-left"
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-500 mb-0.5">الفاقد الفعلي %</label>
        <input
          type="number"
          step="0.01"
          value={actualWaste}
          onChange={(e) => setActualWaste(e.target.value)}
          className="w-20 rounded border py-1 px-2 text-xs text-left"
        />
      </div>
      <button
        type="button"
        onClick={() => onConfirm(actualQty, actualWaste)}
        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold flex items-center gap-1 transition"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>تأكيد الإنجاز وصرف المخزن</span>
      </button>
    </div>
  );
};

const typesArabic: { [key: string]: string } = {
  raw_material: 'مادة خام كيميائية',
  packaging: 'مواد تعبئة وتغليف',
  intermediate: 'منتج وسيط (سائل صمغ)',
  finished_good: 'منتج نهائي تام الصنع'
};
