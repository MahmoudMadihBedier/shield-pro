import { PaginationParams, PaginatedResult } from '../../core/types';

export class PaginationHelper {
  static createPaginationParams(page: number = 1, limit: number = 50, sortBy?: string, sortOrder?: 'asc' | 'desc'): PaginationParams {
    return {
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)), // Cap at 100 items per page
      sortBy,
      sortOrder
    };
  }

  static createEmptyResult<T>(params: PaginationParams): PaginatedResult<T> {
    return {
      data: [],
      total: 0,
      page: params.page,
      limit: params.limit,
      totalPages: 0
    };
  }

  static calculateTotalPages(total: number, limit: number): number {
    return Math.ceil(total / limit);
  }

  static calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  static hasNextPage(currentPage: number, totalPages: number): boolean {
    return currentPage < totalPages;
  }

  static hasPreviousPage(currentPage: number): boolean {
    return currentPage > 1;
  }
}