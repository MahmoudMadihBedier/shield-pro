import type { IRepository, PaginationParams, PaginatedResult, EntityFilter } from '../../core/interfaces/repository';
import type { BaseEntity } from '../../core/domain/entities';
import { db } from './dexie';

export abstract class BaseRepository<T extends BaseEntity> implements IRepository<T> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  protected get table(): any {
    return (db as any)[this.tableName];
  }

  async findById(id: string): Promise<T | undefined> {
    return await this.table.get(id);
  }

  async findAll(filter?: EntityFilter, params?: PaginationParams): Promise<PaginatedResult<T>> {
    let query = this.table.toCollection();

    // Apply filters
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        query = query.filter((item: any) => item[key] === value);
      }
    }

    // Get total count
    const total = await query.count();

    // Apply pagination
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const offset = (page - 1) * limit;

    // Apply sorting
    if (params?.sortBy) {
      const sortOrder = params.sortOrder || 'asc';
      const sortBy = params.sortBy;
      const sortedQuery = query.toArray().then((items: T[]) => {
        return items.sort((a: any, b: any) => {
          const aVal = a[sortBy];
          const bVal = b[sortBy];
          if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : -1;
          } else {
            return aVal < bVal ? 1 : -1;
          }
        });
      });
      const data = await sortedQuery;
      const paginatedData = data.slice(offset, offset + limit);
      
      return {
        data: paginatedData,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    const data = await query.offset(offset).limit(limit).toArray();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async create(entity: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Generate client_id locally for customers table
    let additionalFields: any = {};
    if (this.tableName === 'customers' && !(entity as any).client_id) {
      additionalFields.client_id = this.generateClientId();
    }
    
    const newEntity = {
      ...entity,
      ...additionalFields,
      id,
      created_at: now,
      updated_at: now
    } as T;

    await this.table.put(newEntity);
    return newEntity;
  }

  private generateClientId(): string {
    // Generate client ID in the same format as the database trigger: CLI-XXXXXXXX
    // Using crypto.getRandomValues for better randomness similar to gen_random_bytes
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const hexPart = Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
      .substring(0, 8);
    return `CLI-${hexPart}`;
  }

  async update(id: string, entity: Partial<T>): Promise<T> {
    const existing = await this.table.get(id);
    if (!existing) {
      throw new Error(`Entity with id ${id} not found`);
    }

    const updatedEntity = {
      ...existing,
      ...entity,
      updated_at: new Date().toISOString()
    } as T;

    await this.table.put(updatedEntity);
    return updatedEntity;
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  async count(filter?: EntityFilter): Promise<number> {
    let query = this.table.toCollection();

    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        query = query.filter((item: any) => item[key] === value);
      }
    }

    return await query.count();
  }
}