import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookSoftDelete1779100000000 implements MigrationInterface {
  name = 'AddBookSoftDelete1779100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "books"
      ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "books"
      DROP COLUMN IF EXISTS "deleted_at";
    `);
  }
}
