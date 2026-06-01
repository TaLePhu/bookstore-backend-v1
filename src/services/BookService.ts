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
import { Order, OrderStatus } from '@entities/Order';
import { BehaviorType, UserBehavior } from '@entities/UserBehavior';
import { AIAdvisorConversation } from '@entities/AIAdvisorConversation';
import { PromotionStatus } from '@entities/Promotion';
import { PromotionBook } from '@entities/PromotionBook';
import { AppDataSource } from '@config/data-source';
import { uploadBookImages, deleteCloudinaryImages } from '@utils/cloudinary';
import { EmbeddingSearchService } from '@services/EmbeddingSearchService';
import { EmbeddingProviderService } from '@services/EmbeddingProviderService';

type HomeRecommendationSource = 'personalized' | 'popular';
type SmartSearchMode = 'keyword' | 'semantic' | 'mixed';
type SmartSearchConfidence = 'high' | 'medium' | 'low';

interface HomeRecommendedBook extends BookResponse {
  reason: string;
}

interface HomeRecommendationResponse {
  source: HomeRecommendationSource;
  title: string;
  subtitle: string;
  books: HomeRecommendedBook[];
}

interface SmartSearchResponse {
  data: BookResponse[];
  total: number;
  page: number;
  limit: number;
  query: string;
  mode: SmartSearchMode;
  confidence: SmartSearchConfidence;
  message: string;
  isFallback: boolean;
}

