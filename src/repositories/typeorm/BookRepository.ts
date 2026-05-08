import { In, Repository } from 'typeorm';
import { Book } from '@entities/Book';
import { AppDataSource } from '@config/data-source';
import { IBookRepository, BookListOptions } from '@repositories/interfaces/IBookRepository';
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
        status: book.stock > 0 ? 'in_stock' : 'out_of_stock',
      } as BookResponse;
    });
  }

  async findAll(page: number, limit: number): Promise<{ data: BookResponse[]; total: number }> {
    return this.findAllWithFilters({ page, limit });
  }

  async findAllWithFilters(options: BookListOptions): Promise<{ data: BookResponse[]; total: number }> {
    const { page, limit, sort, categoryId, status } = options;

    if (sort === 'bestseller') {
      return this.findBestSellerBooksAllTime(page, limit, categoryId);
    }

    const skip = (page - 1) * limit;
    const qb = this.repository
      .createQueryBuilder('book')
      .leftJoinAndSelect('book.category', 'category');

    if (categoryId) {
      qb.andWhere('book.categoryId = :categoryId', { categoryId });
    }

    if (status === 'in_stock') {
      qb.andWhere('book.stock > 0');
    } else if (status === 'out_of_stock') {
      qb.andWhere('book.stock = 0');
    }

    if (sort === 'latest') {
      qb.orderBy('book.releaseDate', 'DESC', 'NULLS LAST').addOrderBy('book.createdAt', 'DESC');
    } else {
      qb.orderBy('book.createdAt', 'DESC');
    }

    const [books, total] = await qb.skip(skip).take(limit).getManyAndCount();
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

  async searchKeywordExtended(
    query: string,
    page: number,
    limit: number
  ): Promise<{ data: BookResponse[]; total: number }> {
    const skip = (page - 1) * limit;
    const qb = this.repository
      .createQueryBuilder('book')
      .leftJoinAndSelect('book.category', 'category')
      .where(
        `book.title ILIKE :query
        OR book.author ILIKE :query
        OR book.description ILIKE :query
        OR category.name ILIKE :query`,
        { query: `%${query}%` }
      )
      .orderBy('book.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [books, total] = await qb.getManyAndCount();
    const data = await this.mapBooksToResponse(books);

    return { data, total };
  }

  async searchKeywordIds(query: string, limit: number): Promise<string[]> {
    const rows = await this.repository
      .createQueryBuilder('book')
      .leftJoin('book.category', 'category')
      .select('book.id', 'id')
      .where(
        `book.title ILIKE :query
        OR book.author ILIKE :query
        OR book.description ILIKE :query
        OR category.name ILIKE :query`,
        { query: `%${query}%` }
      )
      .orderBy('book.createdAt', 'DESC')
      .limit(limit)
      .getRawMany<{ id: string }>();

    return rows.map((row) => row.id);
  }

  async findByIdsPreserveOrder(ids: string[]): Promise<BookResponse[]> {
    if (ids.length === 0) return [];

    const books = await this.repository.find({
      where: { id: In(ids) },
      relations: ['category'],
    });

    const orderMap = new Map(ids.map((id, index) => [id, index]));
    const sortedBooks = books.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    return this.mapBooksToResponse(sortedBooks);
  }

  private async findBestSellerBooksAllTime(page: number, limit: number, categoryId?: string): Promise<{ data: BookResponse[]; total: number }> {
    const skip = (page - 1) * limit;
    const baseQb = this.repository
      .createQueryBuilder('book')
      .innerJoin('book.orderItems', 'orderItem')
      .innerJoin('orderItem.order', 'order')
      .select('book.id', 'bookId')
      .addSelect('SUM(orderItem.quantity)', 'totalSold')
      .where('order.status = :completedStatus', { completedStatus: OrderStatus.COMPLETED });

    if (categoryId) {
      baseQb.andWhere('book.categoryId = :categoryId', { categoryId });
    }

    baseQb.groupBy('book.id')
      .orderBy('SUM(orderItem.quantity)', 'DESC')
      .addOrderBy('MAX(order.createdAt)', 'DESC');

    const totalRows = await baseQb.clone().getRawMany<{ bookId: string }>();
    const total = totalRows.length;

    if (total === 0) {
      return { data: [], total };
    }

    const pageRows = await baseQb.clone().skip(skip).take(limit).getRawMany<{ bookId: string }>();
    const sortedBookIds = pageRows.map((row) => row.bookId);

    if (sortedBookIds.length === 0) {
      return { data: [], total };
    }

    const books = await this.repository.find({
      where: { id: In(sortedBookIds) },
      relations: ['category'],
    });

    const orderMap = new Map(sortedBookIds.map((id, index) => [id, index]));
    const sortedBooks = books.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    const data = await this.mapBooksToResponse(sortedBooks);

    return { data, total };
  }

  async create(
    book: Partial<Book>,
    images: { url: string; publicId?: string | null; isPrimary?: boolean }[]
  ): Promise<Book> {
    const newBook = this.repository.create(book);
    const savedBook = await this.repository.save(newBook);

    if (images && images.length > 0) {
      const bookImageRepo = AppDataSource.getRepository('BookImage');
      const bookImages = images.map((img) =>
        bookImageRepo.create({
          bookId: savedBook.id,
          url: img.url,
          publicId: img.publicId || null,
          isPrimary: img.isPrimary || false,
        })
      );
      await bookImageRepo.save(bookImages);
    }

    return savedBook;
  }

  async update(
    id: string,
    bookData: Partial<Book>,
    images?: { url: string; publicId?: string | null; isPrimary?: boolean }[]
  ): Promise<Book | null> {
    const existingBook = await this.repository.findOne({ where: { id } });
    if (!existingBook) return null;

    this.repository.merge(existingBook, bookData);
    const updatedBook = await this.repository.save(existingBook);

    if (images) {
      const bookImageRepo = AppDataSource.getRepository('BookImage');
      // Xoá ảnh cũ
      await bookImageRepo.delete({ bookId: id });
      // Thêm ảnh mới
      if (images.length > 0) {
        const bookImages = images.map((img) =>
          bookImageRepo.create({
            bookId: updatedBook.id,
            url: img.url,
            publicId: img.publicId || null,
            isPrimary: img.isPrimary || false,
          })
        );
        await bookImageRepo.save(bookImages);
      }
    }

    return updatedBook;
  }
}

