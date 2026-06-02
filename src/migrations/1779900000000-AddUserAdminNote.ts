import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAdminNote1779900000000 implements MigrationInterface {
  name = 'AddUserAdminNote1779900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_note" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "admin_note"`);
  }
}
