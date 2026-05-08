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
import { UserAdvance } from '@entities/UserAdvance';
import { OrderStatusLog } from '@entities/OrderStatusLog';

// Migrations
import { InitialMigration1710000000000 } from '../migrations/1710000000000-InitialMigration';
import { EnablePgvectorExtension1710000000001 } from '../migrations/1710000000001-EnablePgvectorExtension';
import { UpdateUsersColumns1710000000002 } from '../migrations/1710000000002-UpdateUsersColumns';
import { CreateUserAdvances1710000000003 } from '../migrations/1710000000003-CreateUserAdvances';
import { AddBookDetails1775747431811 } from '../migrations/1775747431811-AddBookDetails';
import { UpdateOrderFields1775921700962 } from '../migrations/1775921700962-UpdateOrderFields';
import { AddIsLockedToUsers1775999000000 } from '../migrations/1775999000000-AddIsLockedToUsers';
import { UpdateAddressAndPaymentFields1776241539788 } from '@/migrations/1776241539788-UpdateAddressAndPaymentFields';
import { AddAddressIsDefault1776500000000 } from '../migrations/1776500000000-AddAddressIsDefault';
import { AddBookReleaseDate1776600000000 } from '../migrations/1776600000000-AddBookReleaseDate';
import { BackfillBookReleaseDate1776600000001 } from '../migrations/1776600000001-BackfillBookReleaseDate';
import { AddRefreshTokenDeviceId1777000000000 } from '@/migrations/1777000000000-AddRefreshTokenDeviceId';
import { AddOrderCodeToOrder1777710182872 } from '../migrations/1777710182872-AddOrderCodeToOrder';
import { AddSoldCountToBook1777881429452 } from '../migrations/1777881429452-AddSoldCountToBook';
import { AddBookImagePublicId1778000000000 } from '../migrations/1778000000000-AddBookImagePublicId';
import { CreateOrderStatusLogs1779000000000 } from '../migrations/1779000000000-CreateOrderStatusLogs';
import { FixEmbeddingsVectorType1779000000001 } from '../migrations/1779000000001-FixEmbeddingsVectorType';
import { UpdateEmbeddingsVectorDim30721779000000002 } from '../migrations/1779000000002-UpdateEmbeddingsVectorDim3072';

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
    UserAdvance,
    RefreshToken,
    OrderStatusLog,
  ],
  migrations: [
    InitialMigration1710000000000,
    EnablePgvectorExtension1710000000001,
    UpdateUsersColumns1710000000002,
    CreateUserAdvances1710000000003,
    AddBookDetails1775747431811,
    UpdateOrderFields1775921700962,
    AddIsLockedToUsers1775999000000,
    UpdateAddressAndPaymentFields1776241539788,
    AddAddressIsDefault1776500000000,
    AddBookReleaseDate1776600000000,
    BackfillBookReleaseDate1776600000001,
    AddRefreshTokenDeviceId1777000000000,
    AddOrderCodeToOrder1777710182872,
    AddSoldCountToBook1777881429452,
    AddBookImagePublicId1778000000000,
    CreateOrderStatusLogs1779000000000,
    FixEmbeddingsVectorType1779000000001,
    UpdateEmbeddingsVectorDim30721779000000002,
  ],
  subscribers: [],
  cache: false,
  dropSchema: false,
  migrationsTransactionMode: 'each',
  namingStrategy: {
    name: 'snakeCase',
    tableName: (targetName: any, userSpecifiedName?: string) => {
      if (userSpecifiedName) return userSpecifiedName;
      const name = typeof targetName === 'string' ? targetName : targetName.name;
      return name.toLowerCase();
    },
    columnName: (propertyName: string, customName: string) => {
      const name = customName || propertyName;
      const words = name.split('');
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
      tableOrName: any,
      columnNames: string[],
      referencedTableName?: any,
      referencedColumnNames?: string[]
    ) => {
      const tbName = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
      const refName = referencedTableName ? (typeof referencedTableName === 'string' ? referencedTableName : referencedTableName.name) : 'ref';
      return `fk_${tbName.toLowerCase()}_${columnNames.join('_').toLowerCase()}_${refName.toLowerCase()}`;
    },
    primaryKeyName: (tableOrName: any, columnNames: string[]) => {
      const tbName = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
      return `pk_${tbName.toLowerCase()}_${columnNames.join('_').toLowerCase()}`;
    },
    uniqueConstraintName: (tableOrName: any, columnNames: string[]) => {
      const tbName = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
      return `uq_${tbName.toLowerCase()}_${columnNames.join('_').toLowerCase()}`;
    },
    relationName: (propertyName: string) => propertyName,
    relationConstraintName: (
      tableOrName: any,
      columnNames: string[],
      referencedTableName?: any
    ) => {
      const tbName = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
      const refName = referencedTableName
        ? typeof referencedTableName === 'string'
          ? referencedTableName
          : referencedTableName.name
        : 'ref';
      return `rel_${tbName.toLowerCase()}_${columnNames.join('_').toLowerCase()}_${refName.toLowerCase()}`;
    },
    indexName: (tableOrName: any, columnNames: string[]) => {
      const tbName = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
      return `idx_${tbName.toLowerCase()}_${columnNames.join('_').toLowerCase()}`;
    },
    checkConstraintName: (tableOrName: any, expression: any) => {
      const tbName = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
      const suffix = Array.isArray(expression) ? expression.join('_').toLowerCase() : 'chk';
      return `chk_${tbName.toLowerCase()}_${suffix}`;
    },
    exclusionConstraintName: (tableOrName: any, expression: any) => {
      const tbName = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
      const suffix = Array.isArray(expression) ? expression.join('_').toLowerCase() : 'excl';
      return `exl_${tbName.toLowerCase()}_${suffix}`;
    },
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
