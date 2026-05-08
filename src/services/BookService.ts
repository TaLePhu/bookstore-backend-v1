import { injectable, inject } from 'tsyringe';
import { IBookRepository, BookListOptions } from '@repositories/interfaces/IBookRepository';
import { ICategoryRepository } from '@repositories/interfaces/ICategoryRepository';
import { TOKENS } from '@config/container';
import { NotFoundError, ValidationError } from '@utils/errors';
import { BookResponse } from '@dtos/book/BookResponseDto';
import redisConfig from '@config/redis';
import { CreateBookDto } from '@dtos/book/CreateBookDto';
import { UpdateBookDto } from '@dtos/book/UpdateBookDto';
import { Book } from '@entities/Book';
import { BookImage } from '@entities/BookImage';
import { AppDataSource } from '@config/data-source';
import { uploadBookImages, deleteCloudinaryImages } from '@utils/cloudinary';
import { EmbeddingSearchService } from '@services/EmbeddingSearchService';
import { EmbeddingProviderService } from '@services/EmbeddingProviderService';

@injectable()
export class BookService {
  constructor(
    @inject(TOKENS.BOOK_REPOSITORY) private bookRepository: IBookRepository,
    @inject(TOKENS.CATEGORY_REPOSITORY) private categoryRepository: ICategoryRepository,
    private embeddingSearchService: EmbeddingSearchService,
    private embeddingProviderService: EmbeddingProviderService
  ) {}

  private async getCategoryName(categoryId?: string): Promise<string | null> {
    if (!categoryId) return null;
    const category = await this.categoryRepository.findById(categoryId);
    return category?.name ?? null;
  }

  private async updateEmbeddingForBook(book: Book, categoryName?: string | null): Promise<void> {
    try {
      const embeddingText = this.embeddingProviderService.buildBookEmbeddingText({
        title: book.title,
        author: book.author,
        description: book.description,
        categoryName: categoryName ?? undefined,
      });
      const vector = await this.embeddingProviderService.embedText(embeddingText);
      await this.embeddingSearchService.storeEmbedding(book.id, vector);
    } catch (error) {
      console.warn('Update book embedding failed:', error);
    }
  }

  async getAllBooks(options: BookListOptions): Promise<{ data: BookResponse[]; total: number; page: number; limit: number }> {
    const { page, limit, sort, categoryId, status } = options;

    if (categoryId) {
      const category = await this.categoryRepository.findById(categoryId);
      if (!category) {
        throw new NotFoundError('Danh mục không tồn tại (Category not found)');
      }
    }

    const { data, total } = await this.bookRepository.findAllWithFilters({
      page,
      limit,
      sort,
      categoryId,
      status
    });
    return { data, total, page, limit };
  }

