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

interface CandidateSearchResult {
  books: BookResponse[];
  isAlternative: boolean;
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

    const effectiveQuestion = this.buildEffectiveQuestion(normalizedQuestion, safeHistory);
    const searchQuery = this.buildSearchQuery(effectiveQuestion, safeHistory);
    const candidateResult = await this.findCandidateBooks(
      searchQuery,
      Math.max(targetCount, safeLimit),
      safeExcludeBookIds,
      allowReuseFromPrevious
    );
    const candidateBooks = candidateResult.books;

    const selection = await this.generateSelection(effectiveQuestion, normalizedQuestion, candidateBooks, targetCount, safeHistory);
    return this.reconcileSelection(effectiveQuestion, selection, candidateBooks, targetCount, candidateResult.isAlternative);
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
        content: message.content.trim().slice(0, 1200),
      }));
  }

  private buildSearchQuery(question: string, history: AdvisorHistoryMessage[]): string {
    const normalizedQuestion = this.normalizeText(question);
    const wantsAlternative = /(khac|goi y khac|doi|thay|them|khong trung|moi hon|re hon|nhe hon)/.test(normalizedQuestion);

    if (wantsAlternative) {
      const recentContext = history
        .slice(-4)
        .map((message) => message.content)
        .join(' ');
      return [recentContext, question].filter(Boolean).join(' ').slice(0, 1600);
    }

    const previousUserNeeds = history
      .filter((message) => message.role === 'user')
      .slice(-1)
      .map((message) => message.content)
      .join(' ');

    return [previousUserNeeds, question].filter(Boolean).join(' ').slice(0, 1200);
  }

  private buildEffectiveQuestion(question: string, history: AdvisorHistoryMessage[]): string {
    const previousNeed = this.getPreviousUserNeed(history);
    if (!previousNeed) return question;

    const normalizedQuestion = this.normalizeText(question);
    const isRefinement =
      /(danh cho|cho nguoi|tren \d+ tuoi|duoi \d+ tuoi|tuoi|re hon|gia tot|dat hon|nhe hon|de doc|ngan hon|dai hon|khac|them|tuong tu|giong|van|phu hop voi|nen doc)/.test(
        normalizedQuestion
      );

    if (!isRefinement || this.isNewTopicQuestion(normalizedQuestion)) return question;

    return `${previousNeed}. Yêu cầu bổ sung: ${question}`.slice(0, 1200);
  }

  private getPreviousUserNeed(history: AdvisorHistoryMessage[]): string {
    const previousUserMessages = history
      .filter((message) => message.role === 'user' && message.content.trim().length > 0)
      .map((message) => message.content.trim());

    const collected: string[] = [];
    for (const content of [...previousUserMessages].reverse()) {
      collected.unshift(content);
      if (this.isNewTopicQuestion(this.normalizeText(content))) break;
      if (collected.length >= 3) break;
    }

    return collected
      .join('. ')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }

  private isNewTopicQuestion(normalizedQuestion: string): boolean {
    return /(toi muon tim|tim sach ve|sach ve|the loai|chu de|doi chu de|khong phai|bo qua|tim moi)/.test(normalizedQuestion);
  }

  private shouldAllowReuseFromPrevious(question: string): boolean {
    const normalizedQuestion = this.normalizeText(question);
    return /(giu tieu chi cu|giu nhu cu|nhu truoc|giong truoc|tuong tu|van tieu chi do|cu nhu vay|danh cho|cho nguoi|tuoi|re hon|nhe hon|de doc)/.test(
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
  ): Promise<CandidateSearchResult> {
    const effectiveExcludeBookIds = allowReuseFromPrevious ? [] : excludeBookIds;
    const candidateLimit = Math.min(40, Math.max(limit * 5, 15));
    const semanticResult = await this.bookService.semanticSearchBooks(query, 1, candidateLimit, 0.25);

    const visibleSemanticBooks = semanticResult.data.filter((book) => this.isVisibleBook(book));
    if (visibleSemanticBooks.length > 0) {
      const freshSemantic = visibleSemanticBooks.filter((book) => !excludeBookIds.includes(book.id));
      if (allowReuseFromPrevious) {
        const reusedSemantic = visibleSemanticBooks.filter((book) => excludeBookIds.includes(book.id));
        const rankedBooks = this.rankBooksByQuery(this.mixFreshAndReusedBooks(freshSemantic, reusedSemantic, candidateLimit), query);
        return {
          books: rankedBooks,
          isAlternative: this.shouldTreatAsAlternative(query, rankedBooks),
        };
      }

      const filteredSemantic = visibleSemanticBooks.filter((book) => !effectiveExcludeBookIds.includes(book.id));
      if (filteredSemantic.length > 0) {
        const rankedBooks = this.rankBooksByQuery(filteredSemantic, query).slice(0, candidateLimit);
        return { books: rankedBooks, isAlternative: this.shouldTreatAsAlternative(query, rankedBooks) };
      }
    }

    const keywordResult = await this.bookRepository.searchKeywordExtended(query, 1, candidateLimit);
    const filteredKeyword = keywordResult.data.filter((book) => this.isVisibleBook(book) && !effectiveExcludeBookIds.includes(book.id));
    if (filteredKeyword.length > 0) {
      const rankedBooks = this.rankBooksByQuery(filteredKeyword, query).slice(0, candidateLimit);
      return { books: rankedBooks, isAlternative: this.shouldTreatAsAlternative(query, rankedBooks) };
    }

    const fallback = await this.bookRepository.findAllWithFilters({
      page: 1,
      limit: candidateLimit,
      sort: 'bestseller',
    });

    const visibleFallback = fallback.data.filter((book) => this.isVisibleBook(book));
    const filteredFallback = visibleFallback.filter((book) => !effectiveExcludeBookIds.includes(book.id));
    return { books: this.rankBooksByQuery(filteredFallback.length > 0 ? filteredFallback : visibleFallback, query).slice(0, candidateLimit), isAlternative: true };
  }

  private shouldTreatAsAlternative(query: string, books: BookResponse[]): boolean {
    const normalizedQuery = this.normalizeText(query);
    if (!/(sach giao khoa|giao khoa|sgk|lop \d+|lop\d+)/.test(normalizedQuery)) {
      return false;
    }

    return !books.some((book) => {
      const searchable = this.normalizeText(
        `${book.title || ''} ${book.category?.name || ''} ${book.description || ''} ${book.highlights?.join(' ') || ''}`
      );
      return /(sach giao khoa|giao khoa|sgk|lop \d+|lop\d+)/.test(searchable);
    });
  }

  private rankBooksByQuery(books: BookResponse[], query: string): BookResponse[] {
    const tokens = this.normalizeText(query)
      .split(' ')
      .filter((token) => token.length >= 3 && !this.isWeakSearchToken(token));

    if (tokens.length === 0) return books;

    return books
      .map((book, index) => ({ book, index, score: this.scoreBookForQuery(book, tokens) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.book);
  }

  private scoreBookForQuery(book: BookResponse, tokens: string[]): number {
    const title = this.normalizeText(book.title || '');
    const category = this.normalizeText(book.category?.name || '');
    const author = this.normalizeText(book.author || '');
    const description = this.normalizeText(book.description || '');
    const searchable = `${title} ${category} ${author} ${description}`;

    return tokens.reduce((score, token) => {
      if (!searchable.includes(token)) return score;

      if (title.includes(token)) return score + 5;
      if (category.includes(token)) return score + 4;
      if (author.includes(token)) return score + 2;
      return score + 1;
    }, 0);
  }

  private isWeakSearchToken(token: string): boolean {
    return [
      'sach',
      'cuon',
      'danh',
      'cho',
      'nguoi',
      'tuoi',
      'tren',
      'duoi',
      'phu',
      'hop',
      'voi',
      'minh',
      'can',
      'tim',
      'goi',
    ].includes(token);
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

  private isVisibleBook(book: BookResponse): boolean {
    return !book.deletedAt && book.status !== 'deleted';
  }

  private getBookTheme(book: BookResponse): string {
    if (book.category?.name) {
      return `Có cùng mạch ${book.category.name}, nên hợp để bạn so sánh và chọn theo đúng gu đọc hiện tại.`;
    }

    return 'Giữ được tinh thần của điều bạn đang tìm, nên đáng để cân nhắc trong lượt này.';
  }

  private buildFallbackReason(query: string, book: BookResponse): string {
    const description = this.getCleanDescription(book);

    if (description) {
      return description;
    }

    const categoryHint = book.category?.name ? ` thuộc nhóm ${book.category.name}` : '';
    const authorHint = book.author ? ` của ${book.author}` : '';
    return `Cuốn sách${categoryHint}${authorHint}, có thể dùng làm lựa chọn tham khảo trong nhóm sách này.`;
  }

  private normalizeRecommendationReason(query: string, book: BookResponse, reason?: string): string {
    const trimmed = reason?.trim() || '';
    const normalizedReason = this.normalizeText(trimmed);
    const isGeneric =
      !trimmed ||
      trimmed.length < 45 ||
      /(bam sat mach|gan voi dieu ban tim|phu hop voi nhu cau|lua chon dang thu|goc so sanh|hop gu|nhu cau|ban dang tim|nen can nhac)/.test(normalizedReason);

    if (isGeneric) {
      return this.buildFallbackReason(query, book);
    }

    return trimmed;
  }

  private getCleanDescription(book: BookResponse): string {
    const description = (book.description || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!description) return '';

    const sentences = description.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [description];
    const summary = sentences
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(' ');

    return summary.length > 320 ? `${summary.slice(0, 317).trim()}...` : summary;
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
    effectiveQuestion: string,
    latestQuestion: string,
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
            temperature: 0.55,
            topP: 0.9,
            maxOutputTokens: 1100,
          },
          contents: [
            {
              parts: [
                {
                  text: [
                    'Bạn là trợ lý tư vấn sách cho một nhà sách Việt Nam.',
                    'Nhiệm vụ: chọn đúng sách trong kho dựa trên nhu cầu hiệu lực, tức là nhu cầu đã được ghép từ lịch sử hội thoại và tin nhắn mới nhất.',
                    'Luôn xem đây là một cuộc trò chuyện liên tục. Nếu khách bổ sung điều kiện như "dành cho người trên 70 tuổi", "rẻ hơn", "nhẹ hơn", "cuốn khác", hãy giữ chủ đề hoặc thể loại đã nói trước đó và chỉ thêm điều kiện mới.',
                    'Ví dụ: nếu trước đó khách hỏi "tiểu thuyết lãng mạn", sau đó hỏi "sách dành cho người trên 70 tuổi", hãy hiểu là "tiểu thuyết lãng mạn dành cho người trên 70 tuổi", không được chuyển sang sách người cao tuổi chung chung.',
                    `Hãy chọn đúng ${targetCount} sách. Nếu chỉ có ít sách phù hợp, chọn ít hơn.`,
                    'Nếu không có sách nào thật sự đúng nhu cầu, vẫn chọn lựa chọn thay thế gần nhất trong kho nhưng phải nói rõ kho sách hiện tại chưa có đúng loại sách khách cần, rồi mới chuyển sang phương án thay thế.',
                    'Khi đưa phương án thay thế, giải thích tiêu chí thay thế bằng giọng tự nhiên: gần về cảm xúc đọc, gần về chủ đề, dễ đọc hơn, cùng nhóm thể loại, hoặc có một phần đáp ứng nhu cầu. Không dùng kiểu nhãn "Lý do là:".',
                    'Chỉ được dùng id sách có trong danh sách ứng viên. Không bịa tên sách, tác giả hoặc id.',
                    'Câu trả lời phải nhắc đúng các sách trong recommendations, không nhắc sách ngoài danh sách đó.',
                    'Giọng văn tự nhiên như nhân viên nhà sách đang tư vấn: ấm, cụ thể, không lặp cụm "khớp với nhu cầu", không nói kiểu máy móc.',
                    'Định dạng answer nên theo kiểu tự nhiên: "Bạn đang tìm ... . Mình sẽ gợi ý ... . Với hướng này, ...". Không dùng cụm máy móc "Lý do là".',
                    'answer chỉ là 2-3 câu văn tự nhiên, viết thành một đoạn liền mạch khi đã có recommendations.',
                    'Câu mở đầu phải phản hồi như đang trò chuyện, không dùng mẫu "Mình chọn X cuốn..." hoặc "Dựa trên nhu cầu...".',
                    'Câu mở đầu nên đủ thuyết phục: nhắc lại tinh thần nhu cầu, nói tiêu chí chọn sách, và dẫn người đọc xem các gợi ý bên dưới.',
                    'Nếu nhu cầu còn mơ hồ, hãy thêm một câu hỏi gợi mở tự nhiên ở cuối answer, ví dụ: "Bạn có thể cho mình biết thêm người nhận bao nhiêu tuổi, dịp tặng và gu đọc của họ để mình lọc sát hơn."',
                    'Không viết lý do chung chung như "dễ tiếp cận" hoặc "đáp ứng tinh thần bạn mô tả" nếu chưa nói rõ tiêu chí cụ thể. Hãy nêu tiêu chí sát ngữ cảnh như người nhận, dịp tặng, cảm xúc muốn gửi, độ dễ đọc, mức trang trọng hoặc tính ứng dụng.',
                    'Ví dụ câu mở đầu tốt: "Chủ đề quê hương đất nước thì mình sẽ nghiêng về những cuốn có chất đời sống Việt Nam, ký ức tuổi thơ và cảm giác gần gũi."',
                    'Nếu đây là câu hỏi nối tiếp, hãy nối mạch bằng các cụm tự nhiên như "Nếu muốn đổi sang lựa chọn nhẹ hơn...", "Vậy mình chuyển hướng sang...", "Theo gu bạn vừa nói...".',
                    'Trong answer, KHÔNG tóm tắt lại mô tả/nội dung cốt truyện của sách vì phần thẻ sách bên dưới đã có mô tả.',
                    'Trong answer chỉ nói vai trò tư vấn: bạn đang tìm gì, mình sẽ gợi ý theo hướng nào, vì sao hướng chọn đó hợp lý và đáng cân nhắc.',
                    'Không viết dạng: "Tên sách là tác phẩm..." hoặc "kể về...".',
                    'Riêng trường recommendations[].reason sẽ hiển thị trong thẻ sách, nên mô tả nội dung/chủ đề chính của sách để user có cái nhìn tổng quát.',
                    'recommendations[].reason không được nhắc lại nhu cầu khách, không viết "phù hợp với nhu cầu", không tư vấn mua; mô tả sách trong 2 câu vừa đủ rõ.',
                    'Nếu recommendations có 1 sách thì câu trả lời chỉ nói về 1 sách. Nếu có nhiều sách thì nói rõ từng sách rất ngắn gọn.',
                    'Ưu tiên: đúng chủ đề người dùng hỏi, còn hàng, mô tả sát nhu cầu, không trùng sách đã gợi ý trước trừ khi khách muốn tương tự.',
                    'Trả về JSON thuần, không markdown, không giải thích ngoài JSON.',
                    'Schema:',
                    '{"answer":"Bạn đang tìm ... . Mình sẽ gợi ý ... . Với hướng này, ...","recommendations":[{"id":"book-id","reason":"2 câu mô tả nội dung/chủ đề chính của sách"}]}',
                    `Lịch sử hội thoại:\n${historyContext}`,
                    `Tin nhắn mới nhất của khách: ${latestQuestion}`,
                    `Nhu cầu hiệu lực cần tư vấn: ${effectiveQuestion}`,
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
    targetCount: number,
    isAlternative: boolean
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
          reason: this.normalizeRecommendationReason(question, book, item.reason),
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

    const answer = isAlternative
      ? this.buildAlternativeIntro(question, selected)
      : selection?.answer?.trim()
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
      return 'Mình chưa tìm thấy cuốn nào thật sự khớp với nhu cầu này trong kho hiện tại. Bạn có thể mô tả rộng hơn một chút về thể loại, cảm giác muốn đọc hoặc tác giả yêu thích; mình sẽ đổi hướng tìm một phương án gần hơn.';
    }

    const intro = this.buildNaturalIntro(question, books);

    if (books.length === 1) {
      return intro;
    }

    return intro;
  }

  private buildAdvisorAngle(book: AdvisorRecommendation): string {
    const categoryName = book.category?.name;
    const author = book.author;

    if (categoryName && author) {
      return `Cuốn này đáng cân nhắc vì giữ đúng hướng ${categoryName} nhưng có giọng riêng của ${author}, giúp bạn có thêm một góc đọc để so sánh.`;
    }

    if (categoryName) {
      return `Cuốn này đi cùng hướng ${categoryName}, nên hợp khi bạn muốn tiếp tục đào sâu chủ đề mà không lệch khỏi nhu cầu ban đầu.`;
    }

    if (author) {
      return `Cuốn này đáng thử vì giọng viết của ${author} tạo một sắc thái khác, giúp cuộc chọn sách bớt một màu.`;
    }

    return 'Cuốn này đáng cân nhắc vì tạo thêm một lựa chọn khác biệt nhưng vẫn không lệch khỏi mạch bạn đang tìm.';
  }

  private buildNaturalIntro(question: string, books: AdvisorRecommendation[]): string {
    const normalizedQuestion = this.normalizeText(question);
    const bookCountText = books.length === 1 ? 'một cuốn' : `${books.length} cuốn`;

    if (!question.trim()) {
      return `Bạn đang tiếp tục mạch tư vấn hiện tại, nên mình sẽ giữ tiêu chí đã trao đổi trước đó. Mình sẽ gợi ý ${bookCountText} để bạn có thêm điểm bắt đầu rõ ràng. Các lựa chọn này được chọn theo hướng dễ đọc, dễ so sánh và có thể tinh chỉnh tiếp nếu bạn muốn đổi gu.`;
    }

    if (/(khac|goi y khac|doi|thay|them|khong trung)/.test(normalizedQuestion)) {
      return `Bạn đang muốn đổi sang lựa chọn khác nhưng vẫn giữ tinh thần của lượt tư vấn trước. Mình sẽ gợi ý ${bookCountText} có cảm giác mới hơn, tránh lặp lại các cuốn vừa nêu. Như vậy bạn có thêm phương án để so sánh mà không bị lệch khỏi gu đọc ban đầu.`;
    }

    if (/(re hon|gia tot|tiet kiem)/.test(normalizedQuestion)) {
      return `Bạn đang tìm sách có mức giá dễ cân nhắc hơn. Mình sẽ gợi ý ${bookCountText} theo hướng thực tế, vẫn giữ gần gu đọc nhưng phù hợp hơn khi bạn muốn mua thử. Cách chọn này giúp giảm rủi ro chọn nhầm mà vẫn có đủ nội dung để tham khảo.`;
    }

    if (/(nhe hon|de doc|thu gian)/.test(normalizedQuestion)) {
      return `Bạn đang tìm sách nhẹ nhàng, dễ đọc hoặc phù hợp để thư giãn. Mình sẽ gợi ý ${bookCountText} có nhịp đọc dễ vào hơn, không tạo cảm giác quá nặng. Những lựa chọn này hợp để đọc đều đặn và vẫn đủ chất riêng để không bị nhạt.`;
    }

    if (/(que huong|dat nuoc|viet nam|tuoi tho|lang que)/.test(normalizedQuestion)) {
      return `Bạn đang tìm sách gợi cảm giác quê hương, đất nước hoặc ký ức Việt Nam. Mình sẽ gợi ý ${bookCountText} có không khí gần gũi, dễ chạm cảm xúc và phù hợp để đọc chậm rãi. Hướng chọn này thường đem lại cảm giác thân thuộc hơn là chỉ cung cấp thông tin khô.`;
    }

    if (/(qua tang|tang qua|lam qua|tang ban|tang nguoi|giup minh)/.test(normalizedQuestion)) {
      return `Bạn đang muốn chọn sách làm quà, nên mình sẽ ưu tiên những cuốn dễ tạo thiện cảm, nội dung không quá kén người đọc và có cảm giác chỉn chu khi đem tặng. Mình sẽ gợi ý ${bookCountText} theo hướng an toàn trước: dễ đọc, có thông điệp rõ và hợp để mở đầu nếu bạn chưa biết gu người nhận. Bạn có thể cho mình biết thêm người nhận là ai, khoảng bao nhiêu tuổi, dịp tặng và họ thích đọc nhẹ nhàng hay thực tế để mình lọc sát hơn.`;
    }

    if (/(lang man|tinh yeu)/.test(normalizedQuestion) && /(70 tuoi|nguoi lon tuoi|cao tuoi|nguoi gia)/.test(normalizedQuestion)) {
      return `Bạn đang tìm tiểu thuyết lãng mạn cho người lớn tuổi, nên mình sẽ ưu tiên những cuốn có cảm xúc chín chắn, nhịp đọc không quá gấp và câu chuyện dễ đồng cảm. Mình sẽ gợi ý ${bookCountText} gần nhất trong kho hiện tại. Với nhóm độc giả này, một cuốn sách hợp thường cần sự ấm áp, chiều sâu cảm xúc và cách kể dễ theo dõi hơn là chỉ có yếu tố lãng mạn đơn thuần.`;
    }

    if (/(khoi nghiep|kinh doanh|startup|quan tri)/.test(normalizedQuestion)) {
      return `Bạn đang tìm sách về kinh doanh hoặc khởi nghiệp. Mình sẽ gợi ý ${bookCountText} thiên về tư duy thực tế, cách xây ý tưởng và cách ra quyết định. Các lựa chọn này thuyết phục hơn vì sau khi đọc, bạn có thể rút ra hướng áp dụng thay vì chỉ nắm lý thuyết chung chung.`;
    }

    if (/(tinh yeu|lang man|cam xuc)/.test(normalizedQuestion)) {
      return `Bạn đang tìm một câu chuyện giàu cảm xúc, thiên về tình yêu hoặc sự đồng cảm. Mình sẽ gợi ý ${bookCountText} có mạch đọc mềm, dễ tạo dư âm và không quá khô. Những cuốn này hợp nếu bạn muốn đọc vì cảm giác, nhân vật và không khí câu chuyện.`;
    }

    return `Bạn đang tìm sách theo hướng "${this.formatNeedForAnswer(question)}", nhưng thông tin hiện tại vẫn còn khá rộng nên mình sẽ chọn ${bookCountText} có tín hiệu gần nhất trong kho để bạn tham khảo trước. Mình ưu tiên các cuốn có chủ đề hoặc cảm giác đọc liên quan, thay vì chọn ngẫu nhiên theo độ phổ biến. Bạn có thể cho mình biết thêm thể loại muốn đọc, người đọc là ai, mục đích đọc hoặc cảm xúc bạn muốn nhận được để mình lọc đúng nhu cầu hơn.`;
  }

  private buildAlternativeIntro(question: string, books: AdvisorRecommendation[]): string {
    if (books.length === 0) {
      return 'Mình chưa thấy cuốn nào đủ gần để đề xuất một cách tự tin. Bạn thử nới rộng tiêu chí thêm một chút, ví dụ thể loại gần kề, cảm giác muốn đọc hoặc mức độ dễ đọc nhé.';
    }

    const normalizedQuestion = this.normalizeText(question);

    if (/(sach giao khoa|giao khoa|sgk|lop \d+|lop\d+)/.test(normalizedQuestion)) {
      return `Kho sách hiện tại chưa có sách giáo khoa đúng với yêu cầu "${this.formatNeedForAnswer(question)}". Mình sẽ chuyển sang một vài đầu sách thay thế có tính tham khảo, dễ mở rộng kiến thức hoặc rèn tư duy học tập. Những gợi ý này không phải sách giáo khoa đúng chương trình, nhưng vẫn có thể hữu ích nếu bạn muốn tìm thêm sách đọc bổ trợ.`;
    }

    if (/(sach thieu nhi|tre em|mau giao|lop 1|lop mot)/.test(normalizedQuestion)) {
      return 'Bạn đang tìm sách thiếu nhi, nhưng trong kho hiện tại mình chưa thấy cuốn nào thật sự đúng nhóm đó. Mình sẽ chuyển sang lựa chọn thay thế gần nhất theo tiêu chí dễ đọc, giàu cảm xúc và có thể đọc nhẹ nhàng. Nếu bạn muốn đúng sách cho trẻ em, mình khuyên nên mở rộng kho hoặc bổ sung thêm đầu sách thiếu nhi chuyên biệt.';
    }

    if (/(lich su|chien tranh|cach mang)/.test(normalizedQuestion)) {
      return 'Bạn đang tìm sách lịch sử hoặc chiến tranh, nhưng kho hiện tại chưa có lựa chọn thật sự khớp hoàn toàn. Mình sẽ chuyển sang phương án gần nhất về bối cảnh, tinh thần hoặc cảm giác đọc nghiêm túc. Đây là lựa chọn thay thế để bạn vẫn có hướng tham khảo thay vì nhận một gợi ý sai nhu cầu.';
    }

    if (/(khoa hoc vien tuong|sci fi|vien tuong)/.test(normalizedQuestion)) {
      return 'Bạn đang tìm sách khoa học viễn tưởng, nhưng kho hiện tại chưa có lựa chọn thật sự đúng chất sci-fi. Mình sẽ tạm chuyển sang các cuốn có yếu tố tưởng tượng, hành trình hoặc góc nhìn khác lạ. Đây là phương án thay thế, không phải lựa chọn khớp tuyệt đối.';
    }

    return `Bạn đang tìm sách theo hướng "${this.formatNeedForAnswer(question)}", nhưng mình chưa thấy cuốn nào thật sự khớp trọn vẹn trong kho hiện tại. Mình sẽ chuyển sang các lựa chọn gần nhất, ưu tiên những cuốn vẫn giữ được một phần tinh thần bạn đang tìm. Đây là phương án thay thế để bạn có thêm lựa chọn, không phải khẳng định rằng chúng đúng hoàn toàn với nhu cầu ban đầu.`;
  }

  private formatNeedForAnswer(question: string): string {
    return question
      .replace(/\.\s*Yêu cầu bổ sung:\s*/i, ', ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
