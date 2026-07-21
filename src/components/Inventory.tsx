import React, { useState, useEffect } from 'react';
import { db } from '../lib/dexie';
import { queueOfflineWrite } from '../lib/sync';
import {
  Package,
  Plus,
  AlertTriangle,
  History,
  ArrowUpDown,
  Search,
  Filter
} from 'lucide-react';

export const Inventory: React.FC = () => {
  // Navigation tab
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'adjustments' | 'card'>('items');

  // Item List & Form State
  const [items, setItems] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // New Item State
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState('raw_material');
  const [itemReorderLevel, setItemReorderLevel] = useState('0');
  const [itemUomId, setItemUomId] = useState('');
  const [itemExpiryTracking, setItemExpiryTracking] = useState(false);
  const [itemDefaultPrice, setItemDefaultPrice] = useState('0');
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // New Adjustment/Movement State
  const [adjItem, setAdjItem] = useState('');
  const [adjWarehouse, setAdjWarehouse] = useState('');
  const [adjType, setAdjType] = useState('manual_adjustment'); // manual_adjustment | transfer
  const [adjQty, setAdjQty] = useState('1');
  const [adjToWarehouse, setAdjToWarehouse] = useState(''); // for warehouse transfers
  const [adjBatchNo, setAdjBatchNo] = useState('');

  // Item Card State
  const [cardItemId, setCardItemId] = useState('');
  const [cardStartDate, setCardStartDate] = useState('');
  const [cardEndDate, setCardEndDate] = useState('');
  const [cardMovements, setCardMovements] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const listItems = await db.items.toArray();
    const listUnits = await db.units.toArray();
    const listWh = await db.warehouses.filter((w: any) => w.is_active).toArray();
    const listMovs = await db.stock_movements.toArray();

    setItems(listItems);
    setUnits(listUnits);
    setWarehouses(listWh);
    setStockMovements(listMovs.sort((a: any, b: any) => new Date(b.moved_at).getTime() - new Date(a.moved_at).getTime()));

    if (listUnits.length > 0) setItemUomId(listUnits[0].id);
    if (listWh.length > 0) setAdjWarehouse(listWh[0].id);
    if (listItems.length > 0) {
      setAdjItem(listItems[0].id);
      setCardItemId(listItems[0].id);
    }
  };

  const calculateStock = (itemId: string, warehouseId?: string) => {
    return stockMovements
      .filter((m: any) => m.item_id === itemId && (!warehouseId || m.warehouse_id === warehouseId))
      .reduce((sum, m) => sum + Number(m.qty), 0);
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    try {
      const id = editingItem ? editingItem.id : crypto.randomUUID();
      const itemObj = {
        id,
        name: itemName.trim(),
        type: itemType,
        reorder_level: Number(itemReorderLevel),
        uom_id: itemUomId,
        expiry_tracking_enabled: itemExpiryTracking,
        default_price: Number(itemDefaultPrice),
        created_at: editingItem ? editingItem.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await queueOfflineWrite('items', 'insert', id, itemObj);
      setItemName('');
      setItemReorderLevel('0');
      setItemDefaultPrice('0');
      setEditingItem(null);
      await loadData();
    } catch (e: any) {
      alert("خطأ: " + e.message);
    }
  };

  const startEditItem = (item: any) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemType(item.type);
    setItemReorderLevel(String(item.reorder_level));
    setItemUomId(item.uom_id);
    setItemExpiryTracking(item.expiry_tracking_enabled);
    setItemDefaultPrice(String(item.default_price));
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjItem || !adjWarehouse || !adjQty) return;

    try {
      const qtyNum = Number(adjQty);
      const mId = crypto.randomUUID();

      if (adjType === 'transfer') {
        if (!adjToWarehouse) {
          alert('يرجى تحديد مستودع الوجهة للتحويل.');
          return;
        }
        if (adjWarehouse === adjToWarehouse) {
          alert('لا يمكن التحويل لنفس المستودع.');
          return;
        }
        // Deduct from source warehouse
        const outMov = {
          id: crypto.randomUUID(),
          item_id: adjItem,
          warehouse_id: adjWarehouse,
          batch_no: adjBatchNo || null,
          movement_type: 'transfer_out',
          qty: -qtyNum,
          ref_table: 'manual',
          ref_id: mId,
          moved_at: new Date().toISOString()
        };
        // Add to destination warehouse
        const inMov = {
          id: crypto.randomUUID(),
          item_id: adjItem,
          warehouse_id: adjToWarehouse,
          batch_no: adjBatchNo || null,
          movement_type: 'transfer_in',
          qty: qtyNum,
          ref_table: 'manual',
          ref_id: mId,
          moved_at: new Date().toISOString()
        };

        await queueOfflineWrite('stock_movements', 'insert', outMov.id, outMov);
        await queueOfflineWrite('stock_movements', 'insert', inMov.id, inMov);
      } else {
        // Manual adjustment (can be positive or negative)
        const manualMov = {
          id: mId,
          item_id: adjItem,
          warehouse_id: adjWarehouse,
          batch_no: adjBatchNo || null,
          movement_type: 'manual_adjustment',
          qty: qtyNum,
          ref_table: 'manual',
          ref_id: mId,
          moved_at: new Date().toISOString()
        };
        await queueOfflineWrite('stock_movements', 'insert', mId, manualMov);
      }

      setAdjQty('1');
      setAdjBatchNo('');
      await loadData();
      alert('تم حفظ الحركة المخزنية بنجاح!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const runItemCardReport = () => {
    if (!cardItemId) return;
    let filtered = stockMovements.filter((m: any) => m.item_id === cardItemId);

    if (cardStartDate) {
      filtered = filtered.filter((m: any) => new Date(m.moved_at) >= new Date(cardStartDate));
    }
    if (cardEndDate) {
      // add 1 day to end date to make it inclusive
      const end = new Date(cardEndDate);
      end.setDate(end.getDate() + 1);
      filtered = filtered.filter((m: any) => new Date(m.moved_at) <= end);
    }

    // Sort chronologically ascending to compute running balance correctly
    const chronological = [...filtered].sort((a: any, b: any) => new Date(a.moved_at).getTime() - new Date(b.moved_at).getTime());

    let running = 0;
    const mapped = chronological.map((m: any) => {
      const q = Number(m.qty);
      running += q;
      return {
        ...m,
        qty_in: q > 0 ? q : 0,
        qty_out: q < 0 ? Math.abs(q) : 0,
        balance: running
      };
    });

    // Reverse order for presentation (most recent first)
    setCardMovements(mapped.reverse());
  };

  const typesArabic: { [key: string]: string } = {
    raw_material: 'مادة خام كيميائية',
    packaging: 'مواد تعبئة وتغليف',
    intermediate: 'منتج وسيط (سائل صمغ)',
    finished_good: 'منتج نهائي تام الصنع'
  };

  const movementTypesArabic: { [key: string]: string } = {
    purchase_in: 'شراء / وارد للمخزن',
    sale_out: 'بيع / صادر من المخزن',
    production_consumption: 'استهلاك للتصنيع',
    production_output: 'إنتاج تصنيع وارد',
    sales_return_in: 'مرتجع مبيعات وارد',
    purchase_return_out: 'مرتجع مشتريات صادر',
    manual_adjustment: 'تسوية مخزنية يدوية',
    transfer_out: 'تحويل صادر',
    transfer_in: 'تحويل وارد'
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">إدارة المخزون والمستودعات / Inventory</h1>
        <p className="text-gray-500 text-sm mt-1">التحكم في مستويات المخزون، تتبع كروت الصنف، التحويل والتسويات بين الفروع</p>
      </div>

      {/* Inventory Tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-lg p-1 shadow-sm">
        <button
          onClick={() => setActiveSubTab('items')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition rounded-md ${
            activeSubTab === 'items' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>قائمة الأصناف والمخزون الحركي</span>
        </button>
        <button
          onClick={() => setActiveSubTab('adjustments')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition rounded-md ${
            activeSubTab === 'adjustments' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ArrowUpDown className="h-4 w-4" />
          <span>حركات وتسويات وتحويلات المخازن</span>
        </button>
        <button
          onClick={() => {
            setActiveSubTab('card');
            runItemCardReport();
          }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition rounded-md ${
            activeSubTab === 'card' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <History className="h-4 w-4" />
          <span>كارت الصنف التفصيلي (تفصيلي)</span>
        </button>
      </div>

      {activeSubTab === 'items' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Add Item Form */}
          <div className="bg-white p-5 rounded-lg shadow border h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">
              {editingItem ? 'تعديل بيانات الصنف' : 'إضافة صنف جديد للمخازن'}
            </h3>
            <form onSubmit={saveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اسم الصنف (مادة خام أو منتج)</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: عبوة فارغة 600 مل"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm focus:outline-none focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">نوع المادة / الصنف</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm focus:outline-none focus:ring-blue-500"
                >
                  <option value="raw_material">مادة خام كيميائية</option>
                  <option value="packaging">مواد تعبئة وتغليف</option>
                  <option value="intermediate">منتج وسيط (سائل الصمغ)</option>
                  <option value="finished_good">منتج نهائي تام الصنع</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الوحدة الأساسية (UOM)</label>
                <select
                  value={itemUomId}
                  onChange={(e) => setItemUomId(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm focus:outline-none"
                >
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">حد إعادة الطلب (تنبيه نقص المخزون)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={itemReorderLevel}
                  onChange={(e) => setItemReorderLevel(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">سعر البيع الافتراضي (للمنتجات التامة)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={itemDefaultPrice}
                  onChange={(e) => setItemDefaultPrice(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="expiry"
                  checked={itemExpiryTracking}
                  onChange={(e) => setItemExpiryTracking(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="expiry" className="text-xs font-bold text-gray-700">تفعيل تتبع تاريخ الصلاحية</label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 flex justify-center items-center gap-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>حفظ الصنف</span>
                </button>
                {editingItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setItemName('');
                      setItemReorderLevel('0');
                      setItemDefaultPrice('0');
                    }}
                    className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-bold"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Items List */}
          <div className="lg:col-span-3 bg-white p-5 rounded-lg shadow border">
            {/* Filter and Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </span>
                <input
                  type="text"
                  placeholder="بحث باسم الصنف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 rounded border border-gray-300 py-2 px-3 text-sm focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded border border-gray-300 py-2 px-3 text-sm focus:outline-none bg-white"
                >
                  <option value="all">كل الأنواع</option>
                  <option value="raw_material">المواد الخام كيميائية</option>
                  <option value="packaging">مواد تعبئة وتغليف</option>
                  <option value="intermediate">المنتجات الوسيطة</option>
                  <option value="finished_good">المنتجات تامة الصنع</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500 uppercase">
                    <th className="py-3 px-4">اسم الصنف</th>
                    <th className="py-3 px-4">النوع</th>
                    <th className="py-3 px-4">الوحدة</th>
                    <th className="py-3 px-4 text-center">الرصيد الفعلي</th>
                    <th className="py-3 px-4">حد الطلب</th>
                    <th className="py-3 px-4">سعر البيع</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                    <th className="py-3 px-4 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredItems.map(item => {
                    const stock = calculateStock(item.id);
                    const isLow = stock <= Number(item.reorder_level);
                    const uomName = units.find(u => u.id === item.uom_id)?.name || '';

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-semibold text-gray-800">{item.name}</td>
                        <td className="py-3 px-4 text-xs font-bold text-gray-600">{typesArabic[item.type]}</td>
                        <td className="py-3 px-4 text-gray-600">{uomName}</td>
                        <td className="py-3 px-4 text-center font-bold text-lg text-gray-900">{stock}</td>
                        <td className="py-3 px-4 text-gray-600">{item.reorder_level}</td>
                        <td className="py-3 px-4 font-mono">{item.default_price} ج.م</td>
                        <td className="py-3 px-4 text-center">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                              <AlertTriangle className="h-3 w-3" />
                              <span>مخزون منخفض!</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <span>آمن</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => startEditItem(item)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
                          >
                            تعديل
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'adjustments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Stock movement */}
          <div className="bg-white p-5 rounded-lg shadow border h-fit">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">تسجيل حركة مخزنية / تحويل فروع</h3>
            <form onSubmit={handleCreateAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">نوع الحركة</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  <option value="manual_adjustment">تسوية مخزنية يدوية</option>
                  <option value="transfer">تحويل بين المستودعات</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الصنف المستهدف</label>
                <select
                  value={adjItem}
                  onChange={(e) => setAdjItem(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm"
                >
                  {items.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({typesArabic[i.type]})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المستودع (المصدر)</label>
                <select
                  value={adjWarehouse}
                  onChange={(e) => setAdjWarehouse(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {adjType === 'transfer' && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">المستودع (الوجهة / المستلم)</label>
                  <select
                    value={adjToWarehouse}
                    onChange={(e) => setAdjToWarehouse(e.target.value)}
                    className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm"
                  >
                    <option value="">-- اختر الوجهة --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الكمية (موجب للإدخال، سالب للصرف)</label>
                <input
                  type="number"
                  required
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">رقم التشغيلة / الدفعة (اختياري)</label>
                <input
                  type="text"
                  placeholder="Batch-101"
                  value={adjBatchNo}
                  onChange={(e) => setAdjBatchNo(e.target.value)}
                  className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center items-center gap-1.5 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold transition"
              >
                <Plus className="h-4 w-4" />
                <span>حفظ وتسجيل الحركة</span>
              </button>
            </form>
          </div>

          {/* Movements Log */}
          <div className="lg:col-span-2 bg-white p-5 rounded-lg shadow border">
            <h3 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-1.5">
              <History className="h-5 w-5 text-blue-600" />
              <span>سجل الحركات المخزنية الأخير (Stock Movements Log)</span>
            </h3>

            <div className="overflow-y-auto h-[500px]">
              <table className="min-w-full divide-y divide-gray-200 text-right">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-xs font-bold text-gray-500 uppercase">
                    <th className="py-3 px-4">الصنف</th>
                    <th className="py-3 px-4">نوع الحركة</th>
                    <th className="py-3 px-4 text-center">الكمية</th>
                    <th className="py-3 px-4">المستودع</th>
                    <th className="py-3 px-4">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {stockMovements.slice(0, 50).map(m => {
                    const itemName = items.find(i => i.id === m.item_id)?.name || '';
                    const whName = warehouses.find(w => w.id === m.warehouse_id)?.name || '';
                    const isPositive = Number(m.qty) > 0;

                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-800">{itemName}</td>
                        <td className="py-3 px-4 text-xs font-bold text-gray-600">
                          {movementTypesArabic[m.movement_type] || m.movement_type}
                        </td>
                        <td className={`py-3 px-4 text-center font-bold font-mono text-base ${
                          isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {isPositive ? '+' : ''}{m.qty}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{whName}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {new Date(m.moved_at).toLocaleDateString('ar-EG')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'card' && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="border-b pb-4 mb-6">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-1.5">
              <History className="h-5 w-5 text-blue-600" />
              <span>كارت صنف تفصيلي وحركة الرصيد التراكمي (Item Card)</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">تتبع دقيق جداً لكل الفواتير وتصنيع الصنف مع حساب الرصيد التراكمي خطوة بخطوة</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">اختر الصنف</label>
              <select
                value={cardItemId}
                onChange={(e) => setCardItemId(e.target.value)}
                className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
              >
                {items.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">من تاريخ</label>
              <input
                type="date"
                value={cardStartDate}
                onChange={(e) => setCardStartDate(e.target.value)}
                className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">إلى تاريخ</label>
              <input
                type="date"
                value={cardEndDate}
                onChange={(e) => setCardEndDate(e.target.value)}
                className="w-full rounded border border-gray-300 py-1.5 px-3 text-sm text-left bg-white"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={runItemCardReport}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition"
              >
                تطبيق فلتر كارت الصنف
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-right">
              <thead className="bg-gray-50">
                <tr className="text-xs font-bold text-gray-500 uppercase">
                  <th className="py-3 px-4">تاريخ الحركة</th>
                  <th className="py-3 px-4">نوع الحركة</th>
                  <th className="py-3 px-4">رقم التشغيلة / المرجع</th>
                  <th className="py-3 px-4">المستودع</th>
                  <th className="py-3 px-4 text-center text-green-600 font-bold">الوارد (+)</th>
                  <th className="py-3 px-4 text-center text-red-600 font-bold">الصادر (-)</th>
                  <th className="py-3 px-4 text-center text-blue-600 font-bold">الرصيد الجاري</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {cardMovements.length > 0 ? (
                  cardMovements.map((m, idx) => {
                    const whName = warehouses.find(w => w.id === m.warehouse_id)?.name || '';
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-700">{new Date(m.moved_at).toLocaleString('ar-EG')}</td>
                        <td className="py-3 px-4 font-semibold text-gray-600">{movementTypesArabic[m.movement_type] || m.movement_type}</td>
                        <td className="py-3 px-4 font-mono text-gray-600">{m.batch_no || m.ref_id?.slice(0,8) || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{whName}</td>
                        <td className="py-3 px-4 text-center font-bold text-green-600 font-mono">{m.qty_in || '-'}</td>
                        <td className="py-3 px-4 text-center font-bold text-red-600 font-mono">{m.qty_out || '-'}</td>
                        <td className="py-3 px-4 text-center font-bold text-blue-600 font-mono text-base bg-blue-50/50">{m.balance}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500 italic">
                      لا يوجد حركات مسجلة لهذا الصنف خلال الفترة المحددة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
