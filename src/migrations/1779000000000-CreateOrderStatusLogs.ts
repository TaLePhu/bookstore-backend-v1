import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrderStatusLogs1779000000000 implements MigrationInterface {
    name = 'CreateOrderStatusLogs1779000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "order_status_logs" ("id" uuid NOT NULL, "from_status" "public"."order_status_enum" NOT NULL, "to_status" "public"."order_status_enum" NOT NULL, "note" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "order_id" uuid NOT NULL, "changed_by" uuid, CONSTRAINT "pk_order_status_logs_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_order_status_logs_order_id" ON "order_status_logs" ("order_id")`);
        await queryRunner.query(`CREATE INDEX "idx_order_status_logs_changed_by" ON "order_status_logs" ("changed_by")`);
        await queryRunner.query(`ALTER TABLE "order_status_logs" ADD CONSTRAINT "fk_order_status_logs_order_id_orders" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_status_logs" ADD CONSTRAINT "fk_order_status_logs_changed_by_users" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_status_logs" DROP CONSTRAINT "fk_order_status_logs_changed_by_users"`);
        await queryRunner.query(`ALTER TABLE "order_status_logs" DROP CONSTRAINT "fk_order_status_logs_order_id_orders"`);
        await queryRunner.query(`DROP INDEX "public"."idx_order_status_logs_changed_by"`);
        await queryRunner.query(`DROP INDEX "public"."idx_order_status_logs_order_id"`);
        await queryRunner.query(`DROP TABLE "order_status_logs"`);
    }

}
