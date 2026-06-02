import { injectable } from 'tsyringe';
import { In } from 'typeorm';
import { AppDataSource } from '@config/data-source';
import { getEnv } from '@config/env';
import { Book } from '@entities/Book';
import { Order, OrderStatus } from '@entities/Order';
import { Promotion, PromotionStatus } from '@entities/Promotion';
import { PromotionBook } from '@entities/PromotionBook';
import { ValidationError } from '@utils/errors';

type MarketingPriority = 'high' | 'medium' | 'low';
type MarketingDataQuality = 'starter' | 'enough' | 'rich';
type MarketingActionType = 'create_promotion' | 'view_books' | 'view_customers' | 'view_orders';

interface GeminiTextResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

interface MarketingContext {
  books: Book[];
  orders: Order[];
  promotions: Promotion[];
  activePromotionBookIds: Set<string>;
  completedOrders: Order[];
  cancelledOrders: Order[];
  highStockSlowBooks: Book[];
  highStockBooks: Book[];
  bestSellersWithoutPromo: Book[];
  lowStockBooks: Book[];
  newBooks: Book[];
  activePromotions: Promotion[];
  vipCustomerCount: number;
  cancelRate: number;
}

export interface AdminMarketingSummary {
  dataQuality: MarketingDataQuality;
  totalBooks: number;
  completedOrders: number;
  activePromotions: number;
  highStockBooks: number;
  bestSellerBooks: number;
  lowStockBooks: number;
  newBooks: number;
  vipCustomers: number;
  cancelRate: number;
}

export interface AdminMarketingProgram {
  id: string;
  title: string;
  problem: string;
  recommendation: string;
  target: string;
  discountPercent: number;
  durationDays: number;
  priority: MarketingPriority;
  actionType: MarketingActionType;
  bookIds: string[];
  reason: string;
  expectedImpact: string;
}

export interface AdminMarketingPlan {
  summary: AdminMarketingSummary;
  recommendedPrograms: AdminMarketingProgram[];
  dataNotes: string[];
}

export interface AdminMarketingCampaignDraft {
  insightId: string;
  name: string;
  description: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  status: PromotionStatus;
  bookIds: string[];
  bannerImageUrl: string;
  aiGenerated: boolean;
}

@injectable()
export class AdminMarketingService {
  private bookRepo = AppDataSource.getRepository(Book);
  private orderRepo = AppDataSource.getRepository(Order);
  private promotionRepo = AppDataSource.getRepository(Promotion);
  private promotionBookRepo = AppDataSource.getRepository(PromotionBook);

  async listInsights(): Promise<AdminMarketingPlan> {
    const context = await this.getMarketingContext();
    const summary = this.buildSummary(context);
    const recommendedPrograms = this.buildRecommendedPrograms(context);
    const dataNotes = this.buildDataNotes(summary, recommendedPrograms);

    return {
      summary,
      recommendedPrograms,
      dataNotes,
    };
  }

  async generateCampaignDraft(programId: string): Promise<AdminMarketingCampaignDraft> {
    const plan = await this.listInsights();
    const program = plan.recommendedPrograms.find((item) => item.id === programId);
    if (!program) {
      throw new ValidationError('Chương trình marketing không tồn tại hoặc không còn phù hợp');
    }
    if (program.bookIds.length === 0) {
      throw new ValidationError('Chương trình này chưa có danh sách sách phù hợp để tạo khuyến mãi');
    }

    const books = await this.bookRepo.find({
      where: { id: In(program.bookIds) },
      relations: ['category'],
    });
    const orderedBooks = program.bookIds
      .map((id) => books.find((book) => book.id === id))
      .filter(Boolean) as Book[];
    const fallbackDraft = this.buildFallbackDraft(program, orderedBooks);
    const aiDraft = await this.generateAiDraft(program, orderedBooks, fallbackDraft);

    return aiDraft || fallbackDraft;
  }

