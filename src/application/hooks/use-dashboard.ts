import { useState, useEffect, useCallback } from 'react';
import { Item } from '../../core/domain/entities';
import { ServiceFactory } from '../services/service-factory';

export function useDashboard() {
  const [stats, setStats] = useState({
    todaySales: 0,
    cashBank: 0,
    lowStockCount: 0,
    pendingSync: 0
  });
  const [lowStockItems, setLowStockItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dashboardService = ServiceFactory.getDashboardService();

  const loadDashboardStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, lowStockResult] = await Promise.all([
        dashboardService.getDashboardStats(),
        dashboardService.getLowStockItems(5)
      ]);
      setStats(statsResult);
      setLowStockItems(lowStockResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  }, [dashboardService]);

  useEffect(() => {
    loadDashboardStats();
  }, [loadDashboardStats]);

  return {
    stats,
    lowStockItems,
    loading,
    error,
    loadDashboardStats
  };
}