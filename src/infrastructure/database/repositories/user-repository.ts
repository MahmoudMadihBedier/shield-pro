import { BaseRepository } from '../base-repository';
import { IUserRepository } from '../../../core/interfaces/repository';
import { User } from '../../../core/domain/entities';

export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor() {
    super('users');
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return await this.table.filter((user: User) => user.email === email).first();
  }

  async findByRoleId(roleId: string): Promise<User[]> {
    return await this.table.filter((user: User) => user.role_id === roleId).toArray();
  }
}
