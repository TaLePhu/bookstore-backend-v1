import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePromotions1779300000000 implements MigrationInterface {
  name = 'CreatePromotions1779300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."promotion_status_enum" AS ENUM ('ACTIVE', 'INACTIVE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "promotions" (
        "id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "discount_percent" integer NOT NULL DEFAULT 0,
        "starts_at" timestamp,
        "ends_at" timestamp,
        "status" "public"."promotion_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "pk_promotions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "promotion_books" (
        "id" uuid NOT NULL,
        "promotion_id" uuid NOT NULL,
        "book_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "pk_promotion_books_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_promotion_books_promotion_id_book_id" UNIQUE ("promotion_id", "book_id"),
        CONSTRAINT "fk_promotion_books_promotion_id_promotions" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_promotion_books_book_id_books" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "promotion_books"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "promotions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."promotion_status_enum"`);
  }
}
