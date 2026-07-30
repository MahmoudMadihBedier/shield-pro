import React, { useState, useEffect } from 'react';
import { useInventory, useStockMovements } from '../../application/hooks/use-inventory';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { Item, Warehouse, Unit } from '../../core/domain/entities';
import {
  Package,
  Plus,
  History,
  ArrowUpDown,
  Search
} from 'lucide-react';

export const Inventory: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'adjustments' | 'card'>('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Item management
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState('raw_material');
  const [itemReorderLevel, setItemReorderLevel] = useState('0');
  const [itemUomId, setItemUomId] = useState('');
  const [itemExpiryTracking, setItemExpiryTracking] = useState(false);
  const [itemDefaultPrice, setItemDefaultPrice] = useState('0');
  const [itemBarcode, setItemBarcode] = useState('');
  const [itemCartonBarcode, setItemCartonBarcode] = useState('');
  const [itemCartonPackSize, setItemCartonPackSize] = useState('20');
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Stock movement management
  const [adjItem, setAdjItem] = useState('');
  const [adjWarehouse, setAdjWarehouse] = useState('');
  const [adjType, setAdjType] = useState('manual_adjustment');
  const [adjQty, setAdjQty] = useState('1');
  const [adjToWarehouse, setAdjToWarehouse] = useState('');
  const [adjBatchNo, setAdjBatchNo] = useState('');

  // Load master data
  const [units, setUnits] = useState<Unit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const { items, createItem, updateItem, deleteItem, searchItems, calculateStock } = useInventory();
  const { movements, createMovement } = useStockMovements();

  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    const [unitsData, warehousesData] = await Promise.all([
      RepositoryFactory.getUnitRepository().findAll(),
      RepositoryFactory.getWarehouseRepository().findActive()
    ]);
    setUnits(unitsData.data);
    setWarehouses(warehousesData);

    if (unitsData.data.length > 0) setItemUomId(unitsData.data[0].id);
    if (warehousesData.length > 0) {
      setAdjWarehouse(warehousesData[0].id);
      setAdjToWarehouse(warehousesData[0].id);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    try {
      const itemData = {
        name: itemName.trim(),
        type: itemType as any,
        reorder_level: Number(itemReorderLevel),
        uom_id: itemUomId,
        expiry_tracking_enabled: itemExpiryTracking,
        default_price: Number(itemDefaultPrice),
        barcode: itemBarcode.trim() || undefined,
        carton_barcode: itemCartonBarcode.trim() || undefined,
        carton_pack_size: itemCartonBarcode.trim() ? Number(itemCartonPackSize) : undefined
      };

      if (editingItem) {
        await updateItem(editingItem.id, itemData);
        setEditingItem(null);
      } else {
        await createItem(itemData);
      }

      // Reset form
      setItemName('');
      setItemType('raw_material');
      setItemReorderLevel('0');
      setItemExpiryTracking(false);
      setItemDefaultPrice('0');
      setItemBarcode('');
      setItemCartonBarcode('');
      setItemCartonPackSize('20');
    } catch (error) {
      console.error('Failed to save item:', error);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await searchItems(searchQuery);
    }
  };

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const movementData = {
        item_id: adjItem,
        warehouse_id: adjWarehouse,
        qty: Number(adjQty),
        movement_type: adjType as any,
        reference_id: adjToWarehouse || undefined,
        reference_type: adjType === 'transfer' ? 'warehouse' : undefined,
        batch_no: adjBatchNo || undefined
      };

      await createMovement(movementData);

      // Reset form
      setAdjQty('1');
      setAdjBatchNo('');
    } catch (error) {
      console.error('Failed to create movement:', error);
    }
  };

  const filteredItems = items.data.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Stock cache for display
  const [stockCache, setStockCache] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const loadStockLevels = async () => {
      const cache: { [key: string]: number } = {};
      for (const item of filteredItems) {
        cache[item.id] = await calculateStock(item.id);
      }
      setStockCache(cache);
    };
    loadStockLevels();
  }, [filteredItems, calculateStock]);

  return (
    <div className="p-6">
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveSubTab('items')}
          className={`px-4 py-2 rounded-md font-semibold transition ${
            activeSubTab === 'items' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          <Package className="inline ml-2" size={16} />
          الأصناف
        </button>
        <button
          onClick={() => setActiveSubTab('adjustments')}
          className={`px-4 py-2 rounded-md font-semibold transition ${
            activeSubTab === 'adjustments' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          <ArrowUpDown className="inline ml-2" size={16} />
          حركات المخزون
        </button>
        <button
          onClick={() => setActiveSubTab('card')}
          className={`px-4 py-2 rounded-md font-semibold transition ${
            activeSubTab === 'card' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          <History className="inline ml-2" size={16} />
          بطاقة الصنف
        </button>
      </div>

      {activeSubTab === 'items' && (
        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="بحث عن صنف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">جميع الأنواع</option>
              <option value="raw_material">مواد خام</option>
              <option value="finished_good">منتج تام</option>
              <option value="packaging">تغليف</option>
              <option value="consumable">مستهلكات</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              بحث
            </button>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800">قائمة الأصناف</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
              >
                <Plus size={16} />
                إضافة صنف
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">اسم الصنف</th>
                    <th className="py-3 px-4">النوع</th>
                    <th className="py-3 px-4">الرصيد</th>
                    <th className="py-3 px-4">حد إعادة الطلب</th>
                    <th className="py-3 px-4">السعر الافتراضي</th>
                    <th className="py-3 px-4">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredItems.map((item: Item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{item.name}</td>
                      <td className="py-3 px-4 text-gray-600">{item.type}</td>
                      <td className="py-3 px-4 text-center font-mono">{stockCache[item.id] || 0}</td>
                      <td className="py-3 px-4 text-gray-500">{item.reorder_level}</td>
                      <td className="py-3 px-4 text-gray-500">{item.default_price}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="text-blue-600 hover:text-blue-800 mr-2"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Item Form */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <h3 className="font-bold text-gray-800 mb-4">
              {editingItem ? 'تعديل صنف' : 'إضافة صنف جديد'}
            </h3>
            <form onSubmit={handleCreateItem} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الصنف</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع الصنف</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="raw_material">مادة خام</option>
                  <option value="finished_good">منتج تام</option>
                  <option value="packaging">تغليف</option>
                  <option value="consumable">مستهلكات</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">وحدة القياس</label>
                <select
                  value={itemUomId}
                  onChange={(e) => setItemUomId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  {units.map(unit => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">حد إعادة الطلب</label>
                <input
                  type="number"
                  value={itemReorderLevel}
                  onChange={(e) => setItemReorderLevel(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">السعر الافتراضي</label>
                <input
                  type="number"
                  value={itemDefaultPrice}
                  onChange={(e) => setItemDefaultPrice(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الباركود</label>
                <input
                  type="text"
                  value={itemBarcode}
                  onChange={(e) => setItemBarcode(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="expiryTracking"
                  checked={itemExpiryTracking}
                  onChange={(e) => setItemExpiryTracking(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="expiryTracking" className="text-sm font-medium text-gray-700">
                  تتبع تاريخ الصلاحية
                </label>
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  {editingItem ? 'تحديث الصنف' : 'إضافة الصنف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeSubTab === 'adjustments' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <h3 className="font-bold text-gray-800 mb-4">إنشاء حركة مخزون</h3>
            <form onSubmit={handleCreateMovement} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الصنف</label>
                <select
                  value={adjItem}
                  onChange={(e) => setAdjItem(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {items.data.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المستودع</label>
                <select
                  value={adjWarehouse}
                  onChange={(e) => setAdjWarehouse(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع الحركة</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="manual_adjustment">تعديل يدوي</option>
                  <option value="transfer">نقل بين المستودعات</option>
                  <option value="receipt">استلام</option>
                  <option value="issue">صرف</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية</label>
                <input
                  type="number"
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              {adjType === 'transfer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المستودع المستقبل</label>
                  <select
                    value={adjToWarehouse}
                    onChange={(e) => setAdjToWarehouse(e.target.value)}
                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    {warehouses.filter(wh => wh.id !== adjWarehouse).map(wh => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الدفعة</label>
                <input
                  type="text"
                  value={adjBatchNo}
                  onChange={(e) => setAdjBatchNo(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  تنفيذ الحركة
                </button>
              </div>
            </form>
          </div>

          {/* Movements Table */}
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-800">سجل الحركات</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-right text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-bold text-gray-500">
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">الصنف</th>
                    <th className="py-3 px-4">المستودع</th>
                    <th className="py-3 px-4">نوع الحركة</th>
                    <th className="py-3 px-4">الكمية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.data.map((movement: any) => (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-500">
                        {new Date(movement.created_at).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="py-3 px-4 font-medium">{movement.item_id}</td>
                      <td className="py-3 px-4 text-gray-600">{movement.warehouse_id}</td>
                      <td className="py-3 px-4 text-gray-500">{movement.movement_type}</td>
                      <td className={`py-3 px-4 font-mono font-bold ${movement.qty > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {movement.qty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'card' && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-4">بطاقة الصنف</h3>
          <p className="text-gray-500">اختر صنفاً لعرض بطاقته</p>
        </div>
      )}
    </div>
  );
};