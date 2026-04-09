import { Repository } from 'typeorm';
import { Book } from '@entities/Book';
import { AppDataSource } from '@config/data-source';
import { IBookRepository } from '@repositories/interfaces/IBookRepository';
import { BookResponse } from '@dtos/book/BookResponseDto';

export class BookRepository implements IBookRepository {
  private repository: Repository<Book>;

  constructor() {
    this.repository = AppDataSource.getRepository(Book);
  }

  async findAll(page: number, limit: number): Promise<{ data: BookResponse[]; total: number }> {
    const skip = (page - 1) * limit;
    
    const [books, total] = await this.repository.findAndCount({
      skip,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
      relations: ['category']
    });

    if (books.length === 0) return { data: [], total };

    const bookIds = books.map(b => b.id);
    const stats = await this.repository.createQueryBuilder('book')
      .leftJoin('book.reviews', 'reviews')
      .select('book.id', 'id')
      .addSelect('COUNT(reviews.id)', 'totalReviews')
      .addSelect('COALESCE(AVG(reviews.rating), 0)', 'rating')
      .where('book.id IN (:...bookIds)', { bookIds })
      .groupBy('book.id')
      .getRawMany();

    const data = books.map(book => {
      const stat = stats.find(s => s.id === book.id);
      return {
        ...book,
        totalReviews: Number(stat?.totalReviews || 0),
        rating: Number(Number(stat?.rating || 0).toFixed(1))
      } as BookResponse;
    });

    return { data, total };
  }

  async findById(id: string): Promise<BookResponse | null> {
    const book = await this.repository.findOne({
      where: { id },
      relations: ['category', 'images', 'reviews', 'reviews.user']
    });

    if (!book) return null;

    const totalReviews = book.reviews ? book.reviews.length : 0;
    const rating = totalReviews > 0
      ? Number((book.reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
      : 0;

    return {
      ...book,
      totalReviews,
      rating
    } as BookResponse;
  }

  async search(query: string, page: number, limit: number): Promise<{ data: BookResponse[]; total: number }> {
    const skip = (page - 1) * limit;
    
    // Sử dụng QueryBuilder cho tìm kiếm tương đối trên cả title và author
    const qb = this.repository.createQueryBuilder('book')
      .leftJoinAndSelect('book.category', 'category')
      .where('book.title ILIKE :query OR book.author ILIKE :query', { query: `%${query}%` })
      .orderBy('book.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [books, total] = await qb.getManyAndCount();

    if (books.length === 0) return { data: [], total };

    const bookIds = books.map(b => b.id);
    const stats = await this.repository.createQueryBuilder('book')
      .leftJoin('book.reviews', 'reviews')
      .select('book.id', 'id')
      .addSelect('COUNT(reviews.id)', 'totalReviews')
      .addSelect('COALESCE(AVG(reviews.rating), 0)', 'rating')
      .where('book.id IN (:...bookIds)', { bookIds })
      .groupBy('book.id')
      .getRawMany();

    const data = books.map(book => {
      const stat = stats.find(s => s.id === book.id);
      return {
        ...book,
        totalReviews: Number(stat?.totalReviews || 0),
        rating: Number(Number(stat?.rating || 0).toFixed(1))
      } as BookResponse;
    });

    return { data, total };
  }
}

