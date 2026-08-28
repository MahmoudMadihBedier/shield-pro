import {
  IUserRepository, IRoleRepository, IPermissionRepository, IRolePermissionRepository,
  IItemRepository, IUnitRepository, IUnitConversionRepository, IWarehouseRepository, IStockMovementRepository,
  ICustomerRepository, ISalesInvoiceRepository, ISalesInvoiceLineRepository, ISalesReturnRepository, ISalesReturnLineRepository,
  ISupplierRepository, IPurchaseInvoiceRepository, IPurchaseInvoiceLineRepository,
  IAccountRepository, IAccountTransactionRepository, IReceiptVoucherRepository, IPaymentVoucherRepository,
  IItemRecipeRepository, IProductionBatchRepository, IProductionConsumptionRepository,
  IEmployeeRepository, IAttendanceRepository, IPayrollRunRepository,
  ISettingRepository, IAuditLogRepository, IUserLocationRepository,
  ITaskRepository, IEmployeeReportRepository, IBonusRepository, IPunishmentRepository,
  IRepStockLedgerRepository, IRepCashLedgerRepository, IRepCloseoutSessionRepository,
  IProductionRequestRepository, IDistributionOrderRepository, IDistributionOrderLineRepository,
  ICashVoucherRepository
} from '../../core/interfaces/repository';

