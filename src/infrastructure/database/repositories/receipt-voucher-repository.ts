import { BaseRepository } from '../base-repository';
import { IReceiptVoucherRepository } from '../../../core/interfaces/repository';
import { ReceiptVoucher } from '../../../core/domain/entities';

export class ReceiptVoucherRepository extends BaseRepository<ReceiptVoucher> implements IReceiptVoucherRepository {
  constructor() {
    super('receipt_vouchers');
  }

  async findByCustomerId(customerId: string): Promise<ReceiptVoucher[]> {
    return await this.table.filter((voucher: ReceiptVoucher) => voucher.customer_id === customerId).toArray();
  }
}
