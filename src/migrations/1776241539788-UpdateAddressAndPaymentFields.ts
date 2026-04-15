import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateAddressAndPaymentFields1776241539788 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Alter Payment Method enum
        await queryRunner.query(`ALTER TYPE "public"."payment_method_enum" ADD VALUE IF NOT EXISTS 'COD'`);
        await queryRunner.query(`ALTER TYPE "public"."payments_method_enum" ADD VALUE IF NOT EXISTS 'COD'`);

        // Drop address from user_advances
        await queryRunner.query(`ALTER TABLE "user_advances" DROP COLUMN IF EXISTS "address"`);

        // Re-structure addresses table
        await queryRunner.query(`ALTER TABLE "addresses" DROP COLUMN IF EXISTS "city"`);
        
        await queryRunner.query(`ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "country" varchar(100) DEFAULT 'Việt Nam'`);
        await queryRunner.query(`ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "province_code" varchar(50)`);
        await queryRunner.query(`ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "province_name" varchar(100)`);
        await queryRunner.query(`ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "district_code" varchar(50)`);
        await queryRunner.query(`ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "district_name" varchar(100)`);
        await queryRunner.query(`ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "ward_code" varchar(50)`);
        await queryRunner.query(`ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "ward_name" varchar(100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert addresses table changes
        await queryRunner.query(`ALTER TABLE "addresses" DROP COLUMN IF EXISTS "country"`);
        await queryRunner.query(`ALTER TABLE "addresses" DROP COLUMN IF EXISTS "province_code"`);
        await queryRunner.query(`ALTER TABLE "addresses" DROP COLUMN IF EXISTS "province_name"`);
        await queryRunner.query(`ALTER TABLE "addresses" DROP COLUMN IF EXISTS "district_code"`);
        await queryRunner.query(`ALTER TABLE "addresses" DROP COLUMN IF EXISTS "district_name"`);
        await queryRunner.query(`ALTER TABLE "addresses" DROP COLUMN IF EXISTS "ward_code"`);
        await queryRunner.query(`ALTER TABLE "addresses" DROP COLUMN IF EXISTS "ward_name"`);
        
        await queryRunner.query(`ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "city" varchar(100)`);

        // Revert user_advances address column
        await queryRunner.query(`ALTER TABLE "user_advances" ADD COLUMN IF NOT EXISTS "address" text`);

        // Cannot easily remove value from ENUM in Postgres, so we leave 'COD'
    }

}
