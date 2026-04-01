import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePgvectorExtension1710000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    // Alter embeddings table to use vector type
    await queryRunner.query(`
      ALTER TABLE embeddings DROP COLUMN IF EXISTS vector;
    `);
    await queryRunner.query(`
      ALTER TABLE embeddings ADD COLUMN vector vector(1536);
    `);

    // Create index for vector similarity search
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_vector_cosine 
      ON embeddings USING ivfflat (vector vector_cosine_ops)
      WITH (lists = 100);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop vector column
    await queryRunner.query(`
      ALTER TABLE embeddings
      DROP COLUMN IF EXISTS vector;
    `);

    // Drop pgvector extension
    await queryRunner.query(`DROP EXTENSION IF NOT EXISTS vector CASCADE;`);
  }
}
