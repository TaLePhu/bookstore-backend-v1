import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategorySoftDelete1779200000000 implements MigrationInterface {
  name = 'AddCategorySoftDelete1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "deleted_at" timestamp
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
      DROP COLUMN IF EXISTS "deleted_at",
      DROP COLUMN IF EXISTS "updated_at"
    `);
  }
}
