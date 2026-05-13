import { injectable } from 'tsyringe';
import { MoreThan } from 'typeorm';
import { AppDataSource } from '@config/data-source';
import { Book } from '@entities/Book';
import { Promotion, PromotionStatus } from '@entities/Promotion';

type PromotionBook = {
  id: string;
  title: string;
  author: string;
  price: number;
  originalPrice: number;
  discount: number;
  image: string;
  rating: number;
  sold: number;
  stock: number;
  categoryName?: string;
};

type PromotionVoucher = {
  id: string;
  code: string;
  title: string;
  description: string;
  discount: string;
  minOrder: number;
  expiry: string;
  stock: number;
  used: number;
  type: 'welcome' | 'order' | 'shipping' | 'vip';
};

type PromotionBanner = {
  id: string;
  name: string;
  description: string | null;
  discountPercent: number;
  image: string;
  startsAt: Date | null;
  endsAt: Date | null;
};

type PromotionProgram = {
  id: string;
  name: string;
  description: string | null;
  discountPercent: number;
  bannerImageUrl: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  bookCount: number;
  books: PromotionBook[];
};

@injectable()
export class PromotionService {
  private readonly fallbackImageUrls = [
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800',
    'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=800',
    'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?q=80&w=800',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=800',
  ];

  private getFallbackImageUrl(bookId: string): string {
    const hash = bookId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return this.fallbackImageUrls[hash % this.fallbackImageUrls.length];
  }

  private getBookImageUrl(book: Book): string {
    const images = (book.images || []).filter(Boolean).sort((left, right) => {
      if (left.isPrimary === right.isPrimary) return 0;
      return left.isPrimary ? -1 : 1;
    });

    return images[0]?.url || this.getFallbackImageUrl(book.id);
  }

  private mapBook(book: Book): PromotionBook {
    const price = Number(book.price || 0);
    const originalPrice = Number(book.originalPrice || 0) || price;
    const discount =
      typeof book.discount === 'number' && book.discount > 0
        ? book.discount
        : originalPrice > price
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0;

    return {
      id: book.id,
      title: book.title,
      author: book.author,
      price,
      originalPrice,
      discount,
      image: this.getBookImageUrl(book),
      rating: 4.8,
      sold: Number(book.soldCount || 0),
      stock: Number(book.stock || 0),
      categoryName: book.category?.name,
    };
  }

  private getVouchers(): PromotionVoucher[] {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const expiry = endOfMonth.toISOString().slice(0, 10);

    return [
      {
        id: 'welcome30',
        code: 'WELCOME30',
        title: 'Giảm 30% đơn đầu tiên',
        description: 'Dành cho khách hàng mới, giảm tối đa 50.000đ',
        discount: '30%',
        minOrder: 0,
        expiry,
        stock: 50,
        used: 234,
        type: 'welcome',
      },
      {
        id: 'book100k',
        code: 'BOOK100K',
        title: 'Giảm 100K cho đơn từ 500K',
        description: 'Áp dụng cho tất cả sách đang bán',
        discount: '100.000đ',
        minOrder: 500000,
        expiry,
        stock: 100,
        used: 456,
        type: 'order',
      },
      {
        id: 'freeship',
        code: 'FREESHIP',
        title: 'Miễn phí vận chuyển',
        description: 'Áp dụng cho đơn hàng từ 200.000đ',
        discount: 'FREE SHIP',
        minOrder: 200000,
        expiry,
        stock: 200,
        used: 789,
        type: 'shipping',
      },
    ];
  }

