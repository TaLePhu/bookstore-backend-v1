import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getEnv } from './env';

// Entities
import { User } from '@entities/User';
import { Address } from '@entities/Address';
import { Book } from '@entities/Book';
import { Category } from '@entities/Category';
import { Cart } from '@entities/Cart';
import { CartItem } from '@entities/CartItem';
import { Order } from '@entities/Order';
import { OrderItem } from '@entities/OrderItem';
import { Payment } from '@entities/Payment';
import { Review } from '@entities/Review';
import { BookImage } from '@entities/BookImage';
import { Embedding } from '@entities/Embedding';
import { UserBehavior } from '@entities/UserBehavior';
import { RefreshToken } from '@entities/RefreshToken';

// Migrations
import { InitialMigration1710000000000 } from '../migrations/1710000000000-InitialMigration';
import { EnablePgvectorExtension1710000000001 } from '../migrations/1710000000001-EnablePgvectorExtension';

const env = getEnv();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.db.host,
  port: env.db.port,
  username: env.db.username,
  password: env.db.password,
  database: env.db.database,
  synchronize: env.db.synchronize,
  logging: env.db.logging,
  entities: [
    User,
    Address,
    Book,
    Category,
    Cart,
    CartItem,
    Order,
    OrderItem,
    Payment,
    Review,
    BookImage,
    Embedding,
    UserBehavior,
    RefreshToken,
  ],
  migrations: [InitialMigration1710000000000, EnablePgvectorExtension1710000000001],
  subscribers: [],
  cache: false,
  dropSchema: false,
  migrationsTransactionMode: 'each',
  namingStrategy: {
    name: 'snakeCase',
    tableName: (targetName: string) => `${targetName.toLowerCase()}`,
    columnName: (_propertyName: string, derivedColumnName: string) => {
      const words = derivedColumnName.split('');
      return words
        .map((word, index) => {
          if (index === 0) return word.toLowerCase();
          return /[A-Z]/.test(word) ? `_${word.toLowerCase()}` : word;
        })
        .join('');
    },
    columnNameWithoutPropertyName: (columnName: string) => columnName,
    classTableInheritanceParentColumnName: (parentTableName: string, propertyName: string) =>
      `${parentTableName}_${propertyName}`,
    foreignKeyName: (
      tableOrName: string,
      columnNames: string[],
      referencedTableName?: string,
      referencedColumnNames?: string[]
    ) =>
      `fk_${tableOrName.toLowerCase()}_${columnNames.join('_').toLowerCase()}_${referencedTableName?.toLowerCase()}`,
    primaryKeyName: (tableOrName: string, columnNames: string[]) =>
      `pk_${tableOrName.toLowerCase()}_${columnNames.join('_').toLowerCase()}`,
    uniqueConstraintName: (tableOrName: string, columnNames: string[]) =>
      `uq_${tableOrName.toLowerCase()}_${columnNames.join('_').toLowerCase()}`,
    relationName: (propertyName: string) => propertyName,
    indexName: (tableOrName: string, columnNames: string[]) =>
      `idx_${tableOrName.toLowerCase()}_${columnNames.join('_').toLowerCase()}`,
    checkConstraintName: (tableOrName: string, columnNames: string[]) =>
      `chk_${tableOrName.toLowerCase()}_${columnNames.join('_').toLowerCase()}`,
    exclusionConstraintName: (tableOrName: string, columnNames: string[]) =>
      `exl_${tableOrName.toLowerCase()}_${columnNames.join('_').toLowerCase()}`,
  } as any,
});

export async function initializeDataSource(): Promise<void> {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connection established successfully');

    // Run migrations
    if (env.nodeEnv === 'production' || !env.db.synchronize) {
      const pendingMigrations = await AppDataSource.showMigrations();
      if (pendingMigrations) {
        console.log('Running pending migrations...');
        await AppDataSource.runMigrations();
        console.log('✅ Migrations executed successfully');
      }
    }
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

export async function closeDataSource(): Promise<void> {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('✅ Database connection closed');
    }
  } catch (error) {
    console.error('❌ Failed to close database connection:', error);
  }
}
