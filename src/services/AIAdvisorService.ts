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

    const searchQuery = this.buildSearchQuery(normalizedQuestion, safeHistory);
    const candidateResult = await this.findCandidateBooks(
      searchQuery,
      Math.max(targetCount, safeLimit),
      safeExcludeBookIds,
      allowReuseFromPrevious
    );
    const candidateBooks = candidateResult.books;

    const selection = await this.generateSelection(normalizedQuestion, candidateBooks, targetCount, safeHistory);
    return this.reconcileSelection(normalizedQuestion, selection, candidateBooks, targetCount, candidateResult.isAlternative);
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
  ): Promise<CandidateSearchResult> {
    const effectiveExcludeBookIds = allowReuseFromPrevious ? [] : excludeBookIds;
    const candidateLimit = Math.min(40, Math.max(limit * 5, 15));
    const semanticResult = await this.bookService.semanticSearchBooks(query, 1, candidateLimit, 0.25);

    const visibleSemanticBooks = semanticResult.data.filter((book) => this.isVisibleBook(book));
    if (visibleSemanticBooks.length > 0) {
      const freshSemantic = visibleSemanticBooks.filter((book) => !excludeBookIds.includes(book.id));
      if (allowReuseFromPrevious) {
        const reusedSemantic = visibleSemanticBooks.filter((book) => excludeBookIds.includes(book.id));
        return { books: this.mixFreshAndReusedBooks(freshSemantic, reusedSemantic, candidateLimit), isAlternative: false };
      }

      const filteredSemantic = visibleSemanticBooks.filter((book) => !effectiveExcludeBookIds.includes(book.id));
      if (filteredSemantic.length > 0) {
        return { books: filteredSemantic.slice(0, candidateLimit), isAlternative: false };
      }
    }

    const keywordResult = await this.bookRepository.searchKeywordExtended(query, 1, candidateLimit);
    const filteredKeyword = keywordResult.data.filter((book) => this.isVisibleBook(book) && !effectiveExcludeBookIds.includes(book.id));
    if (filteredKeyword.length > 0) {
      return { books: filteredKeyword.slice(0, candidateLimit), isAlternative: false };
    }

    const fallback = await this.bookRepository.findAllWithFilters({
      page: 1,
      limit: candidateLimit,
      sort: 'bestseller',
    });

    const visibleFallback = fallback.data.filter((book) => this.isVisibleBook(book));
    const filteredFallback = visibleFallback.filter((book) => !effectiveExcludeBookIds.includes(book.id));
    return { books: (filteredFallback.length > 0 ? filteredFallback : visibleFallback).slice(0, candidateLimit), isAlternative: true };
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
    const categoryHint = book.category?.name ? ` thuộc nhóm ${book.category.name}` : '';

    if (description) {
      return `${description} Vì vậy cuốn này${categoryHint} có thể đáp ứng một phần nhu cầu "${query}" và giúp bạn kiểm tra xem hướng đọc này có hợp gu không.`;
    }

    const authorHint = book.author ? ` với giọng viết của ${book.author}` : '';
    return `Cuốn này${categoryHint}${authorHint} là một lựa chọn đáng thử vì nó giữ được tinh thần gần với điều bạn đang tìm và tạo thêm góc so sánh với các gợi ý còn lại.`;
  }

  private normalizeRecommendationReason(query: string, book: BookResponse, reason?: string): string {
    const trimmed = reason?.trim() || '';
    const normalizedReason = this.normalizeText(trimmed);
    const isGeneric =
      !trimmed ||
      trimmed.length < 45 ||
      /(bam sat mach|gan voi dieu ban tim|phu hop voi nhu cau|lua chon dang thu|goc so sanh|hop gu)/.test(normalizedReason);

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

    const firstSentence = description.match(/.+?[.!?](\s|$)/)?.[0]?.trim() || description;
    return firstSentence.length > 220 ? `${firstSentence.slice(0, 217).trim()}...` : firstSentence;
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
                    'Nhiệm vụ: chọn đúng sách trong kho dựa trên nhu cầu mới nhất và lịch sử hội thoại.',
                    'Luôn xem đây là một cuộc trò chuyện liên tục. Nếu khách hỏi tiếp như "cuốn khác", "rẻ hơn", "giống cuốn trên", hãy hiểu dựa trên các sách và tiêu chí đã nhắc trong lịch sử.',
                    `Hãy chọn đúng ${targetCount} sách. Nếu chỉ có ít sách phù hợp, chọn ít hơn.`,
                    'Nếu không có sách nào thật sự đúng nhu cầu, vẫn chọn lựa chọn thay thế gần nhất trong kho nhưng phải nói rõ là "chưa có cuốn thật sự khớp", "mình chuyển sang phương án gần nhất", hoặc cách diễn đạt tương tự.',
                    'Khi đưa phương án thay thế, giải thích tiêu chí thay thế: gần về cảm xúc đọc, gần về chủ đề, dễ đọc hơn, cùng nhóm thể loại, hoặc có một phần đáp ứng nhu cầu.',
                    'Chỉ được dùng id sách có trong danh sách ứng viên. Không bịa tên sách, tác giả hoặc id.',
                    'Câu trả lời phải nhắc đúng các sách trong recommendations, không nhắc sách ngoài danh sách đó.',
                    'Giọng văn tự nhiên như nhân viên nhà sách đang tư vấn: ấm, cụ thể, không lặp cụm "khớp với nhu cầu", không nói kiểu máy móc.',
                    'Định dạng answer dễ đọc: 2-3 câu mở đầu tự nhiên, sau đó mỗi sách là một dòng bullet bắt đầu bằng "- Tên sách: ...".',
                    'Câu mở đầu phải phản hồi như đang trò chuyện, không dùng mẫu "Mình chọn X cuốn..." hoặc "Dựa trên nhu cầu...".',
                    'Câu mở đầu nên đủ thuyết phục: nhắc lại tinh thần nhu cầu, nói tiêu chí chọn sách, và dẫn người đọc xem các gợi ý bên dưới.',
                    'Ví dụ câu mở đầu tốt: "Chủ đề quê hương đất nước thì mình sẽ nghiêng về những cuốn có chất đời sống Việt Nam, ký ức tuổi thơ và cảm giác gần gũi."',
                    'Nếu đây là câu hỏi nối tiếp, hãy nối mạch bằng các cụm tự nhiên như "Nếu muốn đổi sang lựa chọn nhẹ hơn...", "Vậy mình chuyển hướng sang...", "Theo gu bạn vừa nói...".',
                    'Trong answer, KHÔNG tóm tắt lại mô tả/nội dung cốt truyện của sách vì phần thẻ sách bên dưới đã có mô tả.',
                    'Mỗi bullet trong answer chỉ nói vai trò tư vấn: vì sao nên cân nhắc cuốn đó theo nhu cầu, cảm giác đọc, độ dễ đọc, góc nhìn, mức phù hợp để bắt đầu hoặc để so sánh.',
                    'Không viết dạng: "Tên sách là tác phẩm..." hoặc "kể về...".',
                    'Riêng trường recommendations[].reason sẽ hiển thị trong thẻ sách, nên phải cụ thể hơn answer: nêu nội dung/chủ đề chính của cuốn sách và giải thích vì sao nội dung đó hợp với nhu cầu khách.',
                    'recommendations[].reason không được rập khuôn. Tránh câu chung chung như "bám sát mạch bạn đang tìm". Hãy viết 1-2 câu tự nhiên, có chi tiết từ mô tả sách.',
                    'Nếu recommendations có 1 sách thì câu trả lời chỉ nói về 1 sách. Nếu có nhiều sách thì nói rõ từng sách rất ngắn gọn.',
                    'Ưu tiên: đúng chủ đề người dùng hỏi, còn hàng, mô tả sát nhu cầu, không trùng sách đã gợi ý trước trừ khi khách muốn tương tự.',
                    'Trả về JSON thuần, không markdown, không giải thích ngoài JSON.',
                    'Schema:',
                    '{"answer":"2-3 câu mở đầu tự nhiên, thuyết phục, không máy móc\\n- Tên sách 1: lý do tư vấn ngắn, không tóm tắt sách\\n- Tên sách 2: lý do tư vấn ngắn, không tóm tắt sách","recommendations":[{"id":"book-id","reason":"1-2 câu nói về nội dung sách và vì sao hợp nhu cầu"}]}',
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
      const book = books[0];
      return [
        intro,
        `- ${book.title}: ${this.buildAdvisorAngle(book)} Đây là lựa chọn dễ bắt đầu trước nếu bạn muốn kiểm tra xem hướng này có hợp gu không.`,
      ].join('\n');
    }

    const details = books
      .map((book) => `- ${book.title}: ${this.buildAdvisorAngle(book)}`)
      .join('\n');
    return `${intro}\n${details}`;
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

    if (!question.trim()) {
      return books.length === 1
        ? 'Mình sẽ giữ đúng mạch bạn đang tìm và ưu tiên một lựa chọn rõ ràng trước. Cuốn này hợp để bạn bắt đầu ngay, sau đó nếu chưa đúng gu mình có thể đổi hướng tiếp:'
        : 'Mình sẽ giữ mạch tư vấn hiện tại và chọn vài cuốn dễ tiếp cận hơn. Các gợi ý bên dưới được chọn để bạn có thể so sánh nhanh giữa sắc thái đọc, độ dễ vào truyện và mức hợp gu:';
    }

    if (/(khac|goi y khac|doi|thay|them|khong trung)/.test(normalizedQuestion)) {
      return 'Vậy mình đổi sang vài lựa chọn khác nhưng vẫn giữ đúng tinh thần bạn đang tìm. Mình ưu tiên các cuốn tạo cảm giác mới hơn so với lượt trước, nhưng không đi lệch khỏi gu đọc bạn đã mô tả:';
    }

    if (/(re hon|gia tot|tiet kiem)/.test(normalizedQuestion)) {
      return 'Nếu ưu tiên mức giá dễ chịu hơn, mình sẽ lọc theo hướng thực tế hơn. Những cuốn bên dưới vẫn bám sát gu đọc của bạn, nhưng hợp hơn để cân nhắc khi muốn mua thử mà không phải đắn đo quá nhiều:';
    }

    if (/(nhe hon|de doc|thu gian)/.test(normalizedQuestion)) {
      return 'Nếu muốn đọc nhẹ nhàng hơn, mình sẽ nghiêng về những cuốn dễ vào mạch và không tạo cảm giác nặng. Các gợi ý này hợp để đọc thư giãn, nhưng vẫn đủ chất riêng để bạn không thấy nhạt:';
    }

    if (/(que huong|dat nuoc|viet nam|tuoi tho|lang que)/.test(normalizedQuestion)) {
      return 'Chủ đề quê hương đất nước thì mình sẽ ưu tiên những cuốn có chất đời sống Việt Nam, ký ức tuổi thơ và cảm giác gần gũi. Mình chọn theo hướng dễ chạm cảm xúc, có không khí thân thuộc và phù hợp để đọc chậm rãi:';
    }

    if (/(khoi nghiep|kinh doanh|startup|quan tri)/.test(normalizedQuestion)) {
      return 'Với hướng kinh doanh khởi nghiệp, mình sẽ chọn những cuốn giúp bạn nhìn rõ cách xây ý tưởng, thử nghiệm và vận hành thực tế. Các gợi ý bên dưới thiên về tính ứng dụng, nên hợp nếu bạn muốn đọc xong có thể rút ra cách làm cụ thể:';
    }

    if (/(tinh yeu|lang man|cam xuc)/.test(normalizedQuestion)) {
      return 'Nếu bạn muốn một câu chuyện giàu cảm xúc, mình sẽ chọn những cuốn có mạch đọc mềm và dễ đồng cảm. Mình ưu tiên cảm giác đọc cuốn hút, nhân vật có dư âm và không quá khô:';
    }

    return books.length === 1
      ? 'Mình thấy cuốn này là điểm bắt đầu hợp lý nhất cho điều bạn đang tìm. Nó đủ rõ hướng để bạn thử trước, và nếu chưa đúng cảm giác mong muốn mình có thể tiếp tục tinh chỉnh ở lượt sau:'
      : 'Mình sẽ gợi ý theo hướng dễ đọc trước, rồi bạn có thể chọn cuốn hợp gu nhất. Các cuốn bên dưới được chọn để mỗi cuốn đem lại một góc đọc hơi khác nhau, giúp bạn dễ so sánh hơn:';
  }

  private buildAlternativeIntro(question: string, books: AdvisorRecommendation[]): string {
    if (books.length === 0) {
      return 'Mình chưa thấy cuốn nào đủ gần để đề xuất một cách tự tin. Bạn thử nới rộng tiêu chí thêm một chút, ví dụ thể loại gần kề, cảm giác muốn đọc hoặc mức độ dễ đọc nhé.';
    }

    const normalizedQuestion = this.normalizeText(question);

    if (/(sach thieu nhi|tre em|mau giao|lop 1|lop mot)/.test(normalizedQuestion)) {
      return 'Trong kho hiện tại mình chưa thấy cuốn nào thật sự đúng hướng sách thiếu nhi như bạn hỏi. Mình sẽ chuyển sang lựa chọn gần nhất theo tiêu chí dễ đọc, giàu cảm xúc và có thể phù hợp để đọc nhẹ nhàng:';
    }

    if (/(lich su|chien tranh|cach mang)/.test(normalizedQuestion)) {
      return 'Mình chưa thấy cuốn nào thật sự khớp hoàn toàn với hướng lịch sử/chiến tranh trong kho hiện tại. Vì vậy mình sẽ chuyển sang những lựa chọn gần nhất về bối cảnh, tinh thần hoặc cảm giác đọc nghiêm túc:';
    }

    if (/(khoa hoc vien tuong|sci fi|vien tuong)/.test(normalizedQuestion)) {
      return 'Kho hiện tại chưa có lựa chọn thật sự đúng chất khoa học viễn tưởng. Mình sẽ tạm chuyển sang các cuốn có yếu tố tưởng tượng, hành trình hoặc góc nhìn khác lạ để bạn vẫn có phương án tham khảo:';
    }

    return 'Mình chưa thấy cuốn nào thật sự khớp trọn vẹn với nhu cầu này trong kho hiện tại. Mình sẽ chuyển sang các lựa chọn gần nhất, ưu tiên những cuốn vẫn giữ được một phần tinh thần bạn đang tìm để bạn có phương án thay thế:';
  }
}