  async getPromotions(): Promise<{
    vouchers: PromotionVoucher[];
    flashSaleEndsAt: string;
    flashSaleBooks: PromotionBook[];
    discountTiers: Array<{ percent: number; title: string; count: number }>;
    programs: PromotionProgram[];
    banners: PromotionBanner[];
    combos: Array<{
      id: string;
      title: string;
      books: number;
      price: number;
      originalPrice: number;
      saving: number;
      image: string;
    }>;
  }> {
    const bookRepo = AppDataSource.getRepository(Book);
    const promotionRepo = AppDataSource.getRepository(Promotion);
    const now = new Date();

    const activePrograms = (await promotionRepo.find({
      where: { status: PromotionStatus.ACTIVE },
      relations: ['promotionBooks', 'promotionBooks.book', 'promotionBooks.book.images', 'promotionBooks.book.category'],
      order: { createdAt: 'DESC' },
    })).filter((promotion) => {
      const startsAt = promotion.startsAt ? new Date(promotion.startsAt) : null;
      const endsAt = promotion.endsAt ? new Date(promotion.endsAt) : null;
      return (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
    });

    const discountedBooks = await bookRepo.find({
      where: { discount: MoreThan(0) },
      relations: ['category', 'images'],
      order: {
        discount: 'DESC',
        soldCount: 'DESC',
        createdAt: 'DESC',
      },
      take: 24,
    });

    const programBooks = activePrograms.flatMap((promotion) =>
      (promotion.promotionBooks || [])
        .map((item) => item.book)
        .filter((book): book is Book => Boolean(book))
        .map((book) => this.mapBook(book))
    );
    const uniqueProgramBooks = Array.from(
      new Map(programBooks.map((book) => [book.id, book])).values()
    );
    const promotionBooks =
      uniqueProgramBooks.length > 0 ? uniqueProgramBooks : discountedBooks.map((book) => this.mapBook(book));
    const programs = activePrograms
      .map((promotion) => {
        const books = (promotion.promotionBooks || [])
          .map((item) => item.book)
          .filter((book): book is Book => Boolean(book))
          .map((book) => this.mapBook(book));

        return {
          id: promotion.id,
          name: promotion.name,
          description: promotion.description,
          discountPercent: promotion.discountPercent,
          bannerImageUrl: promotion.bannerImageUrl,
          startsAt: promotion.startsAt,
          endsAt: promotion.endsAt,
          bookCount: books.length,
          books,
        };
      })
      .filter((promotion) => promotion.bookCount > 0);
    const discountTiers = [30, 40, 50].map((percent) => ({
      percent,
      title: `Giảm ${percent}%`,
      count: promotionBooks.filter((book) => book.discount >= percent).length,
    }));
    const banners = activePrograms
      .filter((promotion) => Boolean(promotion.bannerImageUrl))
      .map((promotion) => ({
        id: promotion.id,
        name: promotion.name,
        description: promotion.description,
        discountPercent: promotion.discountPercent,
        image: promotion.bannerImageUrl!,
        startsAt: promotion.startsAt,
        endsAt: promotion.endsAt,
      }));

    const categoryGroups = new Map<string, PromotionBook[]>();
    promotionBooks.forEach((book) => {
      const key = book.categoryName || 'Sách khuyến mãi';
      categoryGroups.set(key, [...(categoryGroups.get(key) || []), book]);
    });

    const combos = Array.from(categoryGroups.entries())
      .filter(([, books]) => books.length >= 2)
      .slice(0, 3)
      .map(([categoryName, books], index) => {
        const comboBooks = books.slice(0, Math.min(5, books.length));
        const price = comboBooks.reduce((sum, book) => sum + book.price, 0);
        const originalPrice = comboBooks.reduce((sum, book) => sum + book.originalPrice, 0);

        return {
          id: `combo-${index + 1}`,
          title: `Combo ${categoryName}`,
          books: comboBooks.length,
          price,
          originalPrice,
          saving: Math.max(0, originalPrice - price),
          image: comboBooks[0].image,
        };
      });

    const flashSaleEndsAt = new Date();
    flashSaleEndsAt.setHours(23, 59, 59, 999);

    return {
      vouchers: this.getVouchers(),
      flashSaleEndsAt: flashSaleEndsAt.toISOString(),
      flashSaleBooks: promotionBooks.slice(0, 8),
      discountTiers,
      programs,
      banners,
      combos,
    };
  }
}
