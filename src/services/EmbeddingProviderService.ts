import { singleton } from 'tsyringe';
import { getEnv } from '@config/env';

interface GeminiEmbeddingResponse {
  embedding?: {
    values?: number[];
  };
}

@singleton()
export class EmbeddingProviderService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiVersion: string;

  constructor() {
    const env = getEnv();
    this.apiKey = env.gemini.apiKey;
    this.model = env.gemini.embeddingModel;
    this.apiVersion = env.gemini.apiVersion;
  }

  buildBookEmbeddingText(params: {
    title: string;
    description: string;
    author: string;
    categoryName?: string | null;
  }): string {
    const parts = [
      `title: ${params.title}`,
      `author: ${params.author}`,
      params.categoryName ? `category: ${params.categoryName}` : '',
      `description: ${params.description}`,
    ].filter((value) => value.trim() !== '');

    return parts.join('\n');
  }

  buildQueryText(query: string): string {
    return query.trim();
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is missing');
    }

    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Embedding text is empty');
    }

    const modelPath = this.model.startsWith('models/') ? this.model : `models/${this.model}`;
    const url = `https://generativelanguage.googleapis.com/${this.apiVersion}/${modelPath}:embedContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: trimmed }],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini embedding request failed: ${response.status} ${errorText} (model=${this.model}, version=${this.apiVersion})`
      );
    }

    const payload = (await response.json()) as GeminiEmbeddingResponse;
    const values = payload.embedding?.values;

    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('Gemini embedding response is invalid');
    }

    return values;
  }
}
