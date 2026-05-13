import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromotionBannerImage1779400000000 implements MigrationInterface {
  name = 'AddPromotionBannerImage1779400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "promotions"
      ADD COLUMN IF NOT EXISTS "banner_image_url" varchar(500),
      ADD COLUMN IF NOT EXISTS "banner_image_public_id" varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "promotions" DROP COLUMN IF EXISTS "banner_image_public_id"`);
    await queryRunner.query(`ALTER TABLE "promotions" DROP COLUMN IF EXISTS "banner_image_url"`);
  }
}
