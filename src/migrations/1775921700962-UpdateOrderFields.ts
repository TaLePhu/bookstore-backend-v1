import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateOrderFields1775921700962 implements MigrationInterface {
    name = 'UpdateOrderFields1775921700962'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD "shipping_fee" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "note" text`);
        
        // Thêm cột cho phép tạm thời null để update dữ liệu cũ
        await queryRunner.query(`ALTER TABLE "order_items" ADD "sub_total" numeric(15,2)`);
        await queryRunner.query(`UPDATE "order_items" SET "sub_total" = "quantity" * "price"`);
        await queryRunner.query(`ALTER TABLE "order_items" ALTER COLUMN "sub_total" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "sub_total"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "note"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "shipping_fee"`);
    }

}