interface RecommendationSignalProfile {
  purchasedBookIds: Set<string>;
  categoryWeights: Map<string, number>;
  authorWeights: Map<string, number>;
  queryTokens: Set<string>;
  queryTexts: string[];
  interactedBookWeights: Map<string, number>;
  hasPersonalSignals: boolean;
}

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

  async recordUserQueryEvent(
    userId: string | undefined,
    type: BehaviorType.SEARCH | BehaviorType.AI_ADVISOR_QUERY,
    queryText: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const trimmed = queryText.trim();
    if (!userId || !trimmed) return;

    try {
      const behaviorRepo = AppDataSource.getRepository(UserBehavior);
      await behaviorRepo.save(
        behaviorRepo.create({
          userId,
          behaviorType: type,
          queryText: trimmed.slice(0, 600),
          metadata: metadata || null,
          bookId: null,
        })
      );
    } catch (error) {
      console.warn('Record user query behavior failed:', error);
    }
  }

  async recordUserBookEvent(
    userId: string | undefined,
    type: BehaviorType.VIEW | BehaviorType.CLICK,
    bookId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!userId || !bookId) return;

    try {
      const behaviorRepo = AppDataSource.getRepository(UserBehavior);
      await behaviorRepo.save(
        behaviorRepo.create({
          userId,
          behaviorType: type,
          bookId,
          metadata: metadata || null,
        })
      );
    } catch (error) {
      console.warn('Record user book behavior failed:', error);
    }
  }

  async getHomeRecommendations(userId?: string, limit: number = 4): Promise<HomeRecommendationResponse> {
    const safeLimit = Math.min(8, Math.max(1, limit));
    const pool = await this.getRecommendationPool(Math.max(50, safeLimit * 12));

    if (pool.length === 0) {
      return {
        source: 'popular',
        title: 'Gợi ý cho bạn',
        subtitle: 'Hiện chưa có đủ dữ liệu sách để gợi ý.',
        books: [],
      };
    }

    const profile = userId ? await this.buildRecommendationProfile(userId) : this.emptyRecommendationProfile();
    const scoredBooks = pool
      .filter((book) => this.isRecommendableBook(book) && !profile.purchasedBookIds.has(book.id))
      .map((book, index) => ({
        book,
        index,
        score: this.scoreHomeRecommendation(book, profile),
        reason: this.buildHomeRecommendationReason(book, profile),
      }))
      .sort((left, right) => right.score - left.score || left.index - right.index);

    const selected = this.pickDiverseRecommendations(scoredBooks, safeLimit);
    const source: HomeRecommendationSource = profile.hasPersonalSignals ? 'personalized' : 'popular';

    return {
      source,
      title: source === 'personalized' ? 'Gợi ý theo gu gần đây của bạn' : 'Sách được nhiều độc giả quan tâm',
      subtitle: source === 'personalized'
        ? 'Dựa trên lịch sử tìm kiếm, tư vấn AI và những sách bạn từng quan tâm.'
        : 'Một vài lựa chọn dễ bắt đầu, được chọn từ các sách còn hàng và đang được nhiều độc giả chú ý.',
      books: selected.map((item) => ({ ...item.book, reason: item.reason })),
    };
  }

  private async getRecommendationPool(limit: number): Promise<BookResponse[]> {
    const [bestsellers, latest] = await Promise.all([
      this.bookRepository.findAllWithFilters({ page: 1, limit, sort: 'bestseller' }),
      this.bookRepository.findAllWithFilters({ page: 1, limit, sort: 'latest' }),
    ]);

    const map = new Map<string, BookResponse>();
    [...bestsellers.data, ...latest.data].forEach((book) => map.set(book.id, book));
    return Array.from(map.values());
  }

  private emptyRecommendationProfile(): RecommendationSignalProfile {
    return {
      purchasedBookIds: new Set(),
      categoryWeights: new Map(),
      authorWeights: new Map(),
      queryTokens: new Set(),
      queryTexts: [],
      interactedBookWeights: new Map(),
      hasPersonalSignals: false,
    };
  }

  private async buildRecommendationProfile(userId: string): Promise<RecommendationSignalProfile> {
    const profile = this.emptyRecommendationProfile();
    const orderRepo = AppDataSource.getRepository(Order);
    const behaviorRepo = AppDataSource.getRepository(UserBehavior);
    const conversationRepo = AppDataSource.getRepository(AIAdvisorConversation);
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [orders, behaviors, conversations] = await Promise.all([
      orderRepo.find({
        where: { userId },
        relations: ['items', 'items.book', 'items.book.category'],
        order: { createdAt: 'DESC' },
        take: 20,
      }),
      behaviorRepo
        .createQueryBuilder('behavior')
        .leftJoinAndSelect('behavior.book', 'book')
        .leftJoinAndSelect('book.category', 'category')
        .where('behavior.userId = :userId', { userId })
        .andWhere('behavior.createdAt >= :since', { since })
        .orderBy('behavior.createdAt', 'DESC')
        .take(80)
        .getMany(),
      conversationRepo.find({
        where: { userId },
        order: { updatedAt: 'DESC' },
        take: 8,
      }),
    ]);

    orders
      .filter((order) => order.status !== OrderStatus.CANCELLED)
      .forEach((order) => {
        const orderWeight = order.status === OrderStatus.COMPLETED ? 8 : 4;
        (order.items || []).forEach((item) => {
          const book = item.book;
          if (!book) return;
          profile.purchasedBookIds.add(book.id);
          this.addWeight(profile.authorWeights, this.normalizeSignal(book.author), orderWeight * 0.7);
          if (book.categoryId) {
            this.addWeight(profile.categoryWeights, book.categoryId, orderWeight);
          }
        });
      });

    behaviors.forEach((behavior) => {
      if (behavior.queryText && [BehaviorType.SEARCH, BehaviorType.AI_ADVISOR_QUERY].includes(behavior.behaviorType)) {
        profile.queryTexts.push(behavior.queryText);
        this.extractRecommendationTokens(behavior.queryText).forEach((token) => profile.queryTokens.add(token));
      }

      if (behavior.bookId) {
        const weight = behavior.behaviorType === BehaviorType.ADD_TO_CART ? 6 : behavior.behaviorType === BehaviorType.VIEW ? 3 : 2;
        this.addWeight(profile.interactedBookWeights, behavior.bookId, weight);
      }

      if (behavior.book?.categoryId) {
        this.addWeight(profile.categoryWeights, behavior.book.categoryId, 2);
      }

      if (behavior.book?.author) {
        this.addWeight(profile.authorWeights, this.normalizeSignal(behavior.book.author), 1.5);
      }
    });

    conversations.forEach((conversation) => {
      this.extractUserMessagesFromConversation(conversation.messages).forEach((message) => {
        profile.queryTexts.push(message);
        this.extractRecommendationTokens(message).forEach((token) => profile.queryTokens.add(token));
      });
    });

    profile.hasPersonalSignals =
      profile.purchasedBookIds.size > 0 ||
      profile.categoryWeights.size > 0 ||
      profile.authorWeights.size > 0 ||
      profile.queryTokens.size > 0 ||
      profile.interactedBookWeights.size > 0;

    return profile;
  }

  private scoreHomeRecommendation(book: BookResponse, profile: RecommendationSignalProfile): number {
    let score = 0;
    const authorKey = this.normalizeSignal(book.author);
    const text = this.normalizeSignal(`${book.title} ${book.author} ${book.category?.name || ''} ${book.description || ''}`);

    score += Math.min(4, Number(book.rating || 0)) * 1.5;
    score += Math.min(4, Number(book.soldCount || 0) / 25);
    score += Number(book.discount || 0) > 0 ? 0.8 : 0;

    if (book.categoryId) score += profile.categoryWeights.get(book.categoryId) || 0;
    if (authorKey) score += profile.authorWeights.get(authorKey) || 0;
    score += profile.interactedBookWeights.get(book.id) || 0;

    profile.queryTokens.forEach((token) => {
      if (text.includes(token)) score += 2.5;
      if (this.normalizeSignal(book.title).includes(token)) score += 1.5;
      if (this.normalizeSignal(book.category?.name).includes(token)) score += 1.5;
    });

    return score;
  }

  private buildHomeRecommendationReason(book: BookResponse, profile: RecommendationSignalProfile): string {
    const authorKey = this.normalizeSignal(book.author);
    const categoryWeight = book.categoryId ? profile.categoryWeights.get(book.categoryId) || 0 : 0;
    const authorWeight = authorKey ? profile.authorWeights.get(authorKey) || 0 : 0;
    const bookText = this.normalizeSignal(`${book.title} ${book.category?.name || ''} ${book.description || ''}`);
    const matchedQueryToken = [...profile.queryTokens].find((token) => bookText.includes(token));
    const recentQuery = profile.queryTexts[0] ? this.shortenText(profile.queryTexts[0], 54) : '';
    const tone = this.getBookRecommendationTone(book);

    if (matchedQueryToken && recentQuery) {
      return `Gần đây bạn có nhắc đến "${recentQuery}", nên mình đưa cuốn này vào vì nó giữ được ${tone.personalized}. Đây là một hướng đọc gần mạch bạn đang quan tâm, không phải gợi ý chọn đại từ danh sách phổ biến.`;
    }

    if (categoryWeight > 0 && book.category?.name) {
      return `Bạn từng quan tâm đến nhóm ${book.category.name}, nên cuốn này khá đáng để thử tiếp. Nó vẫn nằm gần gu đọc cũ, nhưng có một sắc thái riêng để bạn không bị lặp lại đúng một kiểu sách.`;
    }

    if (authorWeight > 0 && book.author) {
      return `Bạn từng chọn hoặc quan tâm đến sách của ${book.author}, nên mình ưu tiên cuốn này như một cách tiếp tục giọng viết quen thuộc. Nếu bạn đã hợp văn phong của tác giả, đây là lựa chọn dễ vào hơn một gợi ý hoàn toàn mới.`;
    }

    if (book.category?.name) {
      return tone.category;
    }

    if (Number(book.rating || 0) >= 4) {
      return 'Cuốn này là lựa chọn khá an toàn để bắt đầu vì được nhiều độc giả đánh giá tốt. Nếu bạn chưa có gu đọc thật rõ, một đầu sách dễ tiếp cận như vậy sẽ giúp bạn thử trước mà ít rủi ro hơn.';
    }

    return 'Mình chọn cuốn này như một gợi ý dễ thử khi bạn chưa có nhu cầu thật cụ thể. Nó có độ quan tâm ổn trong kho và phù hợp để mở rộng lựa chọn trước khi lọc sâu hơn theo thể loại hoặc cảm xúc đọc.';
  }

  private getBookRecommendationTone(book: BookResponse): { personalized: string; category: string } {
    const category = this.normalizeSignal(book.category?.name);
    const title = book.title;

    if (/(van hoc|tieu thuyet|truyen|fiction|classic|kinh dien)/.test(category)) {
      return {
        personalized: 'mạch cảm xúc và chất kể chuyện gần với điều bạn đang tìm',
        category: `Nếu bạn muốn một cuốn có màu văn học rõ hơn, ${title} là lựa chọn đáng cân nhắc vì thường hợp để đọc chậm và theo cảm xúc. Cuốn này phù hợp khi bạn muốn tìm một câu chuyện có dư âm thay vì chỉ đọc lướt cho nhanh.`,
      };
    }

    if (/(kinh te|kinh doanh|khoi nghiep|quan tri|marketing|tai chinh)/.test(category)) {
      return {
        personalized: 'tính thực tế và hướng đọc có thể áp dụng',
        category: `Cuốn này hợp nếu bạn muốn đọc để lấy thêm góc nhìn thực tế cho công việc hoặc kinh doanh. Mình ưu tiên nó vì nhóm sách này thường hữu ích nhất khi nội dung đủ rõ để đọc xong có thể rút ra cách nghĩ hoặc cách làm.`,
      };
    }

    if (/(ky nang|self help|phat trien|tam ly|song dep)/.test(category)) {
      return {
        personalized: 'hướng đọc dễ áp dụng vào đời sống hằng ngày',
        category: `Đây là lựa chọn dễ bắt đầu nếu bạn đang muốn đọc thứ gì đó gần với đời sống và có thể áp dụng dần. Cuốn này hợp với lúc bạn cần một gợi ý nhẹ nhưng vẫn có giá trị suy ngẫm sau khi đọc.`,
      };
    }

    if (/(thieu nhi|tre em|manga|comic|truyen tranh)/.test(category)) {
      return {
        personalized: 'nhịp đọc nhẹ và cảm giác dễ tiếp cận',
        category: `Cuốn này có hướng đọc nhẹ nhàng, dễ tiếp cận, hợp để đọc thư giãn hoặc chọn cho bạn đọc nhỏ tuổi. Mình ưu tiên những lựa chọn như vậy khi cần một cuốn không quá nặng nhưng vẫn tạo được hứng thú đọc.`,
      };
    }

    if (/(lich su|van hoa|xa hoi|chinh tri|khoa hoc)/.test(category)) {
      return {
        personalized: 'chủ đề tìm hiểu có chiều sâu hơn',
        category: `Nếu bạn muốn một cuốn giúp mở rộng hiểu biết thay vì chỉ giải trí, đây là lựa chọn đáng xem qua. Nhóm sách này phù hợp khi bạn muốn đọc chậm, tích lũy thêm bối cảnh và có thêm chất liệu để suy nghĩ.`,
      };
    }

    return {
      personalized: 'chủ đề và cảm giác đọc tương đối gần với gu gần đây của bạn',
      category: `Cuốn này được chọn vì có chủ đề rõ và không quá kén người đọc. Nếu bạn đang lướt để tìm một đầu sách dễ bắt đầu, đây là lựa chọn khá an toàn trước khi lọc sâu hơn theo gu cá nhân.`,
    };
  }

  private pickDiverseRecommendations<T extends { book: BookResponse; score: number; reason: string }>(
    scoredBooks: T[],
    limit: number
  ): T[] {
    const selected: T[] = [];
    const categoryCounts = new Map<string, number>();

    for (const item of scoredBooks) {
      const categoryKey = item.book.categoryId || 'uncategorized';
      if ((categoryCounts.get(categoryKey) || 0) >= 2) continue;

      selected.push(item);
      categoryCounts.set(categoryKey, (categoryCounts.get(categoryKey) || 0) + 1);
      if (selected.length >= limit) return selected;
    }

    for (const item of scoredBooks) {
      if (selected.some((selectedItem) => selectedItem.book.id === item.book.id)) continue;
      selected.push(item);
      if (selected.length >= limit) break;
    }

    return selected;
  }

  private isRecommendableBook(book: BookResponse): boolean {
    return !book.deletedAt && book.status !== 'deleted' && Number(book.stock || 0) > 0;
  }

  private addWeight(map: Map<string, number>, key: string, weight: number): void {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + weight);
  }

  private normalizeSignal(value?: string | null): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractRecommendationTokens(value: string): string[] {
    const stopWords = new Set([
      'sach',
      'cuon',
      'minh',
      'toi',
      'can',
      'tim',
      'goi',
      'cho',
      'nguoi',
      'phu',
      'hop',
      'voi',
      'doc',
      'hay',
      'mot',
      'vai',
    ]);

    return this.normalizeSignal(value)
      .split(' ')
      .filter((token) => token.length >= 4 && !stopWords.has(token))
      .slice(0, 12);
  }

  private extractUserMessagesFromConversation(messages: unknown[]): string[] {
    if (!Array.isArray(messages)) return [];

    return messages
      .filter((message): message is { type: 'user'; text: string } => {
        if (!message || typeof message !== 'object') return false;
        const item = message as { type?: unknown; text?: unknown };
        return item.type === 'user' && typeof item.text === 'string';
      })
      .map((message) => message.text.trim())
      .filter(Boolean)
      .slice(-6);
  }

  private shortenText(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3).trim()}...` : normalized;
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
    const { data, total } = await this.bookRepository.searchRanked(query, page, limit);
    return { data, total, page, limit };
  }

  async smartSearchBooks(query: string, page: number = 1, limit: number = 10): Promise<SmartSearchResponse> {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');

    if (!normalizedQuery) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        query: '',
        mode: 'keyword',
        confidence: 'low',
        message: '',
        isFallback: false,
      };
    }

    const keyword = await this.bookRepository.searchRanked(normalizedQuery, page, limit);
    const shouldTrustKeyword = keyword.data.length > 0 && this.isLikelyExactSearch(normalizedQuery);

    if (shouldTrustKeyword) {
      return {
        data: keyword.data,
        total: keyword.total,
        page,
        limit,
        query: normalizedQuery,
        mode: 'keyword',
        confidence: 'high',
        message: `Tìm thấy sách khớp với "${normalizedQuery}".`,
        isFallback: false,
      };
    }

    if (keyword.data.length > 0 && !this.isNaturalLanguageSearch(normalizedQuery)) {
      return {
        data: keyword.data,
        total: keyword.total,
        page,
        limit,
        query: normalizedQuery,
        mode: 'keyword',
        confidence: 'medium',
        message: `Tìm thấy một số kết quả gần với "${normalizedQuery}".`,
        isFallback: false,
      };
    }

    const semantic = await this.semanticSearchBooks(normalizedQuery, page, limit, 0.35);
    if (semantic.data.length > 0) {
      const merged = this.mergeSearchResults(keyword.data, semantic.data, limit);
      return {
        data: merged,
        total: Math.max(keyword.total, semantic.total, merged.length),
        page,
        limit,
        query: normalizedQuery,
        mode: keyword.data.length > 0 ? 'mixed' : 'semantic',
        confidence: keyword.data.length > 0 ? 'medium' : 'low',
        message: keyword.data.length > 0
          ? `Có vài kết quả khớp và gợi ý gần nghĩa cho "${normalizedQuery}".`
          : `Chưa thấy tên sách khớp rõ, đây là các gợi ý gần với nhu cầu "${normalizedQuery}".`,
        isFallback: false,
      };
    }

    const fallback = await this.bookRepository.findAllWithFilters({ page: 1, limit, sort: 'bestseller' });
    return {
      data: fallback.data,
      total: fallback.total,
      page: 1,
      limit,
      query: normalizedQuery,
      mode: 'keyword',
      confidence: 'low',
      message: `Chưa tìm thấy sách khớp với "${normalizedQuery}". Bạn có thể tham khảo vài sách đang được quan tâm.`,
      isFallback: true,
    };
  }

  private mergeSearchResults(primary: BookResponse[], secondary: BookResponse[], limit: number): BookResponse[] {
    const map = new Map<string, BookResponse>();
    [...primary, ...secondary].forEach((book) => {
      if (!map.has(book.id)) {
        map.set(book.id, book);
      }
    });
    return Array.from(map.values()).slice(0, limit);
  }

  private isLikelyExactSearch(query: string): boolean {
    return query.length <= 48 && query.split(/\s+/).length <= 5;
  }

  private isNaturalLanguageSearch(query: string): boolean {
    const normalized = this.normalizeSignal(query);
    const words = normalized.split(' ').filter(Boolean);
    if (words.length >= 6) return true;

    const intentWords = new Set([
      'can',
      'muon',
      'tim',
      'cho',
      've',
      'giup',
      'phu',
      'hop',
      'nhe',
      'de',
      'doc',
      'nguoi',
      'moi',
      'hoc',
      'thu',
      'gian',
    ]);

    return words.some((word) => intentWords.has(word));
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

  async updateBookStock(id: string, stock: number): Promise<any> {
    if (!Number.isInteger(stock) || stock < 0) {
      throw new ValidationError('Tồn kho phải là số nguyên không âm');
    }

    const bookRepo = AppDataSource.getRepository(Book);
    const book = await bookRepo.findOne({ where: { id } });
    if (!book) {
      throw new NotFoundError('Sách không tồn tại');
    }

    book.stock = stock;
    await bookRepo.save(book);
    await this.clearDetailCache(id);

    return this.getBookById(id, true);
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

