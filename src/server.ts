import 'reflect-metadata';
import { createApp } from './app';
import { getEnv } from '@config/env';
import { initializeDataSource, closeDataSource } from '@config/data-source';

async function bootstrap() {
  const env = getEnv();
  const app = createApp();

  try {
    // Note: setupDependencies() is called in app.ts before routes are imported
    console.log('✅ Dependency Injection configured');

    // Initialize database
    await initializeDataSource();
    console.log('✅ Database initialized');

    // Start server
    const server = app.listen(env.port, () => {
      console.log(`
╔════════════════════════════════════════╗
║  ${env.appName}        ║
║  Server running on port ${env.port}              ║
║  Environment: ${env.nodeEnv}                  ║
╚════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    async function gracefulShutdown() {
      console.log('\n🛑 Shutting down gracefully...');
      server.close(async () => {
        await closeDataSource();
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Force shutting down...');
        process.exit(1);
      }, 10000);
    }

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap();
