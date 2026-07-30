// Facade Pattern - Provides a simplified interface to a complex subsystem

import { RepositoryFactory } from '../../infrastructure/database/repository-factory';
import { ServiceFactory } from '../../application/services/service-factory';

export class ERPFacade {
  // Simplified interface for common operations
  
  // Inventory operations
  async getItem(itemId: string) {
    const itemRepository = RepositoryFactory.getItemRepository();
    return await itemRepository.findById(itemId);
  }

  async searchItems(query: string) {
    const itemRepository = RepositoryFactory.getItemRepository();
    return await itemRepository.searchByName(query);
  }

  async getItemStock(itemId: string, warehouseId?: string) {
    const stockRepository = RepositoryFactory.getStockMovementRepository();
    return await stockRepository.calculateStock(itemId, warehouseId);
  }

  // Customer operations
  async getCustomer(customerId: string) {
    const customerRepository = RepositoryFactory.getCustomerRepository();
    return await customerRepository.findById(customerId);
  }

  async searchCustomers(query: string) {
    const customerRepository = RepositoryFactory.getCustomerRepository();
    return await customerRepository.searchByName(query);
  }

  // Supplier operations
  async getSupplier(supplierId: string) {
    const supplierRepository = RepositoryFactory.getSupplierRepository();
    return await supplierRepository.findById(supplierId);
  }

  async searchSuppliers(query: string) {
    const supplierRepository = RepositoryFactory.getSupplierRepository();
    return await supplierRepository.searchByName(query);
  }

  // Account operations
  async getAccountBalance(accountId: string) {
    const transactionRepository = RepositoryFactory.getAccountTransactionRepository();
    return await transactionRepository.calculateBalance(accountId);
  }

  async getCashBankBalance() {
    const dashboardService = ServiceFactory.getDashboardService();
    return await dashboardService.getCashBankBalance();
  }

  // Dashboard operations
  async getDashboardStats() {
    const dashboardService = ServiceFactory.getDashboardService();
    return await dashboardService.getDashboardStats();
  }

  async getLowStockItems(limit: number = 5) {
    const dashboardService = ServiceFactory.getDashboardService();
    return await dashboardService.getLowStockItems(limit);
  }

  // Settings operations
  async getSetting(key: string, defaultValue?: string) {
    const settingsService = ServiceFactory.getSettingsService();
    return await settingsService.getSetting(key, defaultValue);
  }

  async saveSetting(key: string, value: string) {
    const settingsService = ServiceFactory.getSettingsService();
    return await settingsService.saveSetting(key, value);
  }

  // Complex operations simplified
  async createSalesOrder(orderData: any) {
    // This would coordinate multiple services and repositories
    // Example of facade simplifying complex workflow
    const customer = await this.getCustomer(orderData.customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const items = await Promise.all(
      orderData.items.map(async (item: any) => ({
        ...item,
        currentStock: await this.getItemStock(item.itemId, orderData.warehouseId)
      }))
    );

    // Validate stock
    const outOfStockItems = items.filter((item: any) => item.currentStock < item.qty);
    if (outOfStockItems.length > 0) {
      throw new Error('Some items are out of stock');
    }

    // Create order through service
    // ... implementation

    return { success: true, items };
  }

  // Quick search across multiple entities
  async globalSearch(query: string) {
    const [items, customers, suppliers] = await Promise.all([
      this.searchItems(query),
      this.searchCustomers(query),
      this.searchSuppliers(query)
    ]);

    return {
      items,
      customers,
      suppliers
    };
  }
}

// Global facade instance
export const erpFacade = new ERPFacade();