import { BaseRepository } from '../base-repository';
import { IPaymentVoucherRepository } from '../../../core/interfaces/repository';
import { PaymentVoucher } from '../../../core/domain/entities';

export class PaymentVoucherRepository extends BaseRepository<PaymentVoucher> implements IPaymentVoucherRepository {
  constructor() {
    super('payment_vouchers');
  }

  async findBySupplierId(supplierId: string): Promise<PaymentVoucher[]> {
    return await this.table.filter((voucher: PaymentVoucher) => voucher.supplier_id === supplierId).toArray();
  }
}
