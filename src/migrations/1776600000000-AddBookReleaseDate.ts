import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookReleaseDate1776600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "books"
      ADD COLUMN IF NOT EXISTS "release_date" date;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "books"
      DROP COLUMN IF EXISTS "release_date";
    `);
  }
}
