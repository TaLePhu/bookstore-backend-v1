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

  async advise(question: string, limit: number = 4): Promise<AdvisorResponse> {
    const normalizedQuestion = question.trim();
    const safeLimit = Math.min(8, Math.max(1, limit));

    if (!normalizedQuestion) {
      return {
        answer: 'Bạn hãy cho mình biết thể loại, mục tiêu đọc hoặc một cuốn sách bạn từng thích nhé.',
        books: [],
      };
    }

    const candidateBooks = await this.findCandidateBooks(normalizedQuestion, safeLimit);
    const books = candidateBooks.map((book) => ({
      ...book,
      reason: this.buildFallbackReason(normalizedQuestion, book),
    }));

    const answer = await this.generateAnswer(normalizedQuestion, books);
    return { answer, books };
  }

  private async findCandidateBooks(query: string, limit: number): Promise<BookResponse[]> {
    const semanticResult = await this.bookService.semanticSearchBooks(query, 1, limit, 0.35);

    if (semanticResult.data.length > 0) {
      return semanticResult.data;
    }

    const fallback = await this.bookRepository.findAllWithFilters({
      page: 1,
      limit,
      sort: 'bestseller',
    });

    return fallback.data;
  }

  private buildFallbackReason(query: string, book: BookResponse): string {
    const categoryName = book.category?.name ? ` thuộc nhóm ${book.category.name}` : '';
    return `Phù hợp với nhu cầu "${query}" vì sách${categoryName} có nội dung gần với chủ đề bạn đang tìm.`;
  }

  private async generateAnswer(question: string, books: AdvisorRecommendation[]): Promise<string> {
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
                    'Trả lời bằng tiếng Việt, thân thiện, ngắn gọn trong 2-4 câu.',
                    'Chỉ dựa trên danh sách sách được cung cấp, không bịa sách ngoài kho.',
                    `Nhu cầu của khách: ${question}`,
                    `Sách gợi ý:\n${bookContext}`,
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

    return `Dựa trên nhu cầu "${question}", mình gợi ý ${books.length} cuốn dưới đây từ kho sách hiện có. Bạn có thể bắt đầu với "${books[0].title}" nếu muốn một lựa chọn nổi bật nhất.`;
  }
}
