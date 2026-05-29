import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAIAdvisorConversations1779600000000 implements MigrationInterface {
  name = 'CreateAIAdvisorConversations1779600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_advisor_conversations" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "title" character varying(160) NOT NULL,
        "messages" jsonb NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_ai_advisor_conversations_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_ai_advisor_conversations_user_id_updated_at" ON "ai_advisor_conversations" ("user_id", "updated_at")`
    );
    await queryRunner.query(
      `ALTER TABLE "ai_advisor_conversations" ADD CONSTRAINT "fk_ai_advisor_conversations_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_advisor_conversations" DROP CONSTRAINT "fk_ai_advisor_conversations_user_id_users"`);
    await queryRunner.query(`DROP INDEX "idx_ai_advisor_conversations_user_id_updated_at"`);
    await queryRunner.query(`DROP TABLE "ai_advisor_conversations"`);
  }
}
