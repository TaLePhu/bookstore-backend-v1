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
import { OrderItem } from '@entities/OrderItem';
import { PromotionStatus } from '@entities/Promotion';
import { PromotionBook } from '@entities/PromotionBook';
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

  static getDetailCacheKeys(id: string): string[] {
    return [
      `book:detail:v2:${id}`,
      `book:detail:v2:${id}:with-deleted`,
      `book:detail:${id}`,
      `book:detail:${id}:with-deleted`,
    ];
  }

  private getDetailCacheKey(id: string, includeDeleted: boolean): string {
    return includeDeleted ? `book:detail:v2:${id}:with-deleted` : `book:detail:v2:${id}`;
  }

  private async clearDetailCache(id: string): Promise<void> {
    await redisConfig.del(...BookService.getDetailCacheKeys(id));
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

  private isPromotionEffective(promotion?: PromotionBook['promotion'] | null): boolean {
    if (!promotion) return false;

    const now = new Date();
    const startsAt = promotion.startsAt ? new Date(promotion.startsAt) : null;
    const endsAt = promotion.endsAt ? new Date(promotion.endsAt) : null;

    return (
      promotion.status === PromotionStatus.ACTIVE &&
      Number(promotion.discountPercent || 0) > 0 &&
      (!startsAt || startsAt <= now) &&
      (!endsAt || endsAt >= now)
    );
  }

  private async applyCurrentPromotionPrice(book: Book): Promise<Book> {
    const promotionItems = await AppDataSource.getRepository(PromotionBook).find({
      where: { bookId: book.id },
      relations: ['promotion'],
    });
    const effectivePromotion = promotionItems.find((item) => this.isPromotionEffective(item.promotion))?.promotion;
    const basePrice = Number(book.originalPrice || book.price || 0);

    book.originalPrice = basePrice;
    if (effectivePromotion) {
      const discountPercent = Number(effectivePromotion.discountPercent || 0);
      book.price = Math.round((basePrice * (100 - discountPercent)) / 100);
      book.discount = discountPercent;
    } else {
      book.price = basePrice;
      book.discount = 0;
    }

    return AppDataSource.getRepository(Book).save(book);
  }

  private parseImageIds(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value !== 'string') return [];

    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }

    return [];
  }

  async getAllBooks(options: BookListOptions): Promise<{ data: BookResponse[]; total: number; page: number; limit: number }> {
    const { page, limit, sort, categoryId, status, includeDeleted, onlyDeleted } = options;

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
      status,
      includeDeleted,
      onlyDeleted
    });
    return { data, total, page, limit };
  }

  async getBookById(id: string, includeDeleted = false): Promise<BookResponse> {
    const cacheKey = this.getDetailCacheKey(id, includeDeleted);

    // 1. Kiểm tra cache
    const cachedData = await redisConfig.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData) as BookResponse;
    }

    // 2. Nếu miss cache, gọi DB
    const book = await this.bookRepository.findById(id, includeDeleted);
    if (!book) {
      throw new NotFoundError('Sách này không được tìm thấy (Book not found)');
    }

    // 3. Set cache với TTL = 1 giờ
    await redisConfig.set(cacheKey, JSON.stringify(book), 'EX', 3600);

    return book;
  }

  async getRelatedBooks(id: string, limit: number = 5): Promise<{ data: BookResponse[]; total: number; page: number; limit: number }> {
    const book = await this.getBookById(id);
    const relatedMap = new Map<string, BookResponse>();

    if (book.categoryId) {
      const sameCategory = await this.bookRepository.findAllWithFilters({
        page: 1,
        limit: limit + 1,
        categoryId: book.categoryId,
      });

      sameCategory.data
        .filter((item) => item.id !== id)
        .forEach((item) => relatedMap.set(item.id, item));
    }

    if (relatedMap.size < limit) {
      const fallback = await this.bookRepository.findAllWithFilters({
        page: 1,
        limit: limit + 1,
        sort: 'bestseller',
      });

      fallback.data
        .filter((item) => item.id !== id)
        .forEach((item) => {
          if (relatedMap.size < limit) {
            relatedMap.set(item.id, item);
          }
        });
    }

    if (relatedMap.size < limit) {
      const fallback = await this.bookRepository.findAllWithFilters({
        page: 1,
        limit: limit + 1,
      });

      fallback.data
        .filter((item) => item.id !== id)
        .forEach((item) => {
          if (relatedMap.size < limit) {
            relatedMap.set(item.id, item);
          }
        });
    }

    const data = Array.from(relatedMap.values()).slice(0, limit);
    return { data, total: data.length, page: 1, limit };
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
    const originalPrice = Number(dto.originalPrice ?? dto.price ?? 0);
    bookData.originalPrice = originalPrice;
    bookData.price = originalPrice;
    bookData.discount = 0;
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

    const deleteImageIds = this.parseImageIds((dto as any).deleteImageIds);
    delete (dto as any).deleteImageIds;

    const { releaseDate, ...rest } = dto;
    const bookData: Partial<Book> = { ...rest };
    delete (bookData as any).price;
    delete (bookData as any).discount;
    if (dto.originalPrice !== undefined) {
      bookData.originalPrice = Number(dto.originalPrice);
    }
    if (releaseDate) {
      bookData.releaseDate = new Date(releaseDate);
    }

    if ((!files || files.length === 0) && deleteImageIds.length === 0) {
      const updatedBook = await this.bookRepository.update(id, bookData);

      if (!updatedBook) {
        throw new NotFoundError('Sách không tồn tại');
      }

      // Xóa cache detail sau khi update
      const pricedBook = await this.applyCurrentPromotionPrice(updatedBook);
      await this.clearDetailCache(id);

      await this.updateEmbeddingForBook(pricedBook, categoryName ?? await this.getCategoryName(pricedBook.categoryId));
      return pricedBook;
    }

    const uploadedImages = await uploadBookImages(files || []);
    const imagePayload = uploadedImages.map((img) => ({
      url: img.url,
      publicId: img.publicId,
      isPrimary: false,
    }));

    const selectedImageRows = deleteImageIds.length > 0
      ? await AppDataSource.getRepository(BookImage)
          .createQueryBuilder('image')
          .addSelect('image.publicId')
          .where('image.bookId = :bookId', { bookId: id })
          .andWhere('image.id IN (:...deleteImageIds)', { deleteImageIds })
          .getMany()
      : [];
    const selectedPublicIds = selectedImageRows
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

        if (deleteImageIds.length > 0) {
          await imageRepo
            .createQueryBuilder()
            .delete()
            .where('bookId = :bookId', { bookId: id })
            .andWhere('id IN (:...deleteImageIds)', { deleteImageIds })
            .execute();
        }

        const remainingCount = await imageRepo.count({ where: { bookId: id } });
        if (remainingCount === 0 && imagePayload.length === 0) {
          throw new ValidationError('Sách cần có ít nhất một ảnh.');
        }

        const hasPrimary = remainingCount > 0
          ? await imageRepo.count({ where: { bookId: id, isPrimary: true } }) > 0
          : false;

        const bookImages = imagePayload.map((img, index) =>
          imageRepo.create({
            bookId: savedBook.id,
            url: img.url,
            publicId: img.publicId || null,
            isPrimary: !hasPrimary && index === 0,
          })
        );

        if (bookImages.length > 0) {
          await imageRepo.save(bookImages);
        }

        const primaryCount = await imageRepo.count({ where: { bookId: id, isPrimary: true } });
        if (primaryCount === 0) {
          const firstImage = await imageRepo.findOne({
            where: { bookId: id },
            order: { createdAt: 'ASC' },
          });
          if (firstImage) {
            firstImage.isPrimary = true;
            await imageRepo.save(firstImage);
          }
        }

        return savedBook;
      });

      if (!updatedBook) {
        await deleteCloudinaryImages(uploadedImages.map((img) => img.publicId));
        throw new NotFoundError('Sách không tồn tại');
      }

      const pricedBook = await this.applyCurrentPromotionPrice(updatedBook);

      try {
        await deleteCloudinaryImages(selectedPublicIds);
      } catch (cleanupError) {
        console.warn('Không thể xóa ảnh Cloudinary sau khi cập nhật sách', cleanupError);
      }

      // Xóa cache detail sau khi update
      await this.clearDetailCache(id);

      await this.updateEmbeddingForBook(pricedBook, categoryName ?? await this.getCategoryName(pricedBook.categoryId));
      return pricedBook;
    } catch (error) {
      try {
        await deleteCloudinaryImages(uploadedImages.map((img) => img.publicId));
      } catch (cleanupError) {
        console.warn('Không thể dọn ảnh Cloudinary sau khi cập nhật thất bại', cleanupError);
      }
      throw error;
    }

  }

  async softDeleteBook(id: string): Promise<void> {
    const bookRepo = AppDataSource.getRepository(Book);
    const book = await bookRepo
      .createQueryBuilder('book')
      .withDeleted()
      .where('book.id = :id', { id })
      .getOne();

    if (!book) {
      throw new NotFoundError('SĂ¡ch khĂ´ng tá»“n táº¡i');
    }

    if (book.deletedAt) {
      throw new ValidationError('SĂ¡ch Ä‘Ă£ Ä‘Æ°á»£c xĂ³a má»m trá»›c Ä‘Ă³');
    }

    await bookRepo.softDelete({ id });
    await this.clearDetailCache(id);
  }

  async restoreBook(id: string): Promise<void> {
    const bookRepo = AppDataSource.getRepository(Book);
    const book = await bookRepo
      .createQueryBuilder('book')
      .withDeleted()
      .where('book.id = :id', { id })
      .getOne();

    if (!book) {
      throw new NotFoundError('SĂ¡ch khĂ´ng tá»“n táº¡i');
    }

    if (!book.deletedAt) {
      throw new ValidationError('SĂ¡ch chÆ°a bá»‹ xĂ³a má»m');
    }

    await bookRepo.restore({ id });
    await this.clearDetailCache(id);
  }

  async hardDeleteBook(id: string): Promise<void> {
    const bookRepo = AppDataSource.getRepository(Book);
    const orderItemRepo = AppDataSource.getRepository(OrderItem);
    const imageRepo = AppDataSource.getRepository(BookImage);

    const book = await bookRepo
      .createQueryBuilder('book')
      .withDeleted()
      .where('book.id = :id', { id })
      .getOne();
    if (!book) {
      throw new NotFoundError('Sách không tồn tại');
    }

    const orderItemCount = await orderItemRepo.count({ where: { bookId: id } });
    if (orderItemCount > 0) {
      throw new ValidationError('Không thể xóa sách đã phát sinh đơn hàng. Hãy đặt tồn kho về 0 nếu muốn ngừng bán.');
    }

    const imageRows = await imageRepo.find({
      where: { bookId: id },
      select: ['publicId'],
    });
    const publicIds = imageRows
      .map((row) => row.publicId)
      .filter((value): value is string => Boolean(value));

    await AppDataSource.transaction(async (manager) => {
      await manager.delete(BookImage, { bookId: id });
      await manager.delete(Book, { id });
    });

    await this.clearDetailCache(id);

    try {
      await deleteCloudinaryImages(publicIds);
    } catch (error) {
      console.warn('Không thể xóa ảnh Cloudinary sau khi xóa sách', error);
    }
  }
}

