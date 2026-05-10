import { Category } from '@entities/Category';

export interface ICategoryRepository {
  findAll(options?: { includeDeleted?: boolean; onlyDeleted?: boolean }): Promise<Category[]>;
  findById(id: string, includeDeleted?: boolean): Promise<Category | null>;
  create(category: Partial<Category>): Promise<Category>;
  update(id: string, category: Partial<Category>): Promise<Category | null>;
  softDelete(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<boolean>;
}
