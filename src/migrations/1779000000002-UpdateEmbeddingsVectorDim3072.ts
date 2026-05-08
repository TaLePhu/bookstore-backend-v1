import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateEmbeddingsVectorDim30721779000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector;');

    await queryRunner.query('ALTER TABLE embeddings DROP COLUMN IF EXISTS vector;');
    await queryRunner.query('ALTER TABLE embeddings ADD COLUMN vector vector(3072);');

    await queryRunner.query('DROP INDEX IF EXISTS idx_embeddings_vector_cosine;');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE embeddings DROP COLUMN IF EXISTS vector;');
  }
}
