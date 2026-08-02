import { BaseRepository } from '../base-repository';
import { IUnitConversionRepository } from '../../../core/interfaces/repository';
import { UnitConversion } from '../../../core/domain/entities';

export class UnitConversionRepository extends BaseRepository<UnitConversion> implements IUnitConversionRepository {
  constructor() {
    super('unit_conversions');
  }

  async findByFromUnit(fromUnitId: string): Promise<UnitConversion[]> {
    return await this.table.filter((uc: UnitConversion) => uc.from_unit_id === fromUnitId).toArray();
  }
}
