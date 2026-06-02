import './register-paths';
import 'reflect-metadata';
import { Server } from 'http';
import { Express } from 'express';
import { createApp } from './app';
import { getEnv } from '@config/env';
import { initializeDataSource, closeDataSource } from '@config/data-source';
import { startPromotionScheduler, stopPromotionScheduler } from './jobs/promotion-scheduler';

const MAX_PORT_RETRIES = 10;

function listenOnPort(app: Express, port: number): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);

    const onError = (error: NodeJS.ErrnoException) => {
      server.off('listening', onListening);
      reject(error);
    };

    const onListening = () => {
      server.off('error', onError);
      resolve({ server, port });
    };

    server.once('error', onError);
    server.once('listening', onListening);
  });
}

async function startServer(app: Express, preferredPort: number, allowPortRetry: boolean) {
  for (let attempt = 0; attempt <= MAX_PORT_RETRIES; attempt += 1) {
    const port = preferredPort + attempt;

    try {
      return await listenOnPort(app, port);
    } catch (error) {
      const listenError = error as NodeJS.ErrnoException;
      const canRetry = allowPortRetry && listenError.code === 'EADDRINUSE' && attempt < MAX_PORT_RETRIES;

      if (!canRetry) {
        throw listenError;
      }

      console.warn(`Port ${port} is already in use. Trying ${port + 1}...`);
    }
  }

  throw new Error(`No available port found from ${preferredPort} to ${preferredPort + MAX_PORT_RETRIES}`);
}

async function bootstrap() {
  const env = getEnv();
  const app = createApp();

  try {
    // Note: setupDependencies() is called in app.ts before routes are imported
    console.log('Dependency Injection configured');

    // Initialize database
    await initializeDataSource();
    console.log('Database initialized');
    startPromotionScheduler();

    // Start server
    const { server, port } = await startServer(app, env.port, env.nodeEnv !== 'production');

    if (port !== env.port) {
      console.warn(`Configured port ${env.port} was busy. Backend is running on port ${port}.`);
      console.warn(`Update VITE_API_URL to http://localhost:${port}/api/v1 if the frontend cannot reach the API.`);
    }

    console.log(`
========================================
  ${env.appName}
  Server running on port ${port}
  Environment: ${env.nodeEnv}
========================================
    `);

    // Graceful shutdown
    async function gracefulShutdown() {
      console.log('\nShutting down gracefully...');
      stopPromotionScheduler();
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
    const listenError = error as NodeJS.ErrnoException;

    if (listenError.code === 'EADDRINUSE') {
      console.error(`Port ${env.port} is already in use.`);
      console.error('Close the process using that port or change PORT in .env.');
    } else {
      console.error('Bootstrap failed:', error);
    }

    await closeDataSource().catch(() => undefined);
    process.exit(1);
  }
}

bootstrap();
