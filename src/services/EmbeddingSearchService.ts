import { injectable } from 'tsyringe';
import { Repository } from 'typeorm';
import { AppDataSource } from '@config/data-source';
import { Embedding } from '@entities/Embedding';

@injectable()
export class EmbeddingSearchService {
  private repository: Repository<Embedding>;

  constructor() {
    this.repository = AppDataSource.getRepository(Embedding);
  }

  /**
   * Search for books with similar embeddings using vector similarity
   * @param vector - The query vector (1536-dimensional)
   * @param limit - Number of results to return (default: 10)
   * @param similarityThreshold - Cosine similarity threshold (0-1, default: 0.5)
   */
  async searchSimilar(
    vector: number[],
    limit: number = 10,
    similarityThreshold: number = 0.5
  ): Promise<Array<{ bookId: string; similarity: number }>> {
    try {
      const vectorStr = JSON.stringify(vector);

      // Use pgvector similarity search
      const query = `
        SELECT 
          e.book_id,
          (1 - (e.vector <=> $1::vector)) as similarity
        FROM embeddings e
        WHERE (1 - (e.vector <=> $1::vector)) >= $2
        ORDER BY e.vector <=> $1::vector
        LIMIT $3
      `;

      const results = await this.repository.query(query, [vectorStr, similarityThreshold, limit]);

      return results.map((row: any) => ({
        bookId: row.book_id,
        similarity: parseFloat(row.similarity),
      }));
    } catch (error) {
      console.error('Vector search error:', error);
      throw new Error('Vector search failed');
    }
  }

  /**
   * Store embedding for a book
   * @param bookId - Book UUID
   * @param vector - The embedding vector (1536-dimensional)
   */
  async storeEmbedding(bookId: string, vector: number[]): Promise<Embedding> {
    try {
      const vectorStr = JSON.stringify(vector);

      let embedding = await this.repository.findOne({
        where: { bookId },
      });

      if (embedding) {
        embedding.vector = vectorStr;
        return this.repository.save(embedding);
      } else {
        embedding = this.repository.create({
          bookId,
          vector: vectorStr,
        });
        return this.repository.save(embedding);
      }
    } catch (error) {
      console.error('Store embedding error:', error);
      throw new Error('Failed to store embedding');
    }
  }

  /**
   * Get embedding for a specific book
   */
  async getEmbedding(bookId: string): Promise<Embedding | null> {
    return this.repository.findOne({
      where: { bookId },
      relations: ['book'],
    });
  }

  /**
   * Delete embedding for a book
   */
  async deleteEmbedding(bookId: string): Promise<boolean> {
    const result = await this.repository.delete({ bookId });
    return (result.affected ?? 0) > 0;
  }
}
