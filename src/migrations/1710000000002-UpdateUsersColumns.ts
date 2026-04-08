import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateUsersColumns1710000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasName = await queryRunner.hasColumn('users', 'name');
    if (hasName) {
      await queryRunner.renameColumn('users', 'name', 'user_name');
    }

    const hasUserName = await queryRunner.hasColumn('users', 'user_name');
    if (!hasUserName && !hasName) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'user_name',
          type: 'varchar',
          length: '255',
          isNullable: true,
        })
      );
    }

    const hasFullName = await queryRunner.hasColumn('users', 'full_name');
    if (!hasFullName) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'full_name',
          type: 'varchar',
          length: '255',
          isNullable: true,
        })
      );
    }

    const hasIsVerified = await queryRunner.hasColumn('users', 'is_verified');
    if (!hasIsVerified) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'is_verified',
          type: 'boolean',
          default: false,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasIsVerified = await queryRunner.hasColumn('users', 'is_verified');
    if (hasIsVerified) {
      await queryRunner.dropColumn('users', 'is_verified');
    }

    const hasFullName = await queryRunner.hasColumn('users', 'full_name');
    if (hasFullName) {
      await queryRunner.dropColumn('users', 'full_name');
    }

    const hasUserName = await queryRunner.hasColumn('users', 'user_name');
    const hasName = await queryRunner.hasColumn('users', 'name');
    if (hasUserName && !hasName) {
      await queryRunner.renameColumn('users', 'user_name', 'name');
    }
  }
}
