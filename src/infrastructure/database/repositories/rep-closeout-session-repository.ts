import { BaseRepository } from '../base-repository';
import { IRepCloseoutSessionRepository } from '../../../core/interfaces/repository';
import { RepCloseoutSession } from '../../../core/domain/entities';

export class RepCloseoutSessionRepository extends BaseRepository<RepCloseoutSession> implements IRepCloseoutSessionRepository {
  constructor() {
    super('rep_closeout_sessions');
  }

  async findByRepId(repUserId: string): Promise<RepCloseoutSession[]> {
    return await this.table.filter((r: RepCloseoutSession) => r.rep_user_id === repUserId).toArray();
  }

  async findOpenSession(repUserId: string, date: string): Promise<RepCloseoutSession | undefined> {
    return await this.table
      .filter((r: RepCloseoutSession) => r.rep_user_id === repUserId && r.session_date === date && r.status === 'open')
      .first();
  }
}
