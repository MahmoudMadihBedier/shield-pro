import {
  IInventoryService, IDashboardService, ISettingsService,
  ISalesService, IPurchaseService, IAccountingService,
  IManufacturingService, IHRService, IAuthService
} from '../../core/interfaces/services';

import { InventoryService } from './inventory-service';
import { DashboardService } from './dashboard-service';
import { SettingsService } from './settings-service';
import { SalesService } from './sales-service';
import { PurchaseService } from './purchase-service';
import { AccountingService } from './accounting-service';
import { ManufacturingService } from './manufacturing-service';
import { HRService } from './hr-service';
import { TaskService } from './task-service';
import { RepLedgerService } from './rep-ledger-service';
import { DistributionService } from './distribution-service';
import { AnalyticsService } from './analytics-service';

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

  static getSalesService(): ISalesService {
    if (!instances.salesService) {
      instances.salesService = new SalesService();
    }
    return instances.salesService;
  }

  static getPurchaseService(): IPurchaseService {
    if (!instances.purchaseService) {
      instances.purchaseService = new PurchaseService();
    }
    return instances.purchaseService;
  }

  static getAccountingService(): IAccountingService {
    if (!instances.accountingService) {
      instances.accountingService = new AccountingService();
    }
    return instances.accountingService;
  }

  static getManufacturingService(): IManufacturingService {
    if (!instances.manufacturingService) {
      instances.manufacturingService = new ManufacturingService();
    }
    return instances.manufacturingService;
  }

  static getHRService(): IHRService {
    if (!instances.hrService) {
      instances.hrService = new HRService();
    }
    return instances.hrService;
  }

  static getTaskService(): TaskService {
    if (!instances.taskService) {
      instances.taskService = new TaskService();
    }
    return instances.taskService;
  }

  static getRepLedgerService(): RepLedgerService {
    if (!instances.repLedgerService) {
      instances.repLedgerService = new RepLedgerService();
    }
    return instances.repLedgerService;
  }

  static getDistributionService(): DistributionService {
    if (!instances.distributionService) {
      instances.distributionService = new DistributionService();
    }
    return instances.distributionService;
  }

  static getAnalyticsService(): AnalyticsService {
    if (!instances.analyticsService) {
      instances.analyticsService = new AnalyticsService();
    }
    return instances.analyticsService;
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