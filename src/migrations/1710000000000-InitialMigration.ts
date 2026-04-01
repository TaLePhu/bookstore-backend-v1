import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class InitialMigration1710000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create roles enum type
    await queryRunner.query(`
      CREATE TYPE "public"."role_enum" AS ENUM ('GUEST', 'CUSTOMER', 'STAFF', 'ADMIN')
    `);

    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          { name: 'email', type: 'varchar', length: '255', isNullable: false, isUnique: true },
          { name: 'password_hash', type: 'varchar', length: '255', isNullable: false },
          {
            name: 'role',
            type: 'enum',
            enum: ['GUEST', 'CUSTOMER', 'STAFF', 'ADMIN'],
            default: `'CUSTOMER'`,
          },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [new TableIndex({ columnNames: ['email'] })],
      })
    );

    // Create addresses table
    await queryRunner.createTable(
      new Table({
        name: 'addresses',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'receiver_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'phone', type: 'varchar', length: '20', isNullable: false },
          { name: 'address_line', type: 'varchar', length: '500', isNullable: false },
          { name: 'city', type: 'varchar', length: '100', isNullable: false },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      })
    );

    await queryRunner.createForeignKey(
      'addresses',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );

    // Create categories table
    await queryRunner.createTable(
      new Table({
        name: 'categories',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'name', type: 'varchar', length: '255', isNullable: false, isUnique: true },
          { name: 'description', type: 'text', isNullable: false },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      })
    );

    // Create books table
    await queryRunner.createTable(
      new Table({
        name: 'books',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'title', type: 'varchar', length: '255', isNullable: false },
          { name: 'author', type: 'varchar', length: '255', isNullable: false },
          { name: 'description', type: 'text', isNullable: false },
          { name: 'price', type: 'decimal', precision: 10, scale: 2, isNullable: false },
          { name: 'stock', type: 'integer', isNullable: false },
          { name: 'isbn', type: 'varchar', length: '20', isNullable: false, isUnique: true },
          { name: 'category_id', type: 'uuid', isNullable: false },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      })
    );

    await queryRunner.createForeignKey(
      'books',
      new TableForeignKey({
        columnNames: ['category_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'categories',
        onDelete: 'CASCADE',
      })
    );

    // Create carts table
    await queryRunner.createTable(
      new Table({
        name: 'carts',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      })
    );

    await queryRunner.createForeignKey(
      'carts',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );

    // Create cart_items table
    await queryRunner.createTable(
      new Table({
        name: 'cart_items',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'cart_id', type: 'uuid', isNullable: false },
          { name: 'book_id', type: 'uuid', isNullable: false },
          { name: 'quantity', type: 'integer', isNullable: false },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [new TableIndex({ columnNames: ['cart_id', 'book_id'], isUnique: true })],
      })
    );

    await queryRunner.createForeignKey(
      'cart_items',
      new TableForeignKey({
        columnNames: ['cart_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'carts',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'cart_items',
      new TableForeignKey({
        columnNames: ['book_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'books',
        onDelete: 'CASCADE',
      })
    );

    // Create orders table
    await queryRunner.query(`
      CREATE TYPE "public"."order_status_enum" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'orders',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'total_amount', type: 'decimal', precision: 15, scale: 2, isNullable: false },
          {
            name: 'status',
            type: 'enum',
            enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'],
            default: `'PENDING'`,
          },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'address_id', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      })
    );

    await queryRunner.createForeignKey(
      'orders',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'orders',
      new TableForeignKey({
        columnNames: ['address_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'addresses',
        onDelete: 'SET NULL',
      })
    );

    // Create order_items table
    await queryRunner.createTable(
      new Table({
        name: 'order_items',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'order_id', type: 'uuid', isNullable: false },
          { name: 'book_id', type: 'uuid', isNullable: false },
          { name: 'quantity', type: 'integer', isNullable: false },
          { name: 'price', type: 'decimal', precision: 15, scale: 2, isNullable: false },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      })
    );

    await queryRunner.createForeignKey(
      'order_items',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'order_items',
      new TableForeignKey({
        columnNames: ['book_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'books',
        onDelete: 'CASCADE',
      })
    );

    // Create payments table
    await queryRunner.query(`
      CREATE TYPE "public"."payment_method_enum" AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'WALLET')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."payment_status_enum" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'payments',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'order_id', type: 'uuid', isNullable: false },
          { name: 'amount', type: 'decimal', precision: 15, scale: 2, isNullable: false },
          {
            name: 'method',
            type: 'enum',
            enum: ['CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'WALLET'],
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'],
            default: `'PENDING'`,
          },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      })
    );

    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'CASCADE',
      })
    );

    // Create reviews table
    await queryRunner.createTable(
      new Table({
        name: 'reviews',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'book_id', type: 'uuid', isNullable: false },
          { name: 'rating', type: 'integer', isNullable: false },
          { name: 'comment', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      })
    );

    await queryRunner.createForeignKey(
      'reviews',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'reviews',
      new TableForeignKey({
        columnNames: ['book_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'books',
        onDelete: 'CASCADE',
      })
    );

    // Create book_images table
    await queryRunner.createTable(
      new Table({
        name: 'book_images',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'book_id', type: 'uuid', isNullable: false },
          { name: 'url', type: 'varchar', length: '500', isNullable: false },
          { name: 'is_primary', type: 'boolean', default: false },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      })
    );

    await queryRunner.createForeignKey(
      'book_images',
      new TableForeignKey({
        columnNames: ['book_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'books',
        onDelete: 'CASCADE',
      })
    );

    // Create embeddings table (will add vector column in next migration after pgvector extension)
    await queryRunner.createTable(
      new Table({
        name: 'embeddings',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'book_id', type: 'uuid', isNullable: false },
          { name: 'vector', type: 'bytea', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [new TableIndex({ columnNames: ['book_id'] })],
      })
    );

    await queryRunner.createForeignKey(
      'embeddings',
      new TableForeignKey({
        columnNames: ['book_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'books',
        onDelete: 'CASCADE',
      })
    );

    // Create user_behaviors table
    await queryRunner.query(`
      CREATE TYPE "public"."behavior_type_enum" AS ENUM ('VIEW', 'CLICK', 'ADD_TO_CART', 'PURCHASE', 'WISHLIST')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'user_behaviors',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'book_id', type: 'uuid', isNullable: false },
          {
            name: 'behavior_type',
            type: 'enum',
            enum: ['VIEW', 'CLICK', 'ADD_TO_CART', 'PURCHASE', 'WISHLIST'],
          },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [new TableIndex({ columnNames: ['user_id', 'created_at'] })],
      })
    );

    await queryRunner.createForeignKey(
      'user_behaviors',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'user_behaviors',
      new TableForeignKey({
        columnNames: ['book_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'books',
        onDelete: 'CASCADE',
      })
    );

    // Create refresh_tokens table
    await queryRunner.createTable(
      new Table({
        name: 'refresh_tokens',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isNullable: false },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'token', type: 'text', isNullable: false },
          { name: 'expires_at', type: 'timestamp', isNullable: false },
          { name: 'is_revoked', type: 'boolean', default: false },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [new TableIndex({ columnNames: ['user_id', 'created_at'] })],
      })
    );

    await queryRunner.createForeignKey(
      'refresh_tokens',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all foreign keys and tables in reverse order
    const tables = [
      'refresh_tokens',
      'user_behaviors',
      'book_images',
      'embeddings',
      'reviews',
      'payments',
      'order_items',
      'orders',
      'cart_items',
      'carts',
      'books',
      'categories',
      'addresses',
      'users',
    ];

    for (const table of tables) {
      const table_ref = await queryRunner.query(
        `SELECT * FROM information_schema.tables WHERE table_name = '${table}'`
      );
      if (table_ref.length > 0) {
        await queryRunner.dropTable(table);
      }
    }

    // Drop enum types
    const enums = ['role_enum', 'order_status_enum', 'payment_method_enum', 'payment_status_enum', 'behavior_type_enum'];
    for (const enumType of enums) {
      try {
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."${enumType}"`);
      } catch {
        // Type might not exist
      }
    }
  }
}
