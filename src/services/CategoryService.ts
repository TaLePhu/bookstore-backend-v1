import { injectable, inject } from 'tsyringe';
import { ICategoryRepository } from '@repositories/interfaces/ICategoryRepository';
import { TOKENS } from '@config/container';
import { Category } from '@entities/Category';

@injectable()
export class CategoryService {
  constructor(@inject(TOKENS.CATEGORY_REPOSITORY) private categoryRepository: ICategoryRepository) {}

  async getAllCategories(): Promise<Category[]> {
    return this.categoryRepository.findAll();
  }

  async getCategoryById(id: string): Promise<Category | null> {
    return this.categoryRepository.findById(id);
  }

  async createCategory(data: Partial<Category>): Promise<Category> {
    return this.categoryRepository.create(data);
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category | null> {
    return this.categoryRepository.update(id, data);
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.categoryRepository.delete(id);
  }
}