  async getBookById(id: string): Promise<BookResponse> {
    const cacheKey = `book:detail:${id}`;

    // 1. Kiểm tra cache
    const cachedData = await redisConfig.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData) as BookResponse;
    }

    // 2. Nếu miss cache, gọi DB
    const book = await this.bookRepository.findById(id);
    if (!book) {
      throw new NotFoundError('Sách này không được tìm thấy (Book not found)');
    }

    // 3. Set cache với TTL = 1 giờ
    await redisConfig.set(cacheKey, JSON.stringify(book), 'EX', 3600);

    return book;
  }

  async searchBooks(query: string, page: number = 1, limit: number = 10): Promise<{ data: BookResponse[]; total: number; page: number; limit: number }> {
    if (!query || query.trim() === '') {
      return { data: [], total: 0, page, limit };
    }
    const { data, total } = await this.bookRepository.search(query, page, limit);
    return { data, total, page, limit };
  }

  async semanticSearchBooks(
    query: string,
    page: number = 1,
    limit: number = 10,
    similarityThreshold: number = 0.5
  ): Promise<{ data: BookResponse[]; total: number; page: number; limit: number }> {
    if (!query || query.trim() === '') {
      return { data: [], total: 0, page, limit };
    }

    const normalizedQuery = query.trim();
    const offset = (page - 1) * limit;

    try {
      const queryText = this.embeddingProviderService.buildQueryText(normalizedQuery);
      const vector = await this.embeddingProviderService.embedText(queryText);
      const { items, total } = await this.embeddingSearchService.searchSimilarPaged(
        vector,
        offset,
        limit,
        similarityThreshold
      );

      if (items.length === 0) {
        return { data: [], total, page, limit };
      }

      const keywordIds = await this.bookRepository.searchKeywordIds(normalizedQuery, 50);
      const keywordSet = new Set(keywordIds);

      const rankedIds = items
        .map((item) => ({
          bookId: item.bookId,
          score: item.similarity + (keywordSet.has(item.bookId) ? 0.05 : 0),
        }))
        .sort((a, b) => b.score - a.score)
        .map((item) => item.bookId);

      const data = await this.bookRepository.findByIdsPreserveOrder(rankedIds);
      return { data, total, page, limit };
    } catch (error) {
      console.warn('Semantic search failed, fallback to keyword search:', error);
      const { data, total } = await this.bookRepository.searchKeywordExtended(normalizedQuery, page, limit);
      return { data, total, page, limit };
    }
  }

  async createBook(dto: CreateBookDto, files: Express.Multer.File[]): Promise<any> {
    let categoryName: string | null = null;
    if (dto.categoryId) {
      const category = await this.categoryRepository.findById(dto.categoryId);
      if (!category) {
        throw new NotFoundError('Danh mục không tồn tại');
      }
      categoryName = category.name;
    }

    if (!files || files.length === 0) {
      throw new ValidationError('Hình ảnh sách không được để trống');
    }

    const { releaseDate, ...rest } = dto;
    const bookData: Partial<Book> = { ...rest };
    if (releaseDate) {
      bookData.releaseDate = new Date(releaseDate);
    }

    const uploadedImages = await uploadBookImages(files);
    const imagePayload = uploadedImages.map((img, index) => ({
      url: img.url,
      publicId: img.publicId,
      isPrimary: index === 0,
    }));

    try {
      const savedBook = await AppDataSource.transaction(async (manager) => {
        const bookRepo = manager.getRepository(Book);
        const imageRepo = manager.getRepository(BookImage);

        const newBook = bookRepo.create(bookData);
        const savedBook = await bookRepo.save(newBook);

        const bookImages = imagePayload.map((img) =>
          imageRepo.create({
            bookId: savedBook.id,
            url: img.url,
            publicId: img.publicId || null,
            isPrimary: img.isPrimary || false,
          })
        );

        await imageRepo.save(bookImages);

        return savedBook;
      });
      await this.updateEmbeddingForBook(savedBook, categoryName);
      return savedBook;
    } catch (error) {
      try {
        await deleteCloudinaryImages(uploadedImages.map((img) => img.publicId));
      } catch (cleanupError) {
        console.warn('Không thể dọn ảnh Cloudinary sau khi tạo sách thất bại', cleanupError);
      }
      throw error;
    }
  }

  async updateBook(id: string, dto: UpdateBookDto, files?: Express.Multer.File[]): Promise<any> {
    let categoryName: string | null = null;
    if (dto.categoryId) {
      const category = await this.categoryRepository.findById(dto.categoryId);
      if (!category) {
        throw new NotFoundError('Danh mục không tồn tại');
      }
      categoryName = category.name;
    }

    const { releaseDate, ...rest } = dto;
    const bookData: Partial<Book> = { ...rest };
    if (releaseDate) {
      bookData.releaseDate = new Date(releaseDate);
    }

    if (!files || files.length === 0) {
      const updatedBook = await this.bookRepository.update(id, bookData);

      if (!updatedBook) {
        throw new NotFoundError('Sách không tồn tại');
      }

      // Xóa cache detail sau khi update
      await redisConfig.del(`book:detail:${id}`);

      await this.updateEmbeddingForBook(updatedBook, categoryName ?? await this.getCategoryName(updatedBook.categoryId));
      return updatedBook;
    }

    const uploadedImages = await uploadBookImages(files);
    const imagePayload = uploadedImages.map((img, index) => ({
      url: img.url,
      publicId: img.publicId,
      isPrimary: index === 0,
    }));

    const existingImageRows = await AppDataSource.getRepository(BookImage).find({
      where: { bookId: id },
      select: ['publicId'],
    });
    const oldPublicIds = existingImageRows
      .map((row) => row.publicId)
      .filter((value): value is string => Boolean(value));

    try {
      const updatedBook = await AppDataSource.transaction(async (manager) => {
        const bookRepo = manager.getRepository(Book);
        const imageRepo = manager.getRepository(BookImage);

        const existingBook = await bookRepo.findOne({ where: { id } });
        if (!existingBook) return null;

        bookRepo.merge(existingBook, bookData);
        const savedBook = await bookRepo.save(existingBook);

        await imageRepo.delete({ bookId: id });

        const bookImages = imagePayload.map((img) =>
          imageRepo.create({
            bookId: savedBook.id,
            url: img.url,
            publicId: img.publicId || null,
            isPrimary: img.isPrimary || false,
          })
        );

        await imageRepo.save(bookImages);

        return savedBook;
      });

      if (!updatedBook) {
        await deleteCloudinaryImages(uploadedImages.map((img) => img.publicId));
        throw new NotFoundError('Sách không tồn tại');
      }

      try {
        await deleteCloudinaryImages(oldPublicIds);
      } catch (cleanupError) {
        console.warn('Không thể xóa ảnh Cloudinary cũ sau khi cập nhật sách', cleanupError);
      }

      // Xóa cache detail sau khi update
      await redisConfig.del(`book:detail:${id}`);

      await this.updateEmbeddingForBook(updatedBook, categoryName ?? await this.getCategoryName(updatedBook.categoryId));
      return updatedBook;
    } catch (error) {
      try {
        await deleteCloudinaryImages(uploadedImages.map((img) => img.publicId));
      } catch (cleanupError) {
        console.warn('Không thể dọn ảnh Cloudinary sau khi cập nhật thất bại', cleanupError);
      }
      throw error;
    }

  }
}

