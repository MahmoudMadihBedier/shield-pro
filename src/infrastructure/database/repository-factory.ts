import {
  IUserRepository, IRoleRepository, IPermissionRepository, IRolePermissionRepository,
  IItemRepository, IUnitRepository, IUnitConversionRepository, IWarehouseRepository, IStockMovementRepository,
  ICustomerRepository, ISalesInvoiceRepository, ISalesInvoiceLineRepository, ISalesReturnRepository, ISalesReturnLineRepository,
  ISupplierRepository, IPurchaseInvoiceRepository, IPurchaseInvoiceLineRepository,
  IAccountRepository, IAccountTransactionRepository, IReceiptVoucherRepository, IPaymentVoucherRepository,
  IItemRecipeRepository, IProductionBatchRepository, IProductionConsumptionRepository,
  IEmployeeRepository, IAttendanceRepository, IPayrollRunRepository,
  ISettingRepository, IAuditLogRepository, IUserLocationRepository
} from '../../core/interfaces/repository';

import { BaseRepository } from './base-repository';
import { ItemRepository } from './repositories/item-repository';
import { StockMovementRepository } from './repositories/stock-movement-repository';
import { AccountRepository } from './repositories/account-repository';
import { AccountTransactionRepository } from './repositories/account-transaction-repository';
import { WarehouseRepository } from './repositories/warehouse-repository';
import { IRepository } from '../../core/interfaces/repository';
import { BaseEntity } from '../../core/domain/entities';

// Base repository implementations for simple entities
class BaseRepositorySimple<T extends BaseEntity> extends BaseRepository<T> implements IRepository<T> {
  constructor(tableName: string) {
    super(tableName);
  }
}

// Singleton instances
let instances: any = {};

export class RepositoryFactory {
  static getItemRepository(): IItemRepository {
    if (!instances.itemRepository) {
      instances.itemRepository = new ItemRepository();
    }
    return instances.itemRepository;
  }

  static getStockMovementRepository(): IStockMovementRepository {
    if (!instances.stockMovementRepository) {
      instances.stockMovementRepository = new StockMovementRepository();
    }
    return instances.stockMovementRepository;
  }

  static getUserRepository(): IUserRepository {
    if (!instances.userRepository) {
      instances.userRepository = new BaseRepositorySimple('users');
    }
    return instances.userRepository;
  }

  static getRoleRepository(): IRoleRepository {
    if (!instances.roleRepository) {
      instances.roleRepository = new BaseRepositorySimple('roles');
    }
    return instances.roleRepository;
  }

  static getPermissionRepository(): IPermissionRepository {
    if (!instances.permissionRepository) {
      instances.permissionRepository = new BaseRepositorySimple('permissions');
    }
    return instances.permissionRepository;
  }

  static getRolePermissionRepository(): IRolePermissionRepository {
    if (!instances.rolePermissionRepository) {
      instances.rolePermissionRepository = new BaseRepositorySimple('role_permissions');
    }
    return instances.rolePermissionRepository;
  }

  static getUnitRepository(): IUnitRepository {
    if (!instances.unitRepository) {
      instances.unitRepository = new BaseRepositorySimple('units');
    }
    return instances.unitRepository;
  }

  static getUnitConversionRepository(): IUnitConversionRepository {
    if (!instances.unitConversionRepository) {
      instances.unitConversionRepository = new BaseRepositorySimple('unit_conversions');
    }
    return instances.unitConversionRepository;
  }

  static getWarehouseRepository(): IWarehouseRepository {
    if (!instances.warehouseRepository) {
      instances.warehouseRepository = new WarehouseRepository();
    }
    return instances.warehouseRepository;
  }

  static getCustomerRepository(): ICustomerRepository {
    if (!instances.customerRepository) {
      instances.customerRepository = new BaseRepositorySimple('customers');
    }
    return instances.customerRepository;
  }

  static getSalesInvoiceRepository(): ISalesInvoiceRepository {
    if (!instances.salesInvoiceRepository) {
      instances.salesInvoiceRepository = new BaseRepositorySimple('sales_invoices');
    }
    return instances.salesInvoiceRepository;
  }

  static getSalesInvoiceLineRepository(): ISalesInvoiceLineRepository {
    if (!instances.salesInvoiceLineRepository) {
      instances.salesInvoiceLineRepository = new BaseRepositorySimple('sales_invoice_lines');
    }
    return instances.salesInvoiceLineRepository;
  }

