import { useState, useEffect, useCallback } from 'react';
import { Item, StockMovement } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { ServiceFactory } from '../services/service-factory';

export function useInventory(filter?: EntityFilter, params?: PaginationParams) {
  const [items, setItems] = useState<PaginatedResult<Item>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inventoryService = ServiceFactory.getInventoryService();

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await inventoryService.getItems(filter, params);
      setItems(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [filter, params, inventoryService]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const createItem = useCallback(async (item: Omit<Item, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newItem = await inventoryService.createItem(item);
      await loadItems();
      return newItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create item');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [inventoryService, loadItems]);

  const updateItem = useCallback(async (id: string, item: Partial<Item>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedItem = await inventoryService.updateItem(id, item);
      await loadItems();
      return updatedItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [inventoryService, loadItems]);

  const deleteItem = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await inventoryService.deleteItem(id);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [inventoryService, loadItems]);

  const searchItems = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const results = await inventoryService.searchItems(query);
      return results;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search items');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [inventoryService]);

  const calculateStock = useCallback(async (itemId: string, warehouseId?: string) => {
    return await inventoryService.calculateStock(itemId, warehouseId);
  }, [inventoryService]);

  return {
    items,
    loading,
    error,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    searchItems,
    calculateStock
  };
}

export function useStockMovements(filter?: EntityFilter, params?: PaginationParams) {
  const [movements, setMovements] = useState<PaginatedResult<StockMovement>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inventoryService = ServiceFactory.getInventoryService();

  const loadMovements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await inventoryService.getStockMovements(filter, params);
      setMovements(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  }, [filter, params, inventoryService]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const createMovement = useCallback(async (movement: Omit<StockMovement, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newMovement = await inventoryService.createStockMovement(movement);
      await loadMovements();
      return newMovement;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create stock movement');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [inventoryService, loadMovements]);

  return {
    movements,
    loading,
    error,
    loadMovements,
    createMovement
  };
}