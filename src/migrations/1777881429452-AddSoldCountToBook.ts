import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSoldCountToBook1777881429452 implements MigrationInterface {
    name = 'AddSoldCountToBook1777881429452'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "books" ADD "sold_count" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "books" DROP COLUMN "sold_count"`);
    }

}
