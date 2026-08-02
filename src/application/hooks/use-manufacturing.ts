import { useState, useEffect, useCallback } from 'react';
import { ItemRecipe, ProductionBatch, ProductionConsumption } from '../../core/domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter } from '../../core/types';
import { ServiceFactory } from '../services/service-factory';

export function useRecipes(filter?: EntityFilter, params?: PaginationParams) {
  const [recipes, setRecipes] = useState<PaginatedResult<ItemRecipe>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manufacturingService = ServiceFactory.getManufacturingService();

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await manufacturingService.getRecipes(filter, params);
      setRecipes(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  }, [filter, params, manufacturingService]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  const createRecipe = useCallback(async (recipe: Omit<ItemRecipe, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newRecipe = await manufacturingService.createRecipe(recipe);
      await loadRecipes();
      return newRecipe;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create recipe');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [manufacturingService, loadRecipes]);

  return {
    recipes,
    loading,
    error,
    loadRecipes,
    createRecipe
  };
}

export function useProductionBatches(filter?: EntityFilter, params?: PaginationParams) {
  const [batches, setBatches] = useState<PaginatedResult<ProductionBatch>>({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manufacturingService = ServiceFactory.getManufacturingService();

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await manufacturingService.getBatches(filter, params);
      setBatches(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load production batches');
    } finally {
      setLoading(false);
    }
  }, [filter, params, manufacturingService]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const createBatch = useCallback(async (batch: Omit<ProductionBatch, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newBatch = await manufacturingService.createBatch(batch);
      await loadBatches();
      return newBatch;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create production batch');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [manufacturingService, loadBatches]);

  const updateBatch = useCallback(async (id: string, batch: Partial<ProductionBatch>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedBatch = await manufacturingService.updateBatch(id, batch);
      await loadBatches();
      return updatedBatch;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update production batch');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [manufacturingService, loadBatches]);

  const completeBatch = useCallback(async (id: string, actualQty: number) => {
    setLoading(true);
    setError(null);
    try {
      const updatedBatch = await manufacturingService.completeBatch(id, actualQty);
      await loadBatches();
      return updatedBatch;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete production batch');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [manufacturingService, loadBatches]);

  const getBatchConsumptions = useCallback(async (batchId: string): Promise<ProductionConsumption[]> => {
    return await manufacturingService.getBatchConsumptions(batchId);
  }, [manufacturingService]);

  return {
    batches,
    loading,
    error,
    loadBatches,
    createBatch,
    updateBatch,
    completeBatch,
    getBatchConsumptions
  };
}
