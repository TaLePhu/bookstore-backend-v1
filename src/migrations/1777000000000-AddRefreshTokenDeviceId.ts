import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddRefreshTokenDeviceId1777000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'refresh_tokens',
      new TableColumn({
        name: 'device_id',
        type: 'uuid',
        isNullable: true,
      })
    );

    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({
        name: 'idx_refresh_tokens_user_id_device_id_created_at',
        columnNames: ['user_id', 'device_id', 'created_at'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('refresh_tokens', 'idx_refresh_tokens_user_id_device_id_created_at');
    await queryRunner.dropColumn('refresh_tokens', 'device_id');
  }
}
