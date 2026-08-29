import {
  User,
  Item, StockMovement,
  Customer, SalesInvoice, SalesInvoiceLine, SalesReturn, SalesReturnLine,
  Supplier, PurchaseInvoice, PurchaseInvoiceLine,
  Account, AccountTransaction, ReceiptVoucher, PaymentVoucher, CashVoucher,
  ItemRecipe, ProductionBatch, ProductionConsumption, ProductionRequest,
  Employee, Attendance, PayrollRun,
  Setting
} from '../domain/entities';
import { PaginationParams, PaginatedResult, EntityFilter, CustomerStatementEntry, ProfitLoss } from '../types';

// Authentication Service
export interface IAuthService {
  signIn(email: string, password: string): Promise<User>;
  signUp(email: string, password: string, name: string): Promise<boolean>;
  signOut(): Promise<void>;
  getCurrentUser(): User | null;
  checkPermission(module: string, action: 'view' | 'add' | 'edit' | 'delete'): boolean;
  refreshProfile(userId: string): Promise<User>;
}

// Inventory Service
export interface IInventoryService {
  getItems(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Item>>;
  getItemById(id: string): Promise<Item | undefined>;
  createItem(item: Omit<Item, 'id' | 'created_at' | 'updated_at'>): Promise<Item>;
  updateItem(id: string, item: Partial<Item>): Promise<Item>;
  deleteItem(id: string): Promise<void>;
  searchItems(query: string): Promise<Item[]>;
  calculateStock(itemId: string, warehouseId?: string): Promise<number>;
  getLowStockItems(threshold?: number): Promise<Item[]>;
  createStockMovement(movement: Omit<StockMovement, 'id' | 'created_at' | 'updated_at'>): Promise<StockMovement>;
  getStockMovements(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<StockMovement>>;
}

// Sales Service
export interface ISalesService {
  getCustomers(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Customer>>;
  createCustomer(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>): Promise<Customer>;
  approveCustomer(customerId: string, warehouseId: string): Promise<Customer>;
  setCustomerPortalPin(customerId: string, pin: string): Promise<void>;
  getInvoices(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<SalesInvoice>>;
  createInvoice(invoice: Omit<SalesInvoice, 'id' | 'created_at' | 'updated_at' | 'warehouse_id'>, lines: Omit<SalesInvoiceLine, 'id' | 'created_at' | 'updated_at'>[], warehouseId: string, repIssuance?: { repUserId: string }, creditOverride?: { requestedBy: string; approvedBy: string }): Promise<SalesInvoice>;
  getCustomerOutstandingBalance(customerId: string): Promise<number>;
  getCustomerAgingReport(): Promise<{ customer_id: string; name: string; bucket_0_30: number; bucket_31_60: number; bucket_61_90: number; bucket_90_plus: number; total: number }[]>;
  updateInvoice(id: string, invoice: Partial<SalesInvoice>): Promise<SalesInvoice>;
  deleteInvoice(id: string): Promise<void>;
  getInvoiceLines(invoiceId: string): Promise<SalesInvoiceLine[]>;
  createSalesReturn(returnData: Omit<SalesReturn, 'id' | 'created_at' | 'updated_at'>, lines: Omit<SalesReturnLine, 'id' | 'created_at' | 'updated_at'>[]): Promise<SalesReturn>;
  getReceiptVouchers(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<ReceiptVoucher>>;
  createReceiptVoucher(voucher: Omit<ReceiptVoucher, 'id' | 'created_at' | 'updated_at'>): Promise<ReceiptVoucher>;
  getCustomerStatement(customerId: string, startDate: string, endDate: string): Promise<CustomerStatementEntry[]>;
}

// Purchase Service
export interface IPurchaseService {
  getSuppliers(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Supplier>>;
  createSupplier(supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>): Promise<Supplier>;
  getInvoices(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<PurchaseInvoice>>;
  createInvoice(invoice: Omit<PurchaseInvoice, 'id' | 'created_at' | 'updated_at'>, lines: Omit<PurchaseInvoiceLine, 'id' | 'created_at' | 'updated_at'>[], warehouseId: string): Promise<PurchaseInvoice>;
  updateInvoice(id: string, invoice: Partial<PurchaseInvoice>): Promise<PurchaseInvoice>;
  deleteInvoice(id: string): Promise<void>;
  getInvoiceLines(invoiceId: string): Promise<PurchaseInvoiceLine[]>;
  getPaymentVouchers(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<PaymentVoucher>>;
  createPaymentVoucher(voucher: Omit<PaymentVoucher, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentVoucher>;
}

// Accounting Service
export interface IAccountingService {
  getAccounts(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Account>>;
  createAccount(account: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Promise<Account>;
  getAccountBalance(accountId: string): Promise<number>;
  getTransactions(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<AccountTransaction>>;
  createTransaction(transaction: Omit<AccountTransaction, 'id' | 'created_at' | 'updated_at'>): Promise<AccountTransaction>;
  getCashBankBalance(): Promise<number>;
  getProfitLoss(startDate: string, endDate: string): Promise<ProfitLoss>;
  getProfitLossForWarehouse(startDate: string, endDate: string, warehouseId: string | null): Promise<ProfitLoss>;
  getDailyCashPositionForWarehouse(date: string, warehouseId: string | null): Promise<number>;
  getCashVouchers(warehouseId: string | null): Promise<CashVoucher[]>;
  createCashVoucher(voucherType: 'receipt' | 'disbursement', amount: number, accountId: string, reason: string, warehouseId: string | null, date?: string): Promise<CashVoucher>;
}

// Manufacturing Service
export interface IManufacturingService {
  getRecipes(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<ItemRecipe>>;
  createRecipe(recipe: Omit<ItemRecipe, 'id' | 'created_at' | 'updated_at'>): Promise<ItemRecipe>;
  getBatches(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<ProductionBatch>>;
  createBatch(batch: Omit<ProductionBatch, 'id' | 'created_at' | 'updated_at'>): Promise<ProductionBatch>;
  updateBatch(id: string, batch: Partial<ProductionBatch>): Promise<ProductionBatch>;
  completeBatch(id: string, actualQty: number, actualWastePct: number, warehouseId: string): Promise<ProductionBatch>;
  getBatchConsumptions(batchId: string): Promise<ProductionConsumption[]>;
  createProductionRequest(itemId: string, requestedQty: number, requestedBy: string, rawMaterialWarehouseId: string, notes?: string): Promise<ProductionRequest>;
  getProductionRequests(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<ProductionRequest>>;
  approveProductionRequestMaterials(requestId: string, approvedBy: string): Promise<ProductionRequest>;
  rejectProductionRequest(requestId: string, rejectedBy: string, reason: string): Promise<ProductionRequest>;
  startProductionFromRequest(requestId: string, plannedQty: number): Promise<ProductionBatch>;
  releaseBatchQC(batchId: string, releasedBy: string, approve: boolean, warehouseIdFallback: string, rejectionReason?: string): Promise<ProductionBatch>;
}

// HR Service
export interface IHRService {
  getEmployees(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Employee>>;
  createEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<Employee>): Promise<Employee>;
  getAttendance(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<Attendance>>;
  recordAttendance(attendance: Omit<Attendance, 'id' | 'created_at' | 'updated_at'>): Promise<Attendance>;
  clockIn(employeeId: string, lat?: number | null, lng?: number | null): Promise<Attendance>;
  clockOut(employeeId: string, lat?: number | null, lng?: number | null): Promise<Attendance>;
  getPayrollRuns(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<PayrollRun>>;
  createPayrollRun(payroll: Omit<PayrollRun, 'id' | 'created_at' | 'updated_at'>): Promise<PayrollRun>;
}

// Settings Service
export interface ISettingsService {
  getSetting(key: string, defaultValue?: string): Promise<string>;
  getSettingBool(key: string, defaultValue?: boolean): Promise<boolean>;
  saveSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Setting[]>;
}

// Dashboard Service
export interface IDashboardService {
  getTodaySales(): Promise<number>;
  getCashBankBalance(): Promise<number>;
  getLowStockCount(): Promise<number>;
  getPendingSyncCount(): Promise<number>;
  getDashboardStats(): Promise<{
    todaySales: number;
    cashBank: number;
    lowStockCount: number;
    pendingSync: number;
  }>;
  getLowStockItems(limit?: number): Promise<Item[]>;
}