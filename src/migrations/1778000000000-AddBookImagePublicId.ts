import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBookImagePublicId1778000000000 implements MigrationInterface {
  name = 'AddBookImagePublicId1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'book_images',
      new TableColumn({
        name: 'public_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('book_images', 'public_id');
  }
}
