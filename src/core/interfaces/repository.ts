import type { BaseEntity, PaginationParams, PaginatedResult, EntityFilter } from '../types/index';

// Re-export types for convenience
export type { PaginationParams, PaginatedResult, EntityFilter };
import {
  User, Role, Permission, RolePermission,
  Item, Unit, UnitConversion, Warehouse, StockMovement,
  Customer, SalesInvoice, SalesInvoiceLine, SalesReturn, SalesReturnLine,
  Supplier, PurchaseInvoice, PurchaseInvoiceLine,
  Account, AccountTransaction, ReceiptVoucher, PaymentVoucher,
  ItemRecipe, ProductionBatch, ProductionConsumption,
  Employee, Attendance, PayrollRun,
  Setting, AuditLog, UserLocation
} from '../domain/entities';

// Base Repository Interface
export interface IRepository<T extends BaseEntity> {
  findById(id: string): Promise<T | undefined>;
  findAll(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<T>>;
  create(entity: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>;
  update(id: string, entity: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  count(filter?: EntityFilter): Promise<number>;
}

// Specific Repository Interfaces
export interface IUserRepository extends IRepository<User> {
  findByEmail(email: string): Promise<User | undefined>;
  findByRoleId(roleId: string): Promise<User[]>;
}

export interface IRoleRepository extends IRepository<Role> {
  findByName(name: string): Promise<Role | undefined>;
}

export interface IPermissionRepository extends IRepository<Permission> {
  findByModule(module: string): Promise<Permission[]>;
}

export interface IRolePermissionRepository extends IRepository<RolePermission> {
  findByRoleId(roleId: string): Promise<RolePermission[]>;
}

export interface IItemRepository extends IRepository<Item> {
  findByType(type: string): Promise<Item[]>;
  findByBarcode(barcode: string): Promise<Item | undefined>;
  searchByName(query: string): Promise<Item[]>;
}

export interface IUnitRepository extends IRepository<Unit> {}

export interface IUnitConversionRepository extends IRepository<UnitConversion> {
  findByFromUnit(fromUnitId: string): Promise<UnitConversion[]>;
}

export interface IWarehouseRepository extends IRepository<Warehouse> {
  findActive(): Promise<Warehouse[]>;
}

export interface IStockMovementRepository extends IRepository<StockMovement> {
  findByItemId(itemId: string): Promise<StockMovement[]>;
  findByWarehouseId(warehouseId: string): Promise<StockMovement[]>;
  calculateStock(itemId: string, warehouseId?: string): Promise<number>;
}

export interface ICustomerRepository extends IRepository<Customer> {
  searchByName(query: string): Promise<Customer[]>;
}

export interface ISalesInvoiceRepository extends IRepository<SalesInvoice> {
  findByCustomerId(customerId: string): Promise<SalesInvoice[]>;
  findByDateRange(startDate: string, endDate: string): Promise<SalesInvoice[]>;
}

export interface ISalesInvoiceLineRepository extends IRepository<SalesInvoiceLine> {
  findByInvoiceId(invoiceId: string): Promise<SalesInvoiceLine[]>;
}

export interface ISalesReturnRepository extends IRepository<SalesReturn> {
  findByInvoiceId(invoiceId: string): Promise<SalesReturn[]>;
}

export interface ISalesReturnLineRepository extends IRepository<SalesReturnLine> {
  findByReturnId(returnId: string): Promise<SalesReturnLine[]>;
}

export interface ISupplierRepository extends IRepository<Supplier> {
  searchByName(query: string): Promise<Supplier[]>;
}

export interface IPurchaseInvoiceRepository extends IRepository<PurchaseInvoice> {
  findBySupplierId(supplierId: string): Promise<PurchaseInvoice[]>;
  findByDateRange(startDate: string, endDate: string): Promise<PurchaseInvoice[]>;
}

export interface IPurchaseInvoiceLineRepository extends IRepository<PurchaseInvoiceLine> {
  findByInvoiceId(invoiceId: string): Promise<PurchaseInvoiceLine[]>;
}

export interface IAccountRepository extends IRepository<Account> {
  findByCategory(category: string): Promise<Account[]>;
  findByCode(code: string): Promise<Account | undefined>;
}

export interface IAccountTransactionRepository extends IRepository<AccountTransaction> {
  findByAccountId(accountId: string): Promise<AccountTransaction[]>;
  calculateBalance(accountId: string): Promise<number>;
}

export interface IReceiptVoucherRepository extends IRepository<ReceiptVoucher> {
  findByCustomerId(customerId: string): Promise<ReceiptVoucher[]>;
}

export interface IPaymentVoucherRepository extends IRepository<PaymentVoucher> {
  findBySupplierId(supplierId: string): Promise<PaymentVoucher[]>;
}

export interface IItemRecipeRepository extends IRepository<ItemRecipe> {
  findByParentItemId(parentItemId: string): Promise<ItemRecipe[]>;
  findByType(recipeType: string): Promise<ItemRecipe[]>;
}

export interface IProductionBatchRepository extends IRepository<ProductionBatch> {
  findByItemId(itemId: string): Promise<ProductionBatch[]>;
  findByStatus(status: string): Promise<ProductionBatch[]>;
}

export interface IProductionConsumptionRepository extends IRepository<ProductionConsumption> {
  findByBatchId(batchId: string): Promise<ProductionConsumption[]>;
}

export interface IEmployeeRepository extends IRepository<Employee> {
  searchByName(query: string): Promise<Employee[]>;
}

export interface IAttendanceRepository extends IRepository<Attendance> {
  findByEmployeeId(employeeId: string): Promise<Attendance[]>;
  findByDateRange(startDate: string, endDate: string): Promise<Attendance[]>;
}

export interface IPayrollRunRepository extends IRepository<PayrollRun> {
  findByMonth(month: string): Promise<PayrollRun[]>;
  findByEmployeeId(employeeId: string): Promise<PayrollRun[]>;
}

export interface ISettingRepository extends IRepository<Setting> {
  findByKey(key: string): Promise<Setting | undefined>;
  findByScope(scope: string): Promise<Setting[]>;
}

export interface IAuditLogRepository extends IRepository<AuditLog> {
  findByUserId(userId: string): Promise<AuditLog[]>;
  findByTableName(tableName: string): Promise<AuditLog[]>;
}

export interface IUserLocationRepository extends IRepository<UserLocation> {
  findByUserId(userId: string): Promise<UserLocation[]>;
  findByDateRange(startDate: string, endDate: string): Promise<UserLocation[]>;
}