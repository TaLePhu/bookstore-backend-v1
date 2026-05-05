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

  async create(category: Partial<Category>): Promise<Category> {
    const newCategory = this.repository.create(category);
    return this.repository.save(newCategory);
  }

  async update(id: string, category: Partial<Category>): Promise<Category | null> {
    const existingCategory = await this.findById(id);
    if (!existingCategory) return null;

    this.repository.merge(existingCategory, category);
    return this.repository.save(existingCategory);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return result.affected ? result.affected > 0 : false;
  }
}
