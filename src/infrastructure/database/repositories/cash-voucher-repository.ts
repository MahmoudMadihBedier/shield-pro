import { BaseRepository } from '../base-repository';
import { ICashVoucherRepository } from '../../../core/interfaces/repository';
import { CashVoucher } from '../../../core/domain/entities';

export class CashVoucherRepository extends BaseRepository<CashVoucher> implements ICashVoucherRepository {
  constructor() {
    super('cash_vouchers');
  }

  async findByWarehouseId(warehouseId: string | null): Promise<CashVoucher[]> {
    return await this.table.filter((v: CashVoucher) => (v.warehouse_id || null) === warehouseId).toArray();
  }

  async findByDateRange(startDate: string, endDate: string): Promise<CashVoucher[]> {
    return await this.table.filter((v: CashVoucher) => v.date >= startDate && v.date <= endDate).toArray();
  }
}
