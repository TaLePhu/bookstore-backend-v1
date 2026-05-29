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

interface AiBookSelection {
  answer: string;
  recommendations: Array<{
    id: string;
    reason: string;
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
    const safeLimit = Math.min(6, Math.max(1, limit));
    const targetCount = this.getTargetRecommendationCount(normalizedQuestion, safeLimit);
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
      Math.max(targetCount, safeLimit),
      safeExcludeBookIds,
      allowReuseFromPrevious
    );

    const selection = await this.generateSelection(normalizedQuestion, candidateBooks, targetCount, safeHistory);
    return this.reconcileSelection(normalizedQuestion, selection, candidateBooks, targetCount);
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
      const previousUserNeeds = history
        .filter((message) => message.role === 'user')
        .slice(-2)
        .map((message) => message.content)
        .join(' ');
      return [previousUserNeeds, question].filter(Boolean).join(' ').slice(0, 1200);
    }

    const previousUserNeeds = history
      .filter((message) => message.role === 'user')
      .slice(-1)
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

  private getTargetRecommendationCount(question: string, requestedLimit: number): number {
    const normalizedQuestion = this.normalizeText(question);
    const explicitNumber = normalizedQuestion.match(/\b([1-6])\b/);
    if (explicitNumber) {
      return Math.min(requestedLimit, Math.max(1, Number(explicitNumber[1])));
    }

    if (/(mot cuon|1 cuon|duy nhat|tot nhat|phu hop nhat|nen doc cuon nao)/.test(normalizedQuestion)) {
      return 1;
    }

    if (/(hai cuon|2 cuon|cap doi)/.test(normalizedQuestion)) {
      return Math.min(requestedLimit, 2);
    }

    if (/(nhieu|vai cuon|danh sach|goi y|lua chon)/.test(normalizedQuestion)) {
      return Math.min(requestedLimit, 4);
    }

    return Math.min(requestedLimit, 3);
  }

  private async findCandidateBooks(
    query: string,
    limit: number,
    excludeBookIds: string[],
    allowReuseFromPrevious: boolean
  ): Promise<BookResponse[]> {
    const effectiveExcludeBookIds = allowReuseFromPrevious ? [] : excludeBookIds;
    const candidateLimit = Math.min(40, Math.max(limit * 5, 15));
    const semanticResult = await this.bookService.semanticSearchBooks(query, 1, candidateLimit, 0.25);

    if (semanticResult.data.length > 0) {
      const freshSemantic = semanticResult.data.filter((book) => !excludeBookIds.includes(book.id));
      if (allowReuseFromPrevious) {
        const reusedSemantic = semanticResult.data.filter((book) => excludeBookIds.includes(book.id));
        return this.mixFreshAndReusedBooks(freshSemantic, reusedSemantic, candidateLimit);
      }

      const filteredSemantic = semanticResult.data.filter((book) => !effectiveExcludeBookIds.includes(book.id));
      if (filteredSemantic.length > 0) {
        return filteredSemantic.slice(0, candidateLimit);
      }
    }

    const keywordResult = await this.bookRepository.searchKeywordExtended(query, 1, candidateLimit);
    const filteredKeyword = keywordResult.data.filter((book) => !effectiveExcludeBookIds.includes(book.id));
    if (filteredKeyword.length > 0) {
      return filteredKeyword.slice(0, candidateLimit);
    }

    const fallback = await this.bookRepository.findAllWithFilters({
      page: 1,
      limit: candidateLimit,
      sort: 'bestseller',
    });

    const filteredFallback = fallback.data.filter((book) => !effectiveExcludeBookIds.includes(book.id));
    return (filteredFallback.length > 0 ? filteredFallback : fallback.data).slice(0, candidateLimit);
  }

  private mixFreshAndReusedBooks(
    freshBooks: BookResponse[],
    reusedBooks: BookResponse[],
    limit: number
  ): BookResponse[] {
    if (limit <= 1) {
      return (freshBooks[0] ? [freshBooks[0]] : reusedBooks.slice(0, 1));
    }

    const freshTarget = Math.max(1, Math.ceil(limit * 0.8));
    const selectedFresh = freshBooks.slice(0, freshTarget);
    const selectedReused = reusedBooks
      .filter((book) => !selectedFresh.some((fresh) => fresh.id === book.id))
      .slice(0, limit - selectedFresh.length);

    const merged = [...selectedFresh, ...selectedReused];
    const topup = [...freshBooks, ...reusedBooks].filter((book) => !merged.some((picked) => picked.id === book.id));
    return [...merged, ...topup].slice(0, limit);
  }

  private buildFallbackReason(query: string, book: BookResponse): string {
    const categoryName = book.category?.name ? ` thuộc nhóm ${book.category.name}` : '';
    const author = book.author ? ` của ${book.author}` : '';
    return `Phù hợp với nhu cầu "${query}" vì sách${categoryName}${author} có nội dung gần với điều bạn đang tìm.`;
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseJsonSelection(text: string): AiBookSelection | null {
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      const parsed = JSON.parse(match[0]) as AiBookSelection;
      if (typeof parsed.answer !== 'string' || !Array.isArray(parsed.recommendations)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private async generateSelection(
    question: string,
    candidateBooks: BookResponse[],
    targetCount: number,
    history: AdvisorHistoryMessage[]
  ): Promise<AiBookSelection | null> {
    if (!this.apiKey || candidateBooks.length === 0) {
      return null;
    }

    const modelPath = this.model.startsWith('models/') ? this.model : `models/${this.model}`;
    const url = `https://generativelanguage.googleapis.com/${this.apiVersion}/${modelPath}:generateContent?key=${this.apiKey}`;
    const bookContext = candidateBooks
      .map((book, index) => {
        const categoryName = book.category?.name || 'Chưa phân loại';
        const price = Number(book.price || 0).toLocaleString('vi-VN');
        const stock = Number(book.stock || 0) > 0 ? 'còn hàng' : 'hết hàng';
        return [
          `${index + 1}. id=${book.id}`,
          `Tên: ${book.title}`,
          `Tác giả: ${book.author || 'Chưa rõ'}`,
          `Danh mục: ${categoryName}`,
          `Giá: ${price}đ`,
          `Tình trạng: ${stock}`,
          `Mô tả: ${(book.description || '').slice(0, 700)}`,
        ].join('\n');
      })
      .join('\n\n');
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
          generationConfig: {
            temperature: 0.35,
            topP: 0.8,
            maxOutputTokens: 900,
          },
          contents: [
            {
              parts: [
                {
                  text: [
                    'Bạn là trợ lý tư vấn sách cho một nhà sách Việt Nam.',
                    'Nhiệm vụ: chọn đúng sách trong kho dựa trên nhu cầu mới nhất và lịch sử hội thoại.',
                    `Hãy chọn đúng ${targetCount} sách. Nếu chỉ có ít sách phù hợp, chọn ít hơn.`,
                    'Chỉ được dùng id sách có trong danh sách ứng viên. Không bịa tên sách, tác giả hoặc id.',
                    'Câu trả lời phải nhắc đúng các sách trong recommendations, không nhắc sách ngoài danh sách đó.',
                    'Nếu recommendations có 1 sách thì câu trả lời chỉ nói về 1 sách. Nếu có nhiều sách thì nói rõ từng sách rất ngắn gọn.',
                    'Ưu tiên: đúng chủ đề người dùng hỏi, còn hàng, mô tả sát nhu cầu, không trùng sách đã gợi ý trước trừ khi khách muốn tương tự.',
                    'Trả về JSON thuần, không markdown, không giải thích ngoài JSON.',
                    'Schema:',
                    '{"answer":"câu trả lời tiếng Việt tự nhiên 2-4 câu","recommendations":[{"id":"book-id","reason":"lý do ngắn, cụ thể theo nhu cầu"}]}',
                    `Lịch sử hội thoại:\n${historyContext}`,
                    `Tin nhắn mới nhất của khách: ${question}`,
                    `Danh sách ứng viên trong kho:\n${bookContext}`,
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

      return text ? this.parseJsonSelection(text) : null;
    } catch (error) {
      console.warn('AI advisor generation failed, fallback to deterministic answer:', error);
      return null;
    }
  }

  private reconcileSelection(
    question: string,
    selection: AiBookSelection | null,
    candidateBooks: BookResponse[],
    targetCount: number
  ): AdvisorResponse {
    if (candidateBooks.length === 0) {
      return {
        answer: 'Mình chưa tìm thấy cuốn nào thật sự khớp. Bạn thử mô tả rõ hơn về thể loại, tác giả, tâm trạng hoặc mục tiêu đọc nhé.',
        books: [],
      };
    }

    const candidatesById = new Map(candidateBooks.map((book) => [book.id, book]));
    const selected: AdvisorRecommendation[] = [];

    if (selection) {
      for (const item of selection.recommendations) {
        const book = candidatesById.get(item.id);
        if (!book || selected.some((selectedBook) => selectedBook.id === book.id)) continue;

        selected.push({
          ...book,
          reason: item.reason?.trim() || this.buildFallbackReason(question, book),
        });

        if (selected.length >= targetCount) break;
      }
    }

    if (selected.length === 0) {
      selected.push(
        ...candidateBooks.slice(0, targetCount).map((book) => ({
          ...book,
          reason: this.buildFallbackReason(question, book),
        }))
      );
    }

    const answer = selection?.answer?.trim()
      ? this.ensureAnswerMatchesBooks(selection.answer.trim(), selected)
      : this.buildFallbackAnswer(question, selected);

    return { answer, books: selected };
  }

  private ensureAnswerMatchesBooks(answer: string, books: AdvisorRecommendation[]): string {
    const normalizedAnswer = this.normalizeText(answer);
    const allMentioned = books.every((book) => normalizedAnswer.includes(this.normalizeText(book.title)));

    if (allMentioned) {
      return answer;
    }

    return this.buildFallbackAnswer('', books);
  }

  private buildFallbackAnswer(question: string, books: AdvisorRecommendation[]): string {
    if (books.length === 0) {
      return 'Mình chưa tìm thấy cuốn nào thật sự khớp. Bạn thử mô tả rõ hơn về thể loại, tác giả, tâm trạng hoặc mục tiêu đọc nhé.';
    }

    if (books.length === 1) {
      return `Mình gợi ý "${books[0].title}" vì đây là lựa chọn sát nhất với nhu cầu${question ? ` "${question}"` : ''}. Bạn có thể xem phần thông tin sách bên dưới để kiểm tra giá, tác giả và tình trạng còn hàng.`;
    }

    const titles = books.map((book) => `"${book.title}"`).join(', ');
    return `Mình gợi ý ${titles} vì các cuốn này khớp nhất với nhu cầu${question ? ` "${question}"` : ''} trong kho hiện có. Mỗi thẻ sách bên dưới có lý do riêng để bạn so sánh nhanh trước khi chọn.`;
  }
}