  static getSalesReturnRepository(): ISalesReturnRepository {
    if (!instances.salesReturnRepository) {
      instances.salesReturnRepository = new BaseRepositorySimple('sales_returns');
    }
    return instances.salesReturnRepository;
  }

  static getSalesReturnLineRepository(): ISalesReturnLineRepository {
    if (!instances.salesReturnLineRepository) {
      instances.salesReturnLineRepository = new BaseRepositorySimple('sales_return_lines');
    }
    return instances.salesReturnLineRepository;
  }

  static getSupplierRepository(): ISupplierRepository {
    if (!instances.supplierRepository) {
      instances.supplierRepository = new BaseRepositorySimple('suppliers');
    }
    return instances.supplierRepository;
  }

  static getPurchaseInvoiceRepository(): IPurchaseInvoiceRepository {
    if (!instances.purchaseInvoiceRepository) {
      instances.purchaseInvoiceRepository = new BaseRepositorySimple('purchase_invoices');
    }
    return instances.purchaseInvoiceRepository;
  }

  static getPurchaseInvoiceLineRepository(): IPurchaseInvoiceLineRepository {
    if (!instances.purchaseInvoiceLineRepository) {
      instances.purchaseInvoiceLineRepository = new BaseRepositorySimple('purchase_invoice_lines');
    }
    return instances.purchaseInvoiceLineRepository;
  }

  static getAccountRepository(): IAccountRepository {
    if (!instances.accountRepository) {
      instances.accountRepository = new AccountRepository();
    }
    return instances.accountRepository;
  }

  static getAccountTransactionRepository(): IAccountTransactionRepository {
    if (!instances.accountTransactionRepository) {
      instances.accountTransactionRepository = new AccountTransactionRepository();
    }
    return instances.accountTransactionRepository;
  }

  static getReceiptVoucherRepository(): IReceiptVoucherRepository {
    if (!instances.receiptVoucherRepository) {
      instances.receiptVoucherRepository = new BaseRepositorySimple('receipt_vouchers');
    }
    return instances.receiptVoucherRepository;
  }

  static getPaymentVoucherRepository(): IPaymentVoucherRepository {
    if (!instances.paymentVoucherRepository) {
      instances.paymentVoucherRepository = new BaseRepositorySimple('payment_vouchers');
    }
    return instances.paymentVoucherRepository;
  }

  static getItemRecipeRepository(): IItemRecipeRepository {
    if (!instances.itemRecipeRepository) {
      instances.itemRecipeRepository = new BaseRepositorySimple('item_recipes');
    }
    return instances.itemRecipeRepository;
  }

  static getProductionBatchRepository(): IProductionBatchRepository {
    if (!instances.productionBatchRepository) {
      instances.productionBatchRepository = new BaseRepositorySimple('production_batches');
    }
    return instances.productionBatchRepository;
  }

  static getProductionConsumptionRepository(): IProductionConsumptionRepository {
    if (!instances.productionConsumptionRepository) {
      instances.productionConsumptionRepository = new BaseRepositorySimple('production_consumptions');
    }
    return instances.productionConsumptionRepository;
  }

  static getEmployeeRepository(): IEmployeeRepository {
    if (!instances.employeeRepository) {
      instances.employeeRepository = new BaseRepositorySimple('employees');
    }
    return instances.employeeRepository;
  }

  static getAttendanceRepository(): IAttendanceRepository {
    if (!instances.attendanceRepository) {
      instances.attendanceRepository = new BaseRepositorySimple('attendance');
    }
    return instances.attendanceRepository;
  }

  static getPayrollRunRepository(): IPayrollRunRepository {
    if (!instances.payrollRunRepository) {
      instances.payrollRunRepository = new BaseRepositorySimple('payroll_runs');
    }
    return instances.payrollRunRepository;
  }

  static getSettingRepository(): ISettingRepository {
    if (!instances.settingRepository) {
      instances.settingRepository = new BaseRepositorySimple('settings');
    }
    return instances.settingRepository;
  }

  static getAuditLogRepository(): IAuditLogRepository {
    if (!instances.auditLogRepository) {
      instances.auditLogRepository = new BaseRepositorySimple('audit_log');
    }
    return instances.auditLogRepository;
  }

  static getUserLocationRepository(): IUserLocationRepository {
    if (!instances.userLocationRepository) {
      instances.userLocationRepository = new BaseRepositorySimple('user_locations');
    }
    return instances.userLocationRepository;
  }

  // Reset all instances (useful for testing)
  static reset(): void {
    instances = {};
  }
}