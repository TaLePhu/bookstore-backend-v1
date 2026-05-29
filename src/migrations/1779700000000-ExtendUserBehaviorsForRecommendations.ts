import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendUserBehaviorsForRecommendations1779700000000 implements MigrationInterface {
  name = 'ExtendUserBehaviorsForRecommendations1779700000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_behaviors" ALTER COLUMN "book_id" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "user_behaviors" ADD COLUMN IF NOT EXISTS "query_text" text`);
    await queryRunner.query(`ALTER TABLE "user_behaviors" ADD COLUMN IF NOT EXISTS "metadata" jsonb`);
    await queryRunner.query(`
      DO $$
      DECLARE enum_name text;
      BEGIN
        SELECT typname INTO enum_name
        FROM pg_type
        WHERE typname IN ('user_behaviors_behavior_type_enum', 'behavior_type_enum')
        ORDER BY CASE WHEN typname = 'user_behaviors_behavior_type_enum' THEN 0 ELSE 1 END
        LIMIT 1;

        IF enum_name IS NOT NULL THEN
          EXECUTE format('ALTER TYPE "public".%I ADD VALUE IF NOT EXISTS ''SEARCH''', enum_name);
          EXECUTE format('ALTER TYPE "public".%I ADD VALUE IF NOT EXISTS ''AI_ADVISOR_QUERY''', enum_name);
        END IF;
      END $$;
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_behaviors_type_created_at" ON "user_behaviors" ("behavior_type", "created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_behaviors_type_created_at"`);
    await queryRunner.query(`DELETE FROM "user_behaviors" WHERE "book_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "user_behaviors" DROP COLUMN IF EXISTS "metadata"`);
    await queryRunner.query(`ALTER TABLE "user_behaviors" DROP COLUMN IF EXISTS "query_text"`);
    await queryRunner.query(`ALTER TABLE "user_behaviors" ALTER COLUMN "book_id" SET NOT NULL`);
  }
}
