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
type MarketingCategory = 'inventory' | 'revenue' | 'customer' | 'alert';

interface GeminiTextResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export interface AdminMarketingInsight {
  id: string;
  category: MarketingCategory;
  title: string;
  reason: string;
  impact: string;
  priority: MarketingPriority;
  actionType: 'create_promotion' | 'view_books' | 'view_customers' | 'view_orders';
  suggestedBookIds: string[];
  metrics: Record<string, number | string>;
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

  async listInsights(): Promise<AdminMarketingInsight[]> {
    const [books, orders, promotions, promotionBooks] = await Promise.all([
      this.bookRepo.find({
        relations: ['category'],
        order: { soldCount: 'DESC' },
        take: 200,
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
    const revenue = completedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const cancelRate = orders.length > 0 ? Math.round((cancelledOrders.length / orders.length) * 100) : 0;
    const spentByCustomer = completedOrders.reduce((map, order) => {
      map.set(order.userId, (map.get(order.userId) || 0) + Number(order.totalAmount || 0));
      return map;
    }, new Map<string, number>());
    const vipCustomerCount = [...spentByCustomer.values()].filter((totalSpent) => totalSpent >= 5000000).length;

    const highStockSlowBooks = books
      .filter((book) => Number(book.stock || 0) >= 30 && Number(book.soldCount || 0) <= 5)
      .sort((left, right) => Number(right.stock || 0) - Number(left.stock || 0));
    const bestSellersWithoutPromo = books
      .filter((book) => Number(book.soldCount || 0) >= 10 && !activePromotionBookIds.has(book.id))
      .sort((left, right) => Number(right.soldCount || 0) - Number(left.soldCount || 0));
    const lowStockBooks = books.filter((book) => Number(book.stock || 0) <= 5);
    const activePromotions = promotions.filter((promotion) => this.isPromotionEffective(promotion));

    const insights: Array<AdminMarketingInsight | false> = [
      highStockSlowBooks.length > 0 && {
        id: 'inventory-slow-stock',
        category: 'inventory',
        title: `${highStockSlowBooks.length} sách tồn cao, bán chậm`,
        reason: `Tồn kho cao nhưng lượt bán thấp. Nên ưu tiên "${highStockSlowBooks[0].title}".`,
        impact: 'Giảm tồn kho, giải phóng vốn và tạo thêm lưu lượng truy cập cho nhóm sách ít được chú ý.',
        priority: 'high',
        actionType: 'create_promotion',
        suggestedBookIds: highStockSlowBooks.slice(0, 12).map((book) => book.id),
        metrics: {
          bookCount: highStockSlowBooks.length,
          topStock: Number(highStockSlowBooks[0].stock || 0),
        },
      },
      bestSellersWithoutPromo.length > 0 && {
        id: 'revenue-bestseller-banner',
        category: 'revenue',
        title: `${bestSellersWithoutPromo.length} sách bán chạy nên đưa lên chiến dịch`,
        reason: `"${bestSellersWithoutPromo[0].title}" đang có ${Number(bestSellersWithoutPromo[0].soldCount || 0).toLocaleString('vi-VN')} lượt bán.`,
        impact: 'Tăng tỷ lệ click và tận dụng nhu cầu sẵn có từ nhóm sách đang bán tốt.',
        priority: 'medium',
        actionType: 'create_promotion',
        suggestedBookIds: bestSellersWithoutPromo.slice(0, 8).map((book) => book.id),
        metrics: {
          bookCount: bestSellersWithoutPromo.length,
          topSoldCount: Number(bestSellersWithoutPromo[0].soldCount || 0),
        },
      },
      vipCustomerCount > 0 && {
        id: 'customer-vip-care',
        category: 'customer',
        title: 'Có khách VIP nên chăm sóc riêng',
        reason: 'Một nhóm khách hàng có tổng chi tiêu cao, phù hợp với ưu đãi riêng hoặc quyền lợi thành viên.',
        impact: 'Tăng mua lặp lại và giữ chân khách hàng giá trị cao.',
        priority: 'high',
        actionType: 'view_customers',
        suggestedBookIds: bestSellersWithoutPromo.slice(0, 6).map((book) => book.id),
        metrics: {
          customerCount: vipCustomerCount,
        },
      },
      cancelRate >= 15 && {
        id: 'alert-cancel-rate',
        category: 'alert',
        title: `Tỷ lệ hủy đơn đang cao: ${cancelRate}%`,
        reason: `${cancelledOrders.length}/${orders.length} đơn trong tập báo cáo bị hủy.`,
        impact: 'Cần xem lại xác nhận đơn, tồn kho, phí ship hoặc phương thức thanh toán trước khi đẩy chiến dịch lớn.',
        priority: 'high',
        actionType: 'view_orders',
        suggestedBookIds: [],
        metrics: {
          cancelRate,
          cancelledOrders: cancelledOrders.length,
          totalOrders: orders.length,
        },
      },
      revenue === 0 && orders.length > 0 && {
        id: 'alert-no-completed-revenue',
        category: 'alert',
        title: 'Chưa có doanh thu hoàn thành',
        reason: 'Có đơn hàng nhưng chưa có đơn ở trạng thái hoàn thành.',
        impact: 'Nên ưu tiên xử lý đơn đang chờ trước khi mở thêm chiến dịch marketing.',
        priority: 'high',
        actionType: 'view_orders',
        suggestedBookIds: [],
        metrics: {
          totalOrders: orders.length,
        },
      },
      lowStockBooks.length > 0 && {
        id: 'inventory-low-stock',
        category: 'inventory',
        title: 'Có sách sắp hết hàng',
        reason: 'Một số sách tồn kho rất thấp, không nên đẩy khuyến mãi mạnh.',
        impact: 'Tránh bán vượt tồn và giữ trải nghiệm khách hàng.',
        priority: 'low',
        actionType: 'view_books',
        suggestedBookIds: lowStockBooks.slice(0, 10).map((book) => book.id),
        metrics: {
          bookCount: lowStockBooks.length,
        },
      },
      activePromotions.length === 0 && books.length > 0 && {
        id: 'revenue-no-active-promotion',
        category: 'revenue',
        title: 'Chưa có chương trình khuyến mãi đang chạy',
        reason: 'Không có chương trình khuyến mãi hiệu lực trong thời điểm hiện tại.',
        impact: 'Có thể tạo một chiến dịch ngắn hạn để tăng lượt xem và kích hoạt nhu cầu mua.',
        priority: 'medium',
        actionType: 'create_promotion',
        suggestedBookIds: books.slice(0, 8).map((book) => book.id),
        metrics: {
          bookCount: books.length,
        },
      },
    ];

    return insights.filter(Boolean) as AdminMarketingInsight[];
  }

  async generateCampaignDraft(insightId: string): Promise<AdminMarketingCampaignDraft> {
    const insights = await this.listInsights();
    const insight = insights.find((item) => item.id === insightId);
    if (!insight) {
      throw new ValidationError('Gợi ý marketing không tồn tại hoặc không còn phù hợp');
    }
    if (insight.suggestedBookIds.length === 0) {
      throw new ValidationError('Gợi ý này chưa có danh sách sách phù hợp để tạo khuyến mãi');
    }

    const books = await this.bookRepo.find({
      where: { id: In(insight.suggestedBookIds) },
      relations: ['category'],
    });
    const orderedBooks = insight.suggestedBookIds
      .map((id) => books.find((book) => book.id === id))
      .filter(Boolean) as Book[];
    const fallbackDraft = this.buildFallbackDraft(insight, orderedBooks);
    const aiDraft = await this.generateAiDraft(insight, orderedBooks, fallbackDraft);

    return aiDraft || fallbackDraft;
  }

  private buildFallbackDraft(insight: AdminMarketingInsight, books: Book[]): AdminMarketingCampaignDraft {
    const today = new Date();
    const endsAt = new Date(today);
    endsAt.setDate(today.getDate() + 14);
    const mainCategory = books[0]?.category?.name || 'sách hay';
    const isInventoryCampaign = insight.id.startsWith('inventory');
    const discountPercent = isInventoryCampaign ? 20 : 12;

    return {
      insightId: insight.id,
      name: isInventoryCampaign ? `Ưu đãi xả kho ${mainCategory}` : `Ưu đãi sách bán chạy`,
      description: isInventoryCampaign
        ? `Chọn lọc các đầu sách còn nhiều tồn kho với mức giá tốt hơn trong thời gian ngắn.`
        : `Tập hợp những đầu sách đang được quan tâm để khách hàng dễ chọn mua hơn.`,
      discountPercent,
      startsAt: this.formatDateInput(today),
      endsAt: this.formatDateInput(endsAt),
      status: PromotionStatus.ACTIVE,
      bookIds: books.slice(0, 12).map((book) => book.id),
      bannerImageUrl: this.getBannerImageUrl(insight.id),
      aiGenerated: false,
    };
  }

  private async generateAiDraft(
    insight: AdminMarketingInsight,
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
                    'Hãy tạo bản nháp chương trình khuyến mãi dựa trên insight và danh sách sách có sẵn.',
                    'Không được bịa id sách. Chỉ dùng bookIds trong danh sách.',
                    'Tên ngắn, dễ dùng làm banner. Mô tả tối đa 2 câu, tự nhiên, không phóng đại.',
                    'discountPercent phải từ 5 đến 30. Nếu là xả tồn kho, ưu tiên 15-25. Nếu là bestseller, ưu tiên 8-15.',
                    'Trả về JSON thuần theo schema: {"name":"...","description":"...","discountPercent":15}',
                    `Insight: ${insight.title}. Lý do: ${insight.reason}. Tác động: ${insight.impact}.`,
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
    if (!Number.isFinite(value)) return fallback;
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

  private getBannerImageUrl(insightId: string): string {
    if (insightId.startsWith('inventory')) {
      return 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=1440';
    }

    return 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1440';
  }
}
