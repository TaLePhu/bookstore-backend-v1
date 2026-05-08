import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixEmbeddingsVectorType1779000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector;');

    const columnTypeRows = await queryRunner.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'embeddings'
        AND column_name = 'vector'
      LIMIT 1;
    `);

    const dataType = columnTypeRows?.[0]?.data_type as string | undefined;

    if (dataType && dataType !== 'USER-DEFINED') {
      await queryRunner.query('ALTER TABLE embeddings DROP COLUMN IF EXISTS vector;');
      await queryRunner.query('ALTER TABLE embeddings ADD COLUMN vector vector(1536);');
    } else if (!dataType) {
      await queryRunner.query('ALTER TABLE embeddings ADD COLUMN vector vector(1536);');
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_vector_cosine
      ON embeddings USING ivfflat (vector vector_cosine_ops)
      WITH (lists = 100);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE embeddings DROP COLUMN IF EXISTS vector;');
  }
}
