import { injectable } from 'tsyringe';
import { In } from 'typeorm';
import { AppDataSource } from '@config/data-source';
import { Book } from '@entities/Book';
import { Promotion, PromotionStatus } from '@entities/Promotion';
import { PromotionBook } from '@entities/PromotionBook';
import { CreatePromotionDto } from '@dtos/admin/CreatePromotionDto';
import { UpdatePromotionDto } from '@dtos/admin/UpdatePromotionDto';
import { NotFoundError, ValidationError } from '@utils/errors';
import { deleteCloudinaryImages, uploadImage } from '@utils/cloudinary';

@injectable()
export class AdminPromotionService {
  private promotionRepo = AppDataSource.getRepository(Promotion);
  private promotionBookRepo = AppDataSource.getRepository(PromotionBook);
  private bookRepo = AppDataSource.getRepository(Book);

  private getFallbackImageUrl(bookId: string): string {
    const fallbackImageUrls = [
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800',
      'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=800',
      'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?q=80&w=800',
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=800',
    ];
    const hash = bookId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return fallbackImageUrls[hash % fallbackImageUrls.length];
  }

  private mapPromotion(promotion: Promotion) {
    const books = (promotion.promotionBooks || []).filter((item) => item.book).map((item) => {
      const images = (item.book.images || []).filter(Boolean).sort((left, right) => {
        if (left.isPrimary === right.isPrimary) return 0;
        return left.isPrimary ? -1 : 1;
      });

      return {
        ...item.book,
        image: images[0]?.url || this.getFallbackImageUrl(item.bookId),
      };
    });

    return {
      ...promotion,
      bannerImageUrl: promotion.bannerImageUrl,
      books,
      bookCount: books.length,
    };
  }

