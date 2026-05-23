import { inject, injectable } from 'tsyringe';
import { TOKENS } from '@config/container';
import { getEnv } from '@config/env';
import { BookResponse } from '@dtos/book/BookResponseDto';
import { IBookRepository } from '@repositories/interfaces/IBookRepository';
import { BookService } from '@services/BookService';

interface GeminiTextResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export interface AdvisorRecommendation extends BookResponse {
  reason: string;
}

export interface AdvisorHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AdvisorResponse {
  answer: string;
  books: AdvisorRecommendation[];
}

@injectable()
export class AIAdvisorService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiVersion: string;

  constructor(
    private bookService: BookService,
    @inject(TOKENS.BOOK_REPOSITORY) private bookRepository: IBookRepository
  ) {
    const env = getEnv();
    this.apiKey = env.gemini.apiKey;
    this.model = env.gemini.generationModel;
    this.apiVersion = env.gemini.apiVersion;
  }

  async advise(
    question: string,
    limit: number = 4,
    history: AdvisorHistoryMessage[] = [],
    excludeBookIds: string[] = []
  ): Promise<AdvisorResponse> {
    const normalizedQuestion = question.trim();
    const safeLimit = Math.min(8, Math.max(1, limit));
    const safeHistory = this.normalizeHistory(history);
    const safeExcludeBookIds = this.normalizeExcludeBookIds(excludeBookIds);
    const allowReuseFromPrevious = this.shouldAllowReuseFromPrevious(normalizedQuestion);

    if (!normalizedQuestion) {
      return {
        answer: 'Bạn hãy cho mình biết thể loại, mục tiêu đọc hoặc một cuốn sách bạn từng thích nhé.',
        books: [],
      };
    }

    const searchQuery = this.buildSearchQuery(normalizedQuestion, safeHistory);
    const candidateBooks = await this.findCandidateBooks(
      searchQuery,
      safeLimit,
      safeExcludeBookIds,
      allowReuseFromPrevious
    );
    const books = candidateBooks.map((book) => ({
      ...book,
      reason: this.buildFallbackReason(normalizedQuestion, book),
    }));

    const rawAnswer = await this.generateAnswer(normalizedQuestion, books, safeHistory);
    const { answer, books: consistentBooks } = this.reconcileAnswerAndBooks(
      normalizedQuestion,
      rawAnswer,
      books
    );

    return { answer, books: consistentBooks };
  }

  private normalizeHistory(history: AdvisorHistoryMessage[]): AdvisorHistoryMessage[] {
    if (!Array.isArray(history)) return [];

    return history
      .filter((message) => {
        const roleIsValid = message?.role === 'user' || message?.role === 'assistant';
        return roleIsValid && typeof message.content === 'string' && message.content.trim() !== '';
      })
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, 800),
      }));
  }

  private buildSearchQuery(question: string, history: AdvisorHistoryMessage[]): string {
    const normalizedQuestion = this.normalizeText(question);
    const wantsAlternative = /(khac|goi y khac|doi|thay|them|khong trung|moi hon|re hon|nhe hon)/.test(normalizedQuestion);

    if (wantsAlternative) {
      return question.slice(0, 1200);
    }

    const previousUserNeeds = history
      .filter((message) => message.role === 'user')
      .slice(-2)
      .map((message) => message.content)
      .join(' ');

    return [previousUserNeeds, question].filter(Boolean).join(' ').slice(0, 1200);
  }

  private shouldAllowReuseFromPrevious(question: string): boolean {
    const normalizedQuestion = this.normalizeText(question);
    return /(giu tieu chi cu|giu nhu cu|nhu truoc|giong truoc|tuong tu|van tieu chi do|cu nhu vay)/.test(
      normalizedQuestion
    );
  }

  private normalizeExcludeBookIds(excludeBookIds: string[]): string[] {
    if (!Array.isArray(excludeBookIds)) return [];
    return [...new Set(excludeBookIds.filter((id) => typeof id === 'string').map((id) => id.trim()).filter(Boolean))].slice(-30);
  }

  private async findCandidateBooks(
    query: string,
    limit: number,
    excludeBookIds: string[],
    allowReuseFromPrevious: boolean
  ): Promise<BookResponse[]> {
    const effectiveExcludeBookIds = allowReuseFromPrevious ? [] : excludeBookIds;
    const semanticLimit = Math.min(40, Math.max(limit * 4, 12));
    const semanticResult = await this.bookService.semanticSearchBooks(query, 1, semanticLimit, 0.3);

    if (semanticResult.data.length > 0) {
      const freshSemantic = semanticResult.data.filter((book) => !excludeBookIds.includes(book.id));
      if (allowReuseFromPrevious) {
        const reusedSemantic = semanticResult.data.filter((book) => excludeBookIds.includes(book.id));
        return this.mixFreshAndReusedBooks(freshSemantic, reusedSemantic, limit);
      }

      const filteredSemantic = semanticResult.data.filter((book) => !effectiveExcludeBookIds.includes(book.id));
      if (filteredSemantic.length > 0) {
        return filteredSemantic.slice(0, limit);
      }
    }

    const fallback = await this.bookRepository.findAllWithFilters({
      page: 1,
      limit: Math.min(40, Math.max(limit * 4, 12)),
      sort: 'bestseller',
    });

    const filteredFallback = fallback.data.filter((book) => !effectiveExcludeBookIds.includes(book.id));
    if (filteredFallback.length > 0) {
      if (allowReuseFromPrevious) {
        const freshFallback = fallback.data.filter((book) => !excludeBookIds.includes(book.id));
        const reusedFallback = fallback.data.filter((book) => excludeBookIds.includes(book.id));
        return this.mixFreshAndReusedBooks(freshFallback, reusedFallback, limit);
      }
      return filteredFallback.slice(0, limit);
    }

    // If all candidates were excluded, allow reusing best available books.
    return semanticResult.data.slice(0, limit).length > 0
      ? semanticResult.data.slice(0, limit)
      : fallback.data.slice(0, limit);
  }

  private mixFreshAndReusedBooks(
    freshBooks: BookResponse[],
    reusedBooks: BookResponse[],
    limit: number
  ): BookResponse[] {
    if (limit <= 1) {
      return (freshBooks[0] ? [freshBooks[0]] : reusedBooks.slice(0, 1));
    }

    const freshTarget = Math.max(1, Math.ceil(limit * 0.7));
    const reusedTarget = Math.max(0, limit - freshTarget);

    const selectedFresh = freshBooks.slice(0, freshTarget);
    const selectedReused = reusedBooks
      .filter((book) => !selectedFresh.some((fresh) => fresh.id === book.id))
      .slice(0, reusedTarget);

    const merged = [...selectedFresh, ...selectedReused];
    if (merged.length >= limit) {
      return merged.slice(0, limit);
    }

    const topupFresh = freshBooks.filter((book) => !merged.some((picked) => picked.id === book.id));
    const topupReused = reusedBooks.filter((book) => !merged.some((picked) => picked.id === book.id));
    return [...merged, ...topupFresh, ...topupReused].slice(0, limit);
  }

  private buildFallbackReason(query: string, book: BookResponse): string {
    const categoryName = book.category?.name ? ` thuộc nhóm ${book.category.name}` : '';
    return `Phù hợp với nhu cầu "${query}" vì sách${categoryName} có nội dung gần với chủ đề bạn đang tìm.`;
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private findFirstMentionedBookIndex(answer: string, books: AdvisorRecommendation[]): number {
    const normalizedAnswer = this.normalizeText(answer);
    return books.findIndex((book) => normalizedAnswer.includes(this.normalizeText(book.title)));
  }

  private reconcileAnswerAndBooks(
    question: string,
    answer: string,
    books: AdvisorRecommendation[]
  ): AdvisorResponse {
    if (books.length === 0) {
      return { answer: this.buildFallbackAnswer(question, books), books };
    }

    const mentionedBookIndex = this.findFirstMentionedBookIndex(answer, books);

    if (mentionedBookIndex === -1) {
      return {
        answer: this.buildFallbackAnswer(question, books),
        books,
      };
    }

    if (mentionedBookIndex === 0) {
      return { answer, books };
    }

    const reorderedBooks = [
      books[mentionedBookIndex],
      ...books.filter((_, index) => index !== mentionedBookIndex),
    ];

    return { answer, books: reorderedBooks };
  }

  private async generateAnswer(
    question: string,
    books: AdvisorRecommendation[],
    history: AdvisorHistoryMessage[]
  ): Promise<string> {
    if (!this.apiKey || books.length === 0) {
      return this.buildFallbackAnswer(question, books);
    }

    const modelPath = this.model.startsWith('models/') ? this.model : `models/${this.model}`;
    const url = `https://generativelanguage.googleapis.com/${this.apiVersion}/${modelPath}:generateContent?key=${this.apiKey}`;
    const bookContext = books
      .map((book, index) => {
        const categoryName = book.category?.name || 'Chưa phân loại';
        return `${index + 1}. ${book.title} - ${book.author} | ${categoryName} | ${book.description || ''}`;
      })
      .join('\n');
    const historyContext = history.length > 0
      ? history.map((message) => {
          const label = message.role === 'user' ? 'Khách' : 'Trợ lý';
          return `${label}: ${message.content}`;
        }).join('\n')
      : 'Chưa có lịch sử hội thoại.';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: [
                    'Bạn là trợ lý tư vấn sách cho một nhà sách Việt Nam.',
                    'Trả lời bằng tiếng Việt, thân thiện, tự nhiên như đang trò chuyện liên tục với khách.',
                    'Ghi nhớ các sở thích, ràng buộc và phản hồi trước đó của khách trong lịch sử hội thoại.',
                    'Nếu khách hỏi tiếp kiểu "còn cuốn nào khác", "nhẹ hơn", "rẻ hơn", hãy hiểu dựa trên lịch sử.',
                    'Trả lời ngắn gọn trong 2-4 câu, có thể hỏi thêm 1 câu nếu thiếu thông tin.',
                    'Chỉ dựa trên danh sách sách được cung cấp, không bịa sách ngoài kho.',
                    'Khi nêu tên sách, chỉ nêu đúng tên sách trong danh sách. Ưu tiên giới thiệu sách số 1 trước.',
                    'Câu trả lời phải khớp với các sách sẽ hiển thị bên dưới.',
                    `Lịch sử hội thoại:\n${historyContext}`,
                    `Tin nhắn mới nhất của khách: ${question}`,
                    `Sách có thể gợi ý từ kho:\n${bookContext}`,
                  ].join('\n'),
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini generation failed: ${response.status}`);
      }

      const payload = (await response.json()) as GeminiTextResponse;
      const text = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('')
        .trim();

      return text || this.buildFallbackAnswer(question, books);
    } catch (error) {
      console.warn('AI advisor generation failed, fallback to deterministic answer:', error);
      return this.buildFallbackAnswer(question, books);
    }
  }

  private buildFallbackAnswer(question: string, books: AdvisorRecommendation[]): string {
    if (books.length === 0) {
      return 'Mình chưa tìm thấy cuốn nào thật khớp. Bạn thử mô tả rõ hơn về thể loại, tác giả, tâm trạng hoặc mục tiêu đọc nhé.';
    }

    const titles = books.slice(0, 3).map((book) => `"${book.title}"`).join(', ');
    return `Dựa trên nhu cầu "${question}", mình gợi ý ${titles} từ kho sách hiện có. Bạn có thể bắt đầu với "${books[0].title}" vì đây là lựa chọn phù hợp nhất trong danh sách đang hiển thị bên dưới.`;
  }
}