  private async getMarketingContext(): Promise<MarketingContext> {
    const [books, orders, promotions, promotionBooks] = await Promise.all([
      this.bookRepo.find({
        relations: ['category'],
        order: { soldCount: 'DESC' },
        take: 250,
      }),
      this.orderRepo.find({ order: { createdAt: 'DESC' }, take: 500 }),
      this.promotionRepo.find(),
      this.promotionBookRepo.find({ relations: ['promotion'] }),
    ]);

    const activePromotionBookIds = new Set(
      promotionBooks
        .filter((item) => item.promotion && this.isPromotionEffective(item.promotion))
        .map((item) => item.bookId)
    );
    const completedOrders = orders.filter((order) => order.status === OrderStatus.COMPLETED);
    const cancelledOrders = orders.filter((order) => order.status === OrderStatus.CANCELLED);
    const cancelRate = orders.length > 0 ? Math.round((cancelledOrders.length / orders.length) * 100) : 0;
    const spentByCustomer = completedOrders.reduce((map, order) => {
      map.set(order.userId, (map.get(order.userId) || 0) + Number(order.totalAmount || 0));
      return map;
    }, new Map<string, number>());
    const vipCustomerCount = [...spentByCustomer.values()].filter((totalSpent) => totalSpent >= 5000000).length;
    const activePromotions = promotions.filter((promotion) => this.isPromotionEffective(promotion));
    const highStockSlowBooks = books
      .filter((book) => Number(book.stock || 0) >= 30 && Number(book.soldCount || 0) <= 5)
      .sort((left, right) => Number(right.stock || 0) - Number(left.stock || 0));
    const highStockBooks = books
      .filter((book) => Number(book.stock || 0) >= 20)
      .sort((left, right) => Number(right.stock || 0) - Number(left.stock || 0));
    const bestSellersWithoutPromo = books
      .filter((book) => Number(book.soldCount || 0) >= 10 && !activePromotionBookIds.has(book.id))
      .sort((left, right) => Number(right.soldCount || 0) - Number(left.soldCount || 0));
    const lowStockBooks = books.filter((book) => Number(book.stock || 0) > 0 && Number(book.stock || 0) <= 5);
    const now = Date.now();
    const newBooks = books
      .filter((book) => {
        const releaseTime = book.releaseDate ? new Date(book.releaseDate).getTime() : 0;
        const createdTime = book.createdAt ? new Date(book.createdAt).getTime() : 0;
        const signalTime = Math.max(releaseTime, createdTime);
        return signalTime > 0 && (now - signalTime) / 86400000 <= 60 && Number(book.stock || 0) > 0;
      })
      .sort((left, right) => {
        const leftTime = Math.max(left.releaseDate ? new Date(left.releaseDate).getTime() : 0, left.createdAt ? new Date(left.createdAt).getTime() : 0);
        const rightTime = Math.max(right.releaseDate ? new Date(right.releaseDate).getTime() : 0, right.createdAt ? new Date(right.createdAt).getTime() : 0);
        return rightTime - leftTime;
      });

    return {
      books,
      orders,
      promotions,
      activePromotionBookIds,
      completedOrders,
      cancelledOrders,
      highStockSlowBooks,
      highStockBooks,
      bestSellersWithoutPromo,
      lowStockBooks,
      newBooks,
      activePromotions,
      vipCustomerCount,
      cancelRate,
    };
  }

  private buildSummary(context: MarketingContext): AdminMarketingSummary {
    const totalSignals =
      context.completedOrders.length +
      context.activePromotions.length +
      context.bestSellersWithoutPromo.length +
      context.vipCustomerCount;
    const dataQuality: MarketingDataQuality =
      context.completedOrders.length >= 30 && totalSignals >= 8
        ? 'rich'
        : context.completedOrders.length >= 5 || totalSignals >= 3
        ? 'enough'
        : 'starter';

    return {
      dataQuality,
      totalBooks: context.books.length,
      completedOrders: context.completedOrders.length,
      activePromotions: context.activePromotions.length,
      highStockBooks: context.highStockBooks.length,
      bestSellerBooks: context.bestSellersWithoutPromo.length,
      lowStockBooks: context.lowStockBooks.length,
      newBooks: context.newBooks.length,
      vipCustomers: context.vipCustomerCount,
      cancelRate: context.cancelRate,
    };
  }