  private parseDate(value?: string): Date | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new ValidationError('Ngày khuyến mãi không hợp lệ');
    }
    return date;
  }

  private isPromotionEffective(promotion: Promotion): boolean {
    const now = new Date();
    const startsAt = promotion.startsAt ? new Date(promotion.startsAt) : null;
    const endsAt = promotion.endsAt ? new Date(promotion.endsAt) : null;

    return (
      promotion.status === PromotionStatus.ACTIVE &&
      promotion.discountPercent > 0 &&
      (!startsAt || startsAt <= now) &&
      (!endsAt || endsAt >= now)
    );
  }

  private validateDateRange(startsAt: Date | null, endsAt: Date | null): void {
    if (startsAt && endsAt && startsAt > endsAt) {
      throw new ValidationError('Ngày bắt đầu phải trước ngày kết thúc');
    }
  }

  private normalizeBookIds(bookIds: string[] = []): string[] {
    return Array.from(new Set(bookIds.filter(Boolean)));
  }

  private hasOverlap(leftStart: Date | null, leftEnd: Date | null, rightStart: Date | null, rightEnd: Date | null): boolean {
    const leftStartTime = leftStart?.getTime() ?? Number.NEGATIVE_INFINITY;
    const leftEndTime = leftEnd?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightStartTime = rightStart?.getTime() ?? Number.NEGATIVE_INFINITY;
    const rightEndTime = rightEnd?.getTime() ?? Number.POSITIVE_INFINITY;
    return leftStartTime <= rightEndTime && rightStartTime <= leftEndTime;
  }

  private async validateBookPromotionConflicts(promotion: Promotion, bookIds: string[]): Promise<void> {
    if (bookIds.length === 0) return;
    if (promotion.status !== PromotionStatus.ACTIVE) return;

    const existingItems = await this.promotionBookRepo.find({
      where: { bookId: In(bookIds) },
      relations: ['promotion'],
    });
    const conflicts = existingItems.filter((item) => {
      if (item.promotionId === promotion.id) return false;
      if (!item.promotion || item.promotion.status !== PromotionStatus.ACTIVE) return false;
      return this.hasOverlap(promotion.startsAt, promotion.endsAt, item.promotion.startsAt, item.promotion.endsAt);
    });
    if (conflicts.length > 0) {
      throw new ValidationError('Một số sách đã thuộc chương trình khuyến mãi khác có thời gian trùng nhau', {
        bookIds: conflicts.map((item) => item.bookId),
      });
    }
  }

  private async applyPromotionToBooks(promotion: Promotion, bookIds: string[]): Promise<void> {
    if (bookIds.length === 0) return;

    const books = await this.bookRepo.find({ where: { id: In(bookIds) } });
    const foundIds = new Set(books.map((book) => book.id));
    const missingIds = bookIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new ValidationError('Một số sách không tồn tại', { bookIds: missingIds });
    }

    const isEffective = this.isPromotionEffective(promotion);
    for (const book of books) {
      const currentPrice = Number(book.price || 0);
      const originalPrice = Number(book.originalPrice || currentPrice) || currentPrice;
      const basePrice = originalPrice > 0 ? originalPrice : currentPrice;
      const nextPrice = isEffective
        ? Math.round((basePrice * (100 - promotion.discountPercent)) / 100)
        : basePrice;

      book.originalPrice = basePrice;
      book.price = nextPrice;
      book.discount = isEffective ? promotion.discountPercent : 0;
    }

    await this.bookRepo.save(books);
  }

  private async restoreBooks(bookIds: string[]): Promise<void> {
    if (bookIds.length === 0) return;

    const books = await this.bookRepo.find({ where: { id: In(bookIds) } });
    for (const book of books) {
      const currentPrice = Number(book.price || 0);
      const originalPrice = Number(book.originalPrice || currentPrice) || currentPrice;
      book.price = originalPrice;
      book.discount = 0;
    }

    await this.bookRepo.save(books);
  }

  private async syncBooks(promotion: Promotion, bookIds: string[] = []): Promise<void> {
    const normalizedBookIds = this.normalizeBookIds(bookIds);
    await this.validateBookPromotionConflicts(promotion, normalizedBookIds);
    if (normalizedBookIds.length > 0) {
      const books = await this.bookRepo.find({ where: { id: In(normalizedBookIds) } });
      const foundIds = new Set(books.map((book) => book.id));
      const missingIds = normalizedBookIds.filter((id) => !foundIds.has(id));
      if (missingIds.length > 0) {
        throw new ValidationError('Má»™t sá»‘ sÃ¡ch khÃ´ng tá»“n táº¡i', { bookIds: missingIds });
      }
    }

    await this.promotionBookRepo.delete({ promotionId: promotion.id });

    if (normalizedBookIds.length > 0) {
      await this.promotionBookRepo.save(
        normalizedBookIds.map((bookId) => this.promotionBookRepo.create({ promotionId: promotion.id, bookId }))
      );
    }
    await this.syncPromotionEffects();
  }

  async syncPromotionEffects(): Promise<void> {
    const promotionItems = await this.promotionBookRepo.find({
      relations: ['promotion', 'book'],
    });
    const itemsByBookId = new Map<string, PromotionBook[]>();

    promotionItems.forEach((item) => {
      if (!item.book || !item.promotion) return;
      const items = itemsByBookId.get(item.bookId) || [];
      items.push(item);
      itemsByBookId.set(item.bookId, items);
    });

    const booksToSave: Book[] = [];
    itemsByBookId.forEach((items) => {
      const book = items[0]?.book;
      if (!book) return;

      const activeItem = items
        .filter((item) => this.isPromotionEffective(item.promotion))
        .sort((left, right) => {
          const leftCreatedAt = left.promotion.createdAt ? new Date(left.promotion.createdAt).getTime() : 0;
          const rightCreatedAt = right.promotion.createdAt ? new Date(right.promotion.createdAt).getTime() : 0;
          return rightCreatedAt - leftCreatedAt;
        })[0];
      const currentPrice = Number(book.price || 0);
      const originalPrice = Number(book.originalPrice || currentPrice) || currentPrice;
      const basePrice = originalPrice > 0 ? originalPrice : currentPrice;

      if (activeItem?.promotion) {
        book.originalPrice = basePrice;
        book.price = Math.round((basePrice * (100 - activeItem.promotion.discountPercent)) / 100);
        book.discount = activeItem.promotion.discountPercent;
      } else {
        book.price = basePrice;
        book.discount = 0;
      }

      booksToSave.push(book);
    });

    if (booksToSave.length > 0) {
      await this.bookRepo.save(booksToSave);
    }
  }

  async listPromotions() {
    const promotions = await this.promotionRepo.find({
      relations: ['promotionBooks', 'promotionBooks.book', 'promotionBooks.book.images', 'promotionBooks.book.category'],
      order: { createdAt: 'DESC' },
    });
    return promotions.map((promotion) => this.mapPromotion(promotion));
  }

  async createPromotion(dto: CreatePromotionDto, bannerImage?: Express.Multer.File) {
    const startsAt = this.parseDate(dto.startsAt);
    const endsAt = this.parseDate(dto.endsAt);
    this.validateDateRange(startsAt, endsAt);

    const promotion = this.promotionRepo.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      bannerImageUrl: dto.bannerImageUrl?.trim() || null,
      bannerImagePublicId: null,
      discountPercent: dto.discountPercent,
      startsAt,
      endsAt,
      status: dto.status || PromotionStatus.ACTIVE,
    });
    const normalizedBookIds = this.normalizeBookIds(dto.bookIds || []);
    await this.validateBookPromotionConflicts(promotion, normalizedBookIds);
    const uploadedBanner = await uploadImage(bannerImage);
    if (uploadedBanner) {
      promotion.bannerImageUrl = uploadedBanner.url;
      promotion.bannerImagePublicId = uploadedBanner.publicId;
    }

    let savedPromotionId: string | null = null;
    try {
      const saved = await this.promotionRepo.save(promotion);
      savedPromotionId = saved.id;
      await this.syncBooks(saved, normalizedBookIds);
      return this.getPromotionById(saved.id);
    } catch (error) {
      if (savedPromotionId) {
        await this.promotionRepo.delete(savedPromotionId);
      }
      if (uploadedBanner?.publicId) {
        await deleteCloudinaryImages([uploadedBanner.publicId]);
      }
      throw error;
    }
  }

  async getPromotionById(id: string) {
    const promotion = await this.promotionRepo.findOne({
      where: { id },
      relations: ['promotionBooks', 'promotionBooks.book', 'promotionBooks.book.images', 'promotionBooks.book.category'],
    });
    if (!promotion) throw new NotFoundError('Chương trình khuyến mãi không tồn tại');
    return this.mapPromotion(promotion);
  }

  async updatePromotion(id: string, dto: UpdatePromotionDto, bannerImage?: Express.Multer.File) {
    const promotion = await this.promotionRepo.findOne({ where: { id } });
    const oldBannerPublicId = promotion?.bannerImagePublicId;
    if (!promotion) throw new NotFoundError('Chương trình khuyến mãi không tồn tại');

    if (typeof dto.name === 'string') promotion.name = dto.name.trim();
    if (typeof dto.description === 'string') promotion.description = dto.description.trim() || null;
    if (typeof dto.bannerImageUrl === 'string') {
      promotion.bannerImageUrl = dto.bannerImageUrl.trim() || null;
      promotion.bannerImagePublicId = null;
    }
    if (typeof dto.discountPercent === 'number') promotion.discountPercent = dto.discountPercent;
    if (dto.startsAt !== undefined) promotion.startsAt = this.parseDate(dto.startsAt);
    if (dto.endsAt !== undefined) promotion.endsAt = this.parseDate(dto.endsAt);
    if (dto.status) promotion.status = dto.status;
    this.validateDateRange(promotion.startsAt, promotion.endsAt);
    const nextBookIds = dto.bookIds
      ? this.normalizeBookIds(dto.bookIds)
      : (await this.promotionBookRepo.find({ where: { promotionId: id } })).map((item) => item.bookId);
    await this.validateBookPromotionConflicts(promotion, nextBookIds);
    const uploadedBanner = await uploadImage(bannerImage);
    if (uploadedBanner) {
      promotion.bannerImageUrl = uploadedBanner.url;
      promotion.bannerImagePublicId = uploadedBanner.publicId;
    }

    try {
      const saved = await this.promotionRepo.save(promotion);
      if ((uploadedBanner || typeof dto.bannerImageUrl === 'string') && oldBannerPublicId) {
        await deleteCloudinaryImages([oldBannerPublicId]);
      }
      if (dto.bookIds) {
        await this.syncBooks(saved, nextBookIds);
      } else {
        await this.syncPromotionEffects();
      }
      return this.getPromotionById(id);
    } catch (error) {
      throw error;
    }
  }

  async updatePromotionStatus(id: string, status: PromotionStatus) {
    if (!Object.values(PromotionStatus).includes(status)) {
      throw new ValidationError('Tráº¡ng thÃ¡i chÆ°Æ¡ng trÃ¬nh khuyáº¿n mÃ£i khÃ´ng há»£p lá»‡');
    }

    const promotion = await this.promotionRepo.findOne({ where: { id }, relations: ['promotionBooks'] });
    if (!promotion) throw new NotFoundError('ChÆ°Æ¡ng trÃ¬nh khuyáº¿n mÃ£i khÃ´ng tá»“n táº¡i');

    promotion.status = status;
    const bookIds = (promotion.promotionBooks || []).map((item) => item.bookId);
    await this.validateBookPromotionConflicts(promotion, bookIds);
    await this.promotionRepo.save(promotion);
    await this.syncPromotionEffects();
    return this.getPromotionById(id);
  }

  async deletePromotion(id: string): Promise<void> {
    const promotion = await this.promotionRepo.findOne({ where: { id }, relations: ['promotionBooks'] });
    if (!promotion) throw new NotFoundError('Chương trình khuyến mãi không tồn tại');

    const bookIds = (promotion.promotionBooks || []).map((item) => item.bookId);
    await this.restoreBooks(bookIds);
    if (promotion.bannerImagePublicId) {
      await deleteCloudinaryImages([promotion.bannerImagePublicId]);
    }
    await this.promotionRepo.delete(id);
    await this.syncPromotionEffects();
  }
}
