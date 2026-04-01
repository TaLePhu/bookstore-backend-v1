import 'reflect-metadata';
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { getEnv } from '@config/env';
import { errorHandler, notFoundHandler } from '@middlewares/error.middleware';
import { setupDependencies } from '@config/container';

// Setup DI BEFORE importing routes
setupDependencies();

import routes from '@routes/index';

export function createApp(): Express {
  const app = express();
  const env = getEnv();

  // Security middlewares
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.maxRequests,
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use(limiter);

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/v1', routes);

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

export default createApp;
