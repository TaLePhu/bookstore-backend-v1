import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMomoPaymentFields1779800000000 implements MigrationInterface {
  name = 'AddMomoPaymentFields1779800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."payment_method_enum" ADD VALUE IF NOT EXISTS 'MOMO'`);
    await queryRunner.query(`ALTER TYPE "public"."payments_method_enum" ADD VALUE IF NOT EXISTS 'MOMO'`);
    await queryRunner.query(`ALTER TABLE "payments" ADD "provider" character varying(50)`);
    await queryRunner.query(`ALTER TABLE "payments" ADD "provider_request_id" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "payments" ADD "provider_order_id" character varying(200)`);
    await queryRunner.query(`ALTER TABLE "payments" ADD "provider_transaction_id" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "payments" ADD "payment_url" text`);
    await queryRunner.query(`ALTER TABLE "payments" ADD "qr_code_url" text`);
    await queryRunner.query(`ALTER TABLE "payments" ADD "deeplink" text`);
    await queryRunner.query(`ALTER TABLE "payments" ADD "raw_response" jsonb`);
    await queryRunner.query(`ALTER TABLE "payments" ADD "paid_at" TIMESTAMP`);
    await queryRunner.query(`CREATE INDEX "idx_payments_provider_order_id" ON "payments" ("provider", "provider_order_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_payments_provider_order_id"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "paid_at"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "raw_response"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "deeplink"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "qr_code_url"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "payment_url"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "provider_transaction_id"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "provider_order_id"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "provider_request_id"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "provider"`);
  }
}