  private buildRecommendedPrograms(context: MarketingContext): AdminMarketingProgram[] {
    const programs: AdminMarketingProgram[] = [];
    const starterBooks = this.pickStarterBooks(context);

    if (context.completedOrders.length < 5 && starterBooks.length > 0) {
      programs.push({
        id: 'revenue-starter-campaign',
        title: 'Chiến dịch khởi động doanh thu',
        problem: 'Dữ liệu đơn hoàn thành còn ít nên chưa đủ tín hiệu để tối ưu sâu theo doanh thu.',
        recommendation: 'Chạy một chương trình ngắn với nhóm sách còn hàng, dễ mua và có giá vừa phải để tạo đơn hàng đầu tiên.',
        target: `${starterBooks.length} sách còn hàng, ưu tiên giá dễ tiếp cận`,
        discountPercent: 12,
        durationDays: 10,
        priority: 'high',
        actionType: 'create_promotion',
        bookIds: starterBooks.map((book) => book.id),
        reason: 'Phù hợp giai đoạn khởi động vì không cần lịch sử bán hàng dày vẫn có thể tạo nhu cầu mua thử.',
        expectedImpact: 'Tăng lượt mua ban đầu và tạo dữ liệu thật cho các phân tích marketing sau.',
      });
    }

    if (context.highStockSlowBooks.length > 0) {
      programs.push({
        id: 'inventory-smart-clearance',
        title: 'Chiến dịch xả tồn kho thông minh',
        problem: `${context.highStockSlowBooks.length} sách tồn cao nhưng bán chậm.`,
        recommendation: 'Tạo ưu đãi có thời hạn cho nhóm tồn kho cao, tránh áp dụng cho sách sắp hết hàng.',
        target: `${Math.min(12, context.highStockSlowBooks.length)} sách tồn cao bán chậm`,
        discountPercent: 20,
        durationDays: 14,
        priority: 'high',
        actionType: 'create_promotion',
        bookIds: context.highStockSlowBooks.slice(0, 12).map((book) => book.id),
        reason: `Sách ưu tiên: "${context.highStockSlowBooks[0].title}" đang có tồn kho cao và lượt bán thấp.`,
        expectedImpact: 'Giảm tồn, giải phóng vốn và tăng hiển thị cho nhóm sách ít được chú ý.',
      });
    } else if (context.highStockBooks.length > 0) {
      programs.push({
        id: 'inventory-stock-balance',
        title: 'Chiến dịch cân bằng tồn kho',
        problem: 'Có nhóm sách tồn kho cao nhưng chưa đủ tín hiệu bán chậm rõ ràng.',
        recommendation: 'Chạy ưu đãi nhẹ cho nhóm tồn nhiều để kiểm tra nhu cầu trước khi giảm sâu.',
        target: `${Math.min(10, context.highStockBooks.length)} sách tồn kho cao`,
        discountPercent: 10,
        durationDays: 10,
        priority: 'medium',
        actionType: 'create_promotion',
        bookIds: context.highStockBooks.slice(0, 10).map((book) => book.id),
        reason: 'Đây là bước thử thị trường hợp lý khi dữ liệu bán chưa đủ dày.',
        expectedImpact: 'Giúp phát hiện nhóm sách còn có nhu cầu trước khi quyết định xả tồn mạnh.',
      });
    }

    if (context.bestSellersWithoutPromo.length > 0) {
      programs.push({
        id: 'revenue-bestseller-boost',
        title: 'Chiến dịch sách bán chạy',
        problem: `${context.bestSellersWithoutPromo.length} sách bán tốt chưa nằm trong khuyến mãi đang chạy.`,
        recommendation: 'Đưa sách bán chạy lên chiến dịch/bảng nổi bật với mức giảm nhẹ, ưu tiên hiển thị hơn giảm sâu.',
        target: `${Math.min(8, context.bestSellersWithoutPromo.length)} sách bán chạy`,
        discountPercent: 8,
        durationDays: 7,
        priority: 'medium',
        actionType: 'create_promotion',
        bookIds: context.bestSellersWithoutPromo.slice(0, 8).map((book) => book.id),
        reason: `"${context.bestSellersWithoutPromo[0].title}" đang có ${Number(context.bestSellersWithoutPromo[0].soldCount || 0).toLocaleString('vi-VN')} lượt bán.`,
        expectedImpact: 'Tận dụng nhu cầu sẵn có để tăng chuyển đổi mà không làm giảm biên lợi nhuận quá mạnh.',
      });
    }

    if (context.newBooks.length > 0) {
      programs.push({
        id: 'revenue-new-arrivals',
        title: 'Chiến dịch sách mới',
        problem: 'Sách mới cần được đẩy hiển thị sớm để tạo nhận diện và lượt xem.',
        recommendation: 'Tạo chương trình ra mắt sách mới với mức giảm nhẹ hoặc chỉ dùng banner nổi bật.',
        target: `${Math.min(8, context.newBooks.length)} sách mới/cập nhật gần đây`,
        discountPercent: 7,
        durationDays: 10,
        priority: context.completedOrders.length < 5 ? 'medium' : 'low',
        actionType: 'create_promotion',
        bookIds: context.newBooks.slice(0, 8).map((book) => book.id),
        reason: 'Sách mới thường cần tín hiệu hiển thị ban đầu trước khi có dữ liệu bán hàng ổn định.',
        expectedImpact: 'Tăng lượt xem cho sách mới và tạo dữ liệu để quyết định nhập/thúc đẩy tiếp.',
      });
    }

    if (context.activePromotions.length === 0 && starterBooks.length > 0 && !programs.some((item) => item.id === 'revenue-starter-campaign')) {
      programs.push({
        id: 'promotion-first-active',
        title: 'Tạo chương trình khuyến mãi đang chạy',
        problem: 'Hiện chưa có chương trình khuyến mãi hiệu lực.',
        recommendation: 'Tạo một chương trình ngắn để trang khuyến mãi và banner có nội dung hoạt động.',
        target: `${starterBooks.length} sách còn hàng`,
        discountPercent: 10,
        durationDays: 10,
        priority: 'medium',
        actionType: 'create_promotion',
        bookIds: starterBooks.map((book) => book.id),
        reason: 'Một chương trình đang chạy giúp admin kiểm tra luồng khuyến mãi và tạo điểm nhấn cho khách hàng.',
        expectedImpact: 'Tăng tín hiệu mua thử và giảm cảm giác trang khuyến mãi trống.',
      });
    }

    if (context.vipCustomerCount > 0) {
      programs.push({
        id: 'customer-vip-care',
        title: 'Chăm sóc khách VIP',
        problem: `Có ${context.vipCustomerCount} khách hàng chi tiêu cao.`,
        recommendation: 'Chuẩn bị ưu đãi riêng hoặc gọi chăm sóc, không nên giảm đại trà giống chiến dịch xả tồn.',
        target: 'Khách hàng có tổng chi tiêu cao',
        discountPercent: 10,
        durationDays: 14,
        priority: 'medium',
        actionType: 'view_customers',
        bookIds: context.bestSellersWithoutPromo.slice(0, 6).map((book) => book.id),
        reason: 'Nhóm khách này phù hợp với quyền lợi riêng, gợi ý sách chọn lọc hoặc mã tri ân.',
        expectedImpact: 'Tăng mua lặp lại và giữ chân khách hàng có giá trị cao.',
      });
    }

    if (context.cancelRate >= 15) {
      programs.unshift({
        id: 'operation-cancel-rate',
        title: 'Ổn định vận hành trước khi chạy chiến dịch lớn',
        problem: `Tỷ lệ hủy đơn đang cao: ${context.cancelRate}%.`,
        recommendation: 'Kiểm tra quy trình xác nhận đơn, tồn kho, phí ship và phương thức thanh toán trước khi đẩy sale mạnh.',
        target: 'Đơn hàng bị hủy và đơn đang xử lý',
        discountPercent: 0,
        durationDays: 0,
        priority: 'high',
        actionType: 'view_orders',
        bookIds: [],
        reason: `${context.cancelledOrders.length}/${context.orders.length} đơn trong tập báo cáo bị hủy.`,
        expectedImpact: 'Giảm rủi ro chạy marketing tạo đơn nhưng không chuyển thành doanh thu thật.',
      });
    }

    if (context.lowStockBooks.length > 0) {
      programs.push({
        id: 'inventory-low-stock-guard',
        title: 'Không giảm sâu sách sắp hết hàng',
        problem: `${context.lowStockBooks.length} sách còn tồn rất thấp.`,
        recommendation: 'Rà soát nhóm này trước khi thêm vào khuyến mãi, ưu tiên nhập thêm hoặc tắt giảm giá sâu.',
        target: 'Sách tồn thấp',
        discountPercent: 0,
        durationDays: 0,
        priority: 'low',
        actionType: 'view_books',
        bookIds: context.lowStockBooks.slice(0, 10).map((book) => book.id),
        reason: 'Giảm giá mạnh cho sách tồn thấp dễ gây bán vượt tồn và trải nghiệm giao hàng kém.',
        expectedImpact: 'Bảo vệ tồn kho và giữ trải nghiệm khách hàng ổn định.',
      });
    }

    return programs.sort((left, right) => this.getPriorityScore(right.priority) - this.getPriorityScore(left.priority)).slice(0, 8);
  }

