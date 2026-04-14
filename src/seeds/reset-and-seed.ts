import { AppDataSource } from '../config/data-source';
import { runSeed } from './seed';

const EXCLUDED_TABLES = ['migrations', 'typeorm_metadata'];

async function resetAllAppTables(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_RESET_DB !== 'true') {
    throw new Error('Refuse to reset DB in production. Set FORCE_RESET_DB=true if you really need this.');
  }

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    const tables: Array<{ tablename: string }> = await queryRunner.query(
      `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN (${EXCLUDED_TABLES.map(table => `'${table}'`).join(', ')})
      ORDER BY tablename;
      `
    );

    if (tables.length === 0) {
      console.log('ℹ️ Không tìm thấy bảng nghiệp vụ để reset.');
      return;
    }

    const tableList = tables.map(table => `"${table.tablename}"`).join(', ');
    console.log(`🧹 Reset ${tables.length} bảng...`);
    await queryRunner.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
  } finally {
    await queryRunner.release();
  }
}

async function resetAndSeed(): Promise<void> {
  await AppDataSource.initialize();

  try {
    console.log('🚨 Bắt đầu RESET toàn bộ dữ liệu ứng dụng...');
    await resetAllAppTables();

    console.log('🌱 Bắt đầu seed lại dữ liệu mẫu...');
    await runSeed({
      initializeDataSource: false,
      destroyDataSource: false,
      cleanupBeforeSeed: false,
    });

    console.log('✅ RESET + SEED hoàn tất.');
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

resetAndSeed().catch(error => {
  console.error('❌ Lỗi khi reset và seed database:', error);
  process.exit(1);
});
