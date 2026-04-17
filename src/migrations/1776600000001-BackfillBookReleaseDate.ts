import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillBookReleaseDate1776600000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "books"
      SET "release_date" = CASE
        WHEN "publish_year" IS NOT NULL THEN make_date("publish_year", 1, 1)
        ELSE "created_at"::date
      END
      WHERE "release_date" IS NULL;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: keep backfilled release_date values when rolling back
  }
}