  private pickStarterBooks(context: MarketingContext): Book[] {
    const activeBookIds = context.activePromotionBookIds;
    return context.books
      .filter((book) => Number(book.stock || 0) > 5 && !activeBookIds.has(book.id))
      .sort((left, right) => {
        const leftPrice = Number(left.price || left.originalPrice || 0);
        const rightPrice = Number(right.price || right.originalPrice || 0);
        const leftScore = Number(left.soldCount || 0) * 3 + Math.max(0, 250000 - leftPrice) / 10000;
        const rightScore = Number(right.soldCount || 0) * 3 + Math.max(0, 250000 - rightPrice) / 10000;
        return rightScore - leftScore;
      })
      .slice(0, 10);
  }

  private buildDataNotes(summary: AdminMarketingSummary, programs: AdminMarketingProgram[]): string[] {
    const notes: string[] = [];
    if (summary.dataQuality === 'starter') {
      notes.push('Dữ liệu bán hàng còn ở giai đoạn khởi động, hệ thống ưu tiên đề xuất chương trình tạo đơn và kiểm tra nhu cầu.');
    }
    if (summary.completedOrders === 0) {
      notes.push('Chưa có đơn hoàn thành nên chưa thể đo hiệu quả doanh thu theo chiến dịch.');
    }
    if (summary.bestSellerBooks === 0) {
      notes.push('Chưa có đủ tín hiệu sách bán chạy, các đề xuất sẽ dựa nhiều hơn vào tồn kho và danh mục sách.');
    }
    if (summary.activePromotions === 0) {
      notes.push('Chưa có khuyến mãi đang chạy, nên tạo một chương trình ngắn để kích hoạt trang khuyến mãi.');
    }
    if (programs.length === 0) {
      notes.push('Chưa có sách phù hợp để tạo chương trình tự động. Hãy kiểm tra tồn kho và dữ liệu sách trước.');
    }
    return notes;
  }

