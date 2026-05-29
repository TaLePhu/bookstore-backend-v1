import { singleton } from 'tsyringe';
import { Repository } from 'typeorm';
import { AppDataSource } from '@config/data-source';
import { Embedding } from '@entities/Embedding';

@singleton()
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
    const { items } = await this.searchSimilarPaged(vector, 0, limit, similarityThreshold);
    return items;
  }

  async searchSimilarPaged(
    vector: number[],
    offset: number,
    limit: number,
    similarityThreshold: number = 0.5
  ): Promise<{ items: Array<{ bookId: string; similarity: number }>; total: number }> {
    try {
      const vectorStr = JSON.stringify(vector);

      const query = `
        SELECT 
          e.book_id,
          (1 - (e.vector <=> $1::vector)) as similarity
        FROM embeddings e
        INNER JOIN books b ON b.id = e.book_id
        WHERE b.deleted_at IS NULL
          AND (1 - (e.vector <=> $1::vector)) >= $2
        ORDER BY e.vector <=> $1::vector
        OFFSET $3
        LIMIT $4
      `;

      const countQuery = `
        SELECT COUNT(1) as total
        FROM embeddings e
        INNER JOIN books b ON b.id = e.book_id
        WHERE b.deleted_at IS NULL
          AND (1 - (e.vector <=> $1::vector)) >= $2
      `;

      const [results, countRows] = await Promise.all([
        this.repository.query(query, [vectorStr, similarityThreshold, offset, limit]),
        this.repository.query(countQuery, [vectorStr, similarityThreshold]),
      ]);

      const total = Number(countRows?.[0]?.total || 0);
      const items = (results as Array<{ book_id: string; similarity: string }>).map((row) => ({
        bookId: row.book_id,
        similarity: parseFloat(row.similarity),
      }));

      return { items, total };
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