import { BaseRepository } from './base-repository';
import { ItemRepository } from './repositories/item-repository';
import { StockMovementRepository } from './repositories/stock-movement-repository';
import { AccountRepository } from './repositories/account-repository';
import { AccountTransactionRepository } from './repositories/account-transaction-repository';
import { WarehouseRepository } from './repositories/warehouse-repository';
import { UserRepository } from './repositories/user-repository';
import { RoleRepository } from './repositories/role-repository';
import { PermissionRepository } from './repositories/permission-repository';
import { RolePermissionRepository } from './repositories/role-permission-repository';
import { UnitConversionRepository } from './repositories/unit-conversion-repository';
import { CustomerRepository } from './repositories/customer-repository';
import { SalesInvoiceRepository } from './repositories/sales-invoice-repository';
import { SalesInvoiceLineRepository } from './repositories/sales-invoice-line-repository';
import { SalesReturnRepository } from './repositories/sales-return-repository';
import { SalesReturnLineRepository } from './repositories/sales-return-line-repository';
import { SupplierRepository } from './repositories/supplier-repository';
import { PurchaseInvoiceRepository } from './repositories/purchase-invoice-repository';
import { PurchaseInvoiceLineRepository } from './repositories/purchase-invoice-line-repository';
import { ReceiptVoucherRepository } from './repositories/receipt-voucher-repository';
import { PaymentVoucherRepository } from './repositories/payment-voucher-repository';
import { ItemRecipeRepository } from './repositories/item-recipe-repository';
import { ProductionBatchRepository } from './repositories/production-batch-repository';
import { ProductionConsumptionRepository } from './repositories/production-consumption-repository';
import { EmployeeRepository } from './repositories/employee-repository';
import { AttendanceRepository } from './repositories/attendance-repository';
import { PayrollRunRepository } from './repositories/payroll-run-repository';
import { SettingRepository } from './repositories/setting-repository';
import { AuditLogRepository } from './repositories/audit-log-repository';
import { UserLocationRepository } from './repositories/user-location-repository';
import { TaskRepository } from './repositories/task-repository';
import { EmployeeReportRepository } from './repositories/employee-report-repository';
import { BonusRepository } from './repositories/bonus-repository';
import { PunishmentRepository } from './repositories/punishment-repository';
import { RepStockLedgerRepository } from './repositories/rep-stock-ledger-repository';
import { RepCashLedgerRepository } from './repositories/rep-cash-ledger-repository';
import { RepCloseoutSessionRepository } from './repositories/rep-closeout-session-repository';
import { ProductionRequestRepository } from './repositories/production-request-repository';
import { DistributionOrderRepository } from './repositories/distribution-order-repository';
import { DistributionOrderLineRepository } from './repositories/distribution-order-line-repository';
import { CashVoucherRepository } from './repositories/cash-voucher-repository';
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
      instances.userRepository = new UserRepository();
    }
    return instances.userRepository;
  }

  static getRoleRepository(): IRoleRepository {
    if (!instances.roleRepository) {
      instances.roleRepository = new RoleRepository();
    }
    return instances.roleRepository;
  }

  static getPermissionRepository(): IPermissionRepository {
    if (!instances.permissionRepository) {
      instances.permissionRepository = new PermissionRepository();
    }
    return instances.permissionRepository;
  }

  static getRolePermissionRepository(): IRolePermissionRepository {
    if (!instances.rolePermissionRepository) {
      instances.rolePermissionRepository = new RolePermissionRepository();
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
      instances.unitConversionRepository = new UnitConversionRepository();
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
      instances.customerRepository = new CustomerRepository();
    }
    return instances.customerRepository;
  }

  static getSalesInvoiceRepository(): ISalesInvoiceRepository {
    if (!instances.salesInvoiceRepository) {
      instances.salesInvoiceRepository = new SalesInvoiceRepository();
    }
    return instances.salesInvoiceRepository;
  }

  static getSalesInvoiceLineRepository(): ISalesInvoiceLineRepository {
    if (!instances.salesInvoiceLineRepository) {
      instances.salesInvoiceLineRepository = new SalesInvoiceLineRepository();
    }
    return instances.salesInvoiceLineRepository;
  }

  static getSalesReturnRepository(): ISalesReturnRepository {
    if (!instances.salesReturnRepository) {
      instances.salesReturnRepository = new SalesReturnRepository();
    }
    return instances.salesReturnRepository;
  }

  static getSalesReturnLineRepository(): ISalesReturnLineRepository {
    if (!instances.salesReturnLineRepository) {
      instances.salesReturnLineRepository = new SalesReturnLineRepository();
    }
    return instances.salesReturnLineRepository;
  }

  static getSupplierRepository(): ISupplierRepository {
    if (!instances.supplierRepository) {
      instances.supplierRepository = new SupplierRepository();
    }
    return instances.supplierRepository;
  }

  static getPurchaseInvoiceRepository(): IPurchaseInvoiceRepository {
    if (!instances.purchaseInvoiceRepository) {
      instances.purchaseInvoiceRepository = new PurchaseInvoiceRepository();
    }
    return instances.purchaseInvoiceRepository;
  }

  static getPurchaseInvoiceLineRepository(): IPurchaseInvoiceLineRepository {
    if (!instances.purchaseInvoiceLineRepository) {
      instances.purchaseInvoiceLineRepository = new PurchaseInvoiceLineRepository();
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
      instances.receiptVoucherRepository = new ReceiptVoucherRepository();
    }
    return instances.receiptVoucherRepository;
  }

  static getPaymentVoucherRepository(): IPaymentVoucherRepository {
    if (!instances.paymentVoucherRepository) {
      instances.paymentVoucherRepository = new PaymentVoucherRepository();
    }
    return instances.paymentVoucherRepository;
  }

  static getItemRecipeRepository(): IItemRecipeRepository {
    if (!instances.itemRecipeRepository) {
      instances.itemRecipeRepository = new ItemRecipeRepository();
    }
    return instances.itemRecipeRepository;
  }

  static getProductionBatchRepository(): IProductionBatchRepository {
    if (!instances.productionBatchRepository) {
      instances.productionBatchRepository = new ProductionBatchRepository();
    }
    return instances.productionBatchRepository;
  }

  static getProductionConsumptionRepository(): IProductionConsumptionRepository {
    if (!instances.productionConsumptionRepository) {
      instances.productionConsumptionRepository = new ProductionConsumptionRepository();
    }
    return instances.productionConsumptionRepository;
  }

  static getEmployeeRepository(): IEmployeeRepository {
    if (!instances.employeeRepository) {
      instances.employeeRepository = new EmployeeRepository();
    }
    return instances.employeeRepository;
  }

  static getAttendanceRepository(): IAttendanceRepository {
    if (!instances.attendanceRepository) {
      instances.attendanceRepository = new AttendanceRepository();
    }
    return instances.attendanceRepository;
  }

  static getPayrollRunRepository(): IPayrollRunRepository {
    if (!instances.payrollRunRepository) {
      instances.payrollRunRepository = new PayrollRunRepository();
    }
    return instances.payrollRunRepository;
  }

  static getSettingRepository(): ISettingRepository {
    if (!instances.settingRepository) {
      instances.settingRepository = new SettingRepository();
    }
    return instances.settingRepository;
  }

  static getAuditLogRepository(): IAuditLogRepository {
    if (!instances.auditLogRepository) {
      instances.auditLogRepository = new AuditLogRepository();
    }
    return instances.auditLogRepository;
  }

  static getUserLocationRepository(): IUserLocationRepository {
    if (!instances.userLocationRepository) {
      instances.userLocationRepository = new UserLocationRepository();
    }
    return instances.userLocationRepository;
  }

  static getTaskRepository(): ITaskRepository {
    if (!instances.taskRepository) {
      instances.taskRepository = new TaskRepository();
    }
    return instances.taskRepository;
  }

  static getEmployeeReportRepository(): IEmployeeReportRepository {
    if (!instances.employeeReportRepository) {
      instances.employeeReportRepository = new EmployeeReportRepository();
    }
    return instances.employeeReportRepository;
  }

  static getBonusRepository(): IBonusRepository {
    if (!instances.bonusRepository) {
      instances.bonusRepository = new BonusRepository();
    }
    return instances.bonusRepository;
  }

  static getPunishmentRepository(): IPunishmentRepository {
    if (!instances.punishmentRepository) {
      instances.punishmentRepository = new PunishmentRepository();
    }
    return instances.punishmentRepository;
  }

  static getRepStockLedgerRepository(): IRepStockLedgerRepository {
    if (!instances.repStockLedgerRepository) {
      instances.repStockLedgerRepository = new RepStockLedgerRepository();
    }
    return instances.repStockLedgerRepository;
  }

  static getRepCashLedgerRepository(): IRepCashLedgerRepository {
    if (!instances.repCashLedgerRepository) {
      instances.repCashLedgerRepository = new RepCashLedgerRepository();
    }
    return instances.repCashLedgerRepository;
  }

  static getRepCloseoutSessionRepository(): IRepCloseoutSessionRepository {
    if (!instances.repCloseoutSessionRepository) {
      instances.repCloseoutSessionRepository = new RepCloseoutSessionRepository();
    }
    return instances.repCloseoutSessionRepository;
  }

  static getProductionRequestRepository(): IProductionRequestRepository {
    if (!instances.productionRequestRepository) {
      instances.productionRequestRepository = new ProductionRequestRepository();
    }
    return instances.productionRequestRepository;
  }

  static getDistributionOrderRepository(): IDistributionOrderRepository {
    if (!instances.distributionOrderRepository) {
      instances.distributionOrderRepository = new DistributionOrderRepository();
    }
    return instances.distributionOrderRepository;
  }

  static getDistributionOrderLineRepository(): IDistributionOrderLineRepository {
    if (!instances.distributionOrderLineRepository) {
      instances.distributionOrderLineRepository = new DistributionOrderLineRepository();
    }
    return instances.distributionOrderLineRepository;
  }

  static getCashVoucherRepository(): ICashVoucherRepository {
    if (!instances.cashVoucherRepository) {
      instances.cashVoucherRepository = new CashVoucherRepository();
    }
    return instances.cashVoucherRepository;
  }

  // Reset all instances (useful for testing)
  static reset(): void {
    instances = {};
  }
}