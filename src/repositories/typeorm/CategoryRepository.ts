import { Repository } from 'typeorm';
import { Category } from '@entities/Category';
import { AppDataSource } from '@config/data-source';
import { ICategoryRepository } from '@repositories/interfaces/ICategoryRepository';

export class CategoryRepository implements ICategoryRepository {
  private repository: Repository<Category>;

  constructor() {
    this.repository = AppDataSource.getRepository(Category);
  }

  async findAll(options: { includeDeleted?: boolean; onlyDeleted?: boolean } = {}): Promise<Category[]> {
    const qb = this.repository.createQueryBuilder('category');

    if (options.includeDeleted || options.onlyDeleted) {
      qb.withDeleted();
    }

    if (options.onlyDeleted) {
      qb.where('category.deletedAt IS NOT NULL');
    }

    return qb.orderBy('category.createdAt', 'ASC').getMany();
  }

  async findById(id: string, includeDeleted = false): Promise<Category | null> {
    const qb = this.repository
      .createQueryBuilder('category')
      .where('category.id = :id', { id });

    if (includeDeleted) {
      qb.withDeleted();
    }

    return qb.getOne();
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

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.softDelete({ id });
    return result.affected ? result.affected > 0 : false;
  }

  async restore(id: string): Promise<boolean> {
    const result = await this.repository.restore({ id });
    return result.affected ? result.affected > 0 : false;
  }

  async hardDelete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return result.affected ? result.affected > 0 : false;
  }
}
