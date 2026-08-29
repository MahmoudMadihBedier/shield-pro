import { BaseRepository } from '../base-repository';
import { IFraudFlagRepository } from '../../../core/interfaces/repository';
import { FraudFlag } from '../../../core/domain/entities';

export class FraudFlagRepository extends BaseRepository<FraudFlag> implements IFraudFlagRepository {
  constructor() {
    super('fraud_flags');
  }

  async findByStatus(status: string): Promise<FraudFlag[]> {
    return await this.table.filter((f: FraudFlag) => f.status === status).toArray();
  }
}
