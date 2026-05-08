import { AppDataSource, closeDataSource, initializeDataSource } from '@config/data-source';
import { Book } from '@entities/Book';
import { EmbeddingProviderService } from '@services/EmbeddingProviderService';
import { EmbeddingSearchService } from '@services/EmbeddingSearchService';

async function backfillEmbeddings(batchSize: number = 25): Promise<void> {
  const bookRepo = AppDataSource.getRepository(Book);
  const embeddingProvider = new EmbeddingProviderService();
  const embeddingSearch = new EmbeddingSearchService();

  const total = await bookRepo.count();
  let offset = 0;
  let processed = 0;

  while (offset < total) {
    const books = await bookRepo.find({
      skip: offset,
      take: batchSize,
      relations: ['category'],
      order: { createdAt: 'ASC' },
    });

    if (books.length === 0) break;

    for (const book of books) {
      try {
        const text = embeddingProvider.buildBookEmbeddingText({
          title: book.title,
          author: book.author,
          description: book.description,
          categoryName: book.category?.name ?? null,
        });
        const vector = await embeddingProvider.embedText(text);
        await embeddingSearch.storeEmbedding(book.id, vector);
        processed += 1;
      } catch (error) {
        console.warn(`Backfill embedding failed for book ${book.id}:`, error);
      }
    }

    offset += books.length;
    console.log(`Backfill progress: ${processed}/${total}`);
  }
}

async function main(): Promise<void> {
  try {
    await initializeDataSource();
    await backfillEmbeddings();
  } catch (error) {
    console.error('Backfill embeddings failed:', error);
  } finally {
    await closeDataSource();
  }
}

main();
