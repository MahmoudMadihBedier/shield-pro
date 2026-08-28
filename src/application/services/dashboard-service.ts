import { IDashboardService } from '../../core/interfaces/services';
import { Item } from '../../core/domain/entities';
import { RepositoryFactory } from '../../infrastructure/database/repository-factory';

export class DashboardService implements IDashboardService {
  private salesInvoiceRepository = RepositoryFactory.getSalesInvoiceRepository();
  private accountTransactionRepository = RepositoryFactory.getAccountTransactionRepository();
  private itemRepository = RepositoryFactory.getItemRepository();
  private stockMovementRepository = RepositoryFactory.getStockMovementRepository();

  async getTodaySales(): Promise<number> {
    const todayStr = new Date().toISOString().split('T')[0];
    const invoices = await this.salesInvoiceRepository.findAll();
    
    return invoices.data
      .filter((inv: any) => inv.date === todayStr)
      .reduce((sum, inv) => sum + Number(inv.total), 0);
  }

  async getCashBankBalance(): Promise<number> {
    const accounts = await this.accountTransactionRepository.findAll();
    const cashBankAccounts = await RepositoryFactory.getAccountRepository()
      .findByCategory('cash') || [];
    const bankAccounts = await RepositoryFactory.getAccountRepository()
      .findByCategory('bank') || [];
    
    const cashBankIds = [...cashBankAccounts, ...bankAccounts].map(a => a.id);
    
    return accounts.data
      .filter((tx: any) => cashBankIds.includes(tx.account_id))
      .reduce((sum, tx) => sum + Number(tx.debit) - Number(tx.credit), 0);
  }

  async getLowStockCount(): Promise<number> {
    const items = await this.itemRepository.findAll();
    let lowCount = 0;

    for (const item of items.data) {
      const stock = await this.stockMovementRepository.calculateStock(item.id);
      if (stock <= item.reorder_level) {
        lowCount++;
      }
    }

    return lowCount;
  }

  async getPendingSyncCount(): Promise<number> {
    const { db } = await import('../../infrastructure/database/dexie');
    return await db.offline_queue.count();
  }

  async getDashboardStats(): Promise<{
    todaySales: number;
    cashBank: number;
    lowStockCount: number;
    pendingSync: number;
  }> {
    const [todaySales, cashBank, lowStockCount, pendingSync] = await Promise.all([
      this.getTodaySales(),
      this.getCashBankBalance(),
      this.getLowStockCount(),
      this.getPendingSyncCount()
    ]);

    return {
      todaySales,
      cashBank,
      lowStockCount,
      pendingSync
    };
  }

  async getLowStockItems(limit: number = 5): Promise<Item[]> {
    const items = await this.itemRepository.findAll();
    const lowStockItems: Item[] = [];

    for (const item of items.data) {
      const stock = await this.stockMovementRepository.calculateStock(item.id);
      if (stock <= item.reorder_level) {
        lowStockItems.push({ ...item, currentStock: stock });
      }
    }

    return lowStockItems.slice(0, limit);
  }
}