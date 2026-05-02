import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderCodeToOrder1777710182872 implements MigrationInterface {
    name = 'AddOrderCodeToOrder1777710182872'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD "order_code" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "uq_orders_order_code" UNIQUE ("order_code")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "uq_orders_order_code"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "order_code"`);
    }

}