  private buildFallbackDraft(program: AdminMarketingProgram, books: Book[]): AdminMarketingCampaignDraft {
    const today = new Date();
    const endsAt = new Date(today);
    endsAt.setDate(today.getDate() + Math.max(7, program.durationDays || 10));

    return {
      insightId: program.id,
      name: program.title,
      description: program.recommendation,
      discountPercent: program.discountPercent || 10,
      startsAt: this.formatDateInput(today),
      endsAt: this.formatDateInput(endsAt),
      status: PromotionStatus.ACTIVE,
      bookIds: books.slice(0, 12).map((book) => book.id),
      bannerImageUrl: this.getBannerImageUrl(program.id),
      aiGenerated: false,
    };
  }

  private async generateAiDraft(
    program: AdminMarketingProgram,
    books: Book[],
    fallbackDraft: AdminMarketingCampaignDraft
  ): Promise<AdminMarketingCampaignDraft | null> {
    const env = getEnv();
    if (!env.gemini.apiKey || books.length === 0) return null;

    const modelPath = env.gemini.generationModel.startsWith('models/')
      ? env.gemini.generationModel
      : `models/${env.gemini.generationModel}`;
    const url = `https://generativelanguage.googleapis.com/${env.gemini.apiVersion}/${modelPath}:generateContent?key=${env.gemini.apiKey}`;
    const bookContext = books
      .slice(0, 12)
      .map((book, index) => {
        return [
          `${index + 1}. id=${book.id}`,
          `Tên: ${book.title}`,
          `Tác giả: ${book.author || 'Chưa rõ'}`,
          `Danh mục: ${book.category?.name || 'Chưa phân loại'}`,
          `Giá: ${Number(book.price || 0).toLocaleString('vi-VN')}đ`,
          `Tồn: ${Number(book.stock || 0)}`,
          `Đã bán: ${Number(book.soldCount || 0)}`,
        ].join('\n');
      })
      .join('\n\n');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.45,
            topP: 0.9,
            maxOutputTokens: 700,
          },
          contents: [
            {
              parts: [
                {
                  text: [
                    'Bạn là chuyên viên marketing cho nhà sách Việt Nam.',
                    'Hãy tạo bản nháp chương trình khuyến mãi dựa trên vấn đề kinh doanh và danh sách sách có sẵn.',
                    'Không được bịa id sách. Không cần trả bookIds.',
                    'Tên ngắn, dễ dùng làm banner. Mô tả tối đa 2 câu, tự nhiên, không phóng đại.',
                    'discountPercent phải từ 5 đến 30. Nếu chương trình đề xuất giảm 0 thì vẫn chọn 5-10 cho bản nháp khuyến mãi.',
                    'Trả về JSON thuần theo schema: {"name":"...","description":"...","discountPercent":15}',
                    `Chương trình: ${program.title}`,
                    `Vấn đề: ${program.problem}`,
                    `Hướng làm: ${program.recommendation}`,
                    `Mục tiêu: ${program.target}`,
                    `Sách:\n${bookContext}`,
                  ].join('\n'),
                },
              ],
            },
          ],
        }),
      });
      if (!response.ok) return null;

      const payload = (await response.json()) as GeminiTextResponse;
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
      const parsed = text ? this.parseAiDraft(text) : null;
      if (!parsed) return null;

      return {
        ...fallbackDraft,
        name: parsed.name || fallbackDraft.name,
        description: parsed.description || fallbackDraft.description,
        discountPercent: this.clampDiscount(parsed.discountPercent, fallbackDraft.discountPercent),
        aiGenerated: true,
      };
    } catch (error) {
      console.warn('AI marketing draft generation failed, fallback to deterministic draft:', error);
      return null;
    }
  }

  private parseAiDraft(text: string): { name?: string; description?: string; discountPercent?: number } | null {
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      const parsed = JSON.parse(match[0]) as { name?: unknown; description?: unknown; discountPercent?: unknown };
      return {
        name: typeof parsed.name === 'string' ? parsed.name.trim().slice(0, 120) : undefined,
        description: typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 500) : undefined,
        discountPercent: Number(parsed.discountPercent),
      };
    } catch {
      return null;
    }
  }

  private clampDiscount(value: number, fallback: number): number {
    if (!Number.isFinite(value)) return fallback || 10;
    return Math.min(30, Math.max(5, Math.round(value)));
  }

  private isPromotionEffective(promotion: Promotion): boolean {
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

  private formatDateInput(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private getPriorityScore(priority: MarketingPriority): number {
    return { high: 3, medium: 2, low: 1 }[priority];
  }

  private getBannerImageUrl(programId: string): string {
    if (programId.includes('inventory')) {
      return 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=1440';
    }
    if (programId.includes('new')) {
      return 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?q=80&w=1440';
    }

    return 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1440';
  }
}
