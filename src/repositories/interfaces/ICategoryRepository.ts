import { Category } from '@entities/Category';

export interface ICategoryRepository {
  findAll(): Promise<Category[]>;
}
