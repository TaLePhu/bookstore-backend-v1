import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReviewOrderLink1779500000000 implements MigrationInterface {
  name = 'AddReviewOrderLink1779500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" ADD "order_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews_order_id_orders" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_reviews_order_id_book_id" ON "reviews" ("order_id", "book_id") WHERE "order_id" IS NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_reviews_order_id_book_id"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "fk_reviews_order_id_orders"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "order_id"`);
  }
}
