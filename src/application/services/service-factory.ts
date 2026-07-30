import {
  IInventoryService, IDashboardService, ISettingsService,
  ISalesService, IPurchaseService, IAccountingService,
  IManufacturingService, IHRService, IAuthService
} from '../../core/interfaces/services';

import { InventoryService } from './inventory-service';
import { DashboardService } from './dashboard-service';
import { SettingsService } from './settings-service';

// Singleton instances
let instances: any = {};

export class ServiceFactory {
  static getInventoryService(): IInventoryService {
    if (!instances.inventoryService) {
      instances.inventoryService = new InventoryService();
    }
    return instances.inventoryService;
  }

  static getDashboardService(): IDashboardService {
    if (!instances.dashboardService) {
      instances.dashboardService = new DashboardService();
    }
    return instances.dashboardService;
  }

  static getSettingsService(): ISettingsService {
    if (!instances.settingsService) {
      instances.settingsService = new SettingsService();
    }
    return instances.settingsService;
  }

  // Additional services can be added here as they are implemented
  static getSalesService(): ISalesService {
    if (!instances.salesService) {
      // instances.salesService = new SalesService();
      throw new Error('SalesService not yet implemented');
    }
    return instances.salesService;
  }

  static getPurchaseService(): IPurchaseService {
    if (!instances.purchaseService) {
      // instances.purchaseService = new PurchaseService();
      throw new Error('PurchaseService not yet implemented');
    }
    return instances.purchaseService;
  }

  static getAccountingService(): IAccountingService {
    if (!instances.accountingService) {
      // instances.accountingService = new AccountingService();
      throw new Error('AccountingService not yet implemented');
    }
    return instances.accountingService;
  }

  static getManufacturingService(): IManufacturingService {
    if (!instances.manufacturingService) {
      // instances.manufacturingService = new ManufacturingService();
      throw new Error('ManufacturingService not yet implemented');
    }
    return instances.manufacturingService;
  }

  static getHRService(): IHRService {
    if (!instances.hrService) {
      // instances.hrService = new HRService();
      throw new Error('HRService not yet implemented');
    }
    return instances.hrService;
  }

  static getAuthService(): IAuthService {
    if (!instances.authService) {
      // AuthService is React Context-based, created separately
      throw new Error('AuthService is provided via AuthProvider context, not factory');
    }
    return instances.authService;
  }

  // Reset all instances (useful for testing)
  static reset(): void {
    instances = {};
  }
}