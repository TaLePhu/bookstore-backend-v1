import { Repository } from 'typeorm';
import { Book } from '@entities/Book';
import { AppDataSource } from '@config/data-source';
import { IBookRepository } from '@repositories/interfaces/IBookRepository';

export class BookRepository implements IBookRepository {
  private repository: Repository<Book>;

  constructor() {
    this.repository = AppDataSource.getRepository(Book);
  }

  async findAll(page: number, limit: number): Promise<{ data: Book[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.repository.findAndCount({
      skip,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
      relations: ['category'] // Optionally include categories and images if needed
    });

    return { data, total };
  }

  async findById(id: string): Promise<Book | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['category', 'images', 'reviews', 'reviews.user']
    });
  }

  async search(query: string, page: number, limit: number): Promise<{ data: Book[]; total: number }> {
    const skip = (page - 1) * limit;
    
    // Sử dụng QueryBuilder cho tìm kiếm tương đối trên cả title và author
    const qb = this.repository.createQueryBuilder('book')
      .leftJoinAndSelect('book.category', 'category')
      .where('book.title ILIKE :query OR book.author ILIKE :query', { query: `%${query}%` })
      .orderBy('book.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total };
  }
}
