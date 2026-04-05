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
}
