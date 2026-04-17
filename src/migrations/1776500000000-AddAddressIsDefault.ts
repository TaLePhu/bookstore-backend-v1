import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAddressIsDefault1776500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "addresses"
      ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          user_id,
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
        FROM addresses
      )
      UPDATE addresses a
      SET is_default = true
      FROM ranked r
      WHERE a.id = r.id
        AND r.rn = 1
        AND NOT EXISTS (
          SELECT 1
          FROM addresses ax
          WHERE ax.user_id = r.user_id
            AND ax.is_default = true
        );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_addresses_one_default_per_user"
      ON "addresses" ("user_id")
      WHERE is_default = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_addresses_one_default_per_user";
    `);

    await queryRunner.query(`
      ALTER TABLE "addresses"
      DROP COLUMN IF EXISTS "is_default";
    `);
  }
}
