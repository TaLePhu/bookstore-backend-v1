import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsLockedToUsers1775999000000 implements MigrationInterface {
    name = 'AddIsLockedToUsers1775999000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "users" ADD "is_locked" boolean NOT NULL DEFAULT false`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "users" DROP COLUMN "is_locked"`
        );
    }
}
