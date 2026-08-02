import { BaseRepository } from '../base-repository';
import { IUserLocationRepository } from '../../../core/interfaces/repository';
import { UserLocation } from '../../../core/domain/entities';

export class UserLocationRepository extends BaseRepository<UserLocation> implements IUserLocationRepository {
  constructor() {
    super('user_locations');
  }

  async findByUserId(userId: string): Promise<UserLocation[]> {
    return await this.table.filter((loc: UserLocation) => loc.user_id === userId).toArray();
  }

  async findByDateRange(startDate: string, endDate: string): Promise<UserLocation[]> {
    return await this.table
      .filter((loc: UserLocation) => loc.recorded_at >= startDate && loc.recorded_at <= endDate)
      .toArray();
  }
}
