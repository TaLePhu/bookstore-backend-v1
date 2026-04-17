import { Repository } from 'typeorm';
import { Category } from '@entities/Category';
import { AppDataSource } from '@config/data-source';
import { ICategoryRepository } from '@repositories/interfaces/ICategoryRepository';

export class CategoryRepository implements ICategoryRepository {
  private repository: Repository<Category>;

  constructor() {
    this.repository = AppDataSource.getRepository(Category);
  }

  async findAll(): Promise<Category[]> {
    return this.repository.find({
      order: {
        createdAt: 'ASC', // Order categories chronologically or by name (e.g. name: 'ASC')
      },
    });
  }

  async findById(id: string): Promise<Category | null> {
    return this.repository.findOne({ where: { id } });
  }
}
