import { In, Repository } from 'typeorm';
import { Book } from '@entities/Book';
import { AppDataSource } from '@config/data-source';
import { IBookRepository } from '@repositories/interfaces/IBookRepository';
import { BookResponse } from '@dtos/book/BookResponseDto';
import { OrderStatus } from '@entities/Order';

export class BookRepository implements IBookRepository {
  private repository: Repository<Book>;

  constructor() {
    this.repository = AppDataSource.getRepository(Book);
  }

  private async mapBooksToResponse(books: Book[]): Promise<BookResponse[]> {
    if (books.length === 0) return [];

    const bookIds = books.map((book) => book.id);
    const stats = await this.repository
      .createQueryBuilder('book')
      .leftJoin('book.reviews', 'reviews')
      .select('book.id', 'id')
      .addSelect('COUNT(reviews.id)', 'totalReviews')
      .addSelect('COALESCE(AVG(reviews.rating), 0)', 'rating')
      .where('book.id IN (:...bookIds)', { bookIds })
      .groupBy('book.id')
      .getRawMany();

    return books.map((book) => {
      const stat = stats.find((item) => item.id === book.id);
      return {
        ...book,
        totalReviews: Number(stat?.totalReviews || 0),
        rating: Number(Number(stat?.rating || 0).toFixed(1)),
      } as BookResponse;
    });
  }

  private getCurrentMonthRangeUtc7(now: Date = new Date()): { startUtc: Date; endUtc: Date } {
    const msPerHour = 60 * 60 * 1000;
    const utc7OffsetHours = 7;

    const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const utc7Ms = utcMs + utc7OffsetHours * msPerHour;
    const utc7Date = new Date(utc7Ms);

    const year = utc7Date.getUTCFullYear();
    const month = utc7Date.getUTCMonth();

    const monthStartUtc7 = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const nextMonthStartUtc7 = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

    return {
      startUtc: new Date(monthStartUtc7.getTime() - utc7OffsetHours * msPerHour),
      endUtc: new Date(nextMonthStartUtc7.getTime() - utc7OffsetHours * msPerHour),
    };
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

    const data = await this.mapBooksToResponse(books);

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

    const data = await this.mapBooksToResponse(books);

    return { data, total };
  }

  async findLatestBooksTop10(): Promise<BookResponse[]> {
    const books = await this.repository
      .createQueryBuilder('book')
      .leftJoinAndSelect('book.category', 'category')
      .orderBy('book.releaseDate', 'DESC', 'NULLS LAST')
      .addOrderBy('book.createdAt', 'DESC')
      .take(10)
      .getMany();

    return this.mapBooksToResponse(books);
  }

  async findBooksByCategoryTop10(categoryId: string): Promise<BookResponse[]> {
    const books = await this.repository
      .createQueryBuilder('book')
      .leftJoinAndSelect('book.category', 'category')
      .where('book.categoryId = :categoryId', { categoryId })
      .orderBy('book.releaseDate', 'DESC', 'NULLS LAST')
      .addOrderBy('book.createdAt', 'DESC')
      .take(10)
      .getMany();

    return this.mapBooksToResponse(books);
  }

  async findBestSellerBooksCurrentMonthTop10(): Promise<BookResponse[]> {
    const { startUtc, endUtc } = this.getCurrentMonthRangeUtc7();

    const topRawRows = await this.repository
      .createQueryBuilder('book')
      .innerJoin('book.orderItems', 'orderItem')
      .innerJoin('orderItem.order', 'order')
      .select('book.id', 'bookId')
      .addSelect('SUM(orderItem.quantity)', 'totalSold')
      .where('order.status = :completedStatus', { completedStatus: OrderStatus.COMPLETED })
      .andWhere('order.createdAt >= :startUtc', { startUtc })
      .andWhere('order.createdAt < :endUtc', { endUtc })
      .groupBy('book.id')
      .orderBy('SUM(orderItem.quantity)', 'DESC')
      .addOrderBy('MAX(order.createdAt)', 'DESC')
      .limit(10)
      .getRawMany<{ bookId: string; totalSold: string }>();

    const sortedBookIds = topRawRows.map((row) => row.bookId);
    if (sortedBookIds.length === 0) {
      return [];
    }

    const books = await this.repository.find({
      where: { id: In(sortedBookIds) },
      relations: ['category'],
    });

    const orderMap = new Map(sortedBookIds.map((id, index) => [id, index]));
    const sortedBooks = books.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    return this.mapBooksToResponse(sortedBooks);
  }
}

