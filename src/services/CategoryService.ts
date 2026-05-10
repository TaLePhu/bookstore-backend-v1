import { injectable, inject } from 'tsyringe';
import { ICategoryRepository } from '@repositories/interfaces/ICategoryRepository';
import { TOKENS } from '@config/container';
import { Category } from '@entities/Category';

@injectable()
export class CategoryService {
  constructor(@inject(TOKENS.CATEGORY_REPOSITORY) private categoryRepository: ICategoryRepository) {}

  async getAllCategories(options?: { includeDeleted?: boolean; onlyDeleted?: boolean }): Promise<Category[]> {
    return this.categoryRepository.findAll(options);
  }

  async getCategoryById(id: string, includeDeleted = false): Promise<Category | null> {
    return this.categoryRepository.findById(id, includeDeleted);
  }

  async createCategory(data: Partial<Category>): Promise<Category> {
    return this.categoryRepository.create(data);
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category | null> {
    return this.categoryRepository.update(id, data);
  }

  async softDeleteCategory(id: string): Promise<boolean> {
    return this.categoryRepository.softDelete(id);
  }

  async restoreCategory(id: string): Promise<boolean> {
    return this.categoryRepository.restore(id);
  }

  async hardDeleteCategory(id: string): Promise<boolean> {
    return this.categoryRepository.hardDelete(id);
  }
}
