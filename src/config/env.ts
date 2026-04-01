import dotenv from 'dotenv';

dotenv.config();

export type NodeEnv = 'development' | 'production' | 'test';

export interface EnvConfig {
  // App
  nodeEnv: NodeEnv;
  port: number;
  appName: string;
  logLevel: string;

  // Database
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
    logging: boolean;
  };

  // JWT
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };

  // Security
  bcryptRounds: number;

  // CORS
  corsOrigin: string;

  // Rate Limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

function parseEnv(): EnvConfig {
  const throwIfEmpty = (value: string | undefined, key: string): string => {
    if (!value) {
      throw new Error(`Environment variable ${key} is required but not set`);
    }
    return value;
  };

  return {
    nodeEnv: (process.env['NODE_ENV'] as NodeEnv) || 'development',
    port: parseInt(process.env['PORT'] || '3000', 10),
    appName: process.env['APP_NAME'] || 'BookStore Backend',
    logLevel: process.env['LOG_LEVEL'] || 'debug',

    db: {
      host: throwIfEmpty(process.env['DB_HOST'], 'DB_HOST'),
      port: parseInt(process.env['DB_PORT'] || '5432', 10),
      username: throwIfEmpty(process.env['DB_USERNAME'], 'DB_USERNAME'),
      password: throwIfEmpty(process.env['DB_PASSWORD'], 'DB_PASSWORD'),
      database: throwIfEmpty(process.env['DB_DATABASE'], 'DB_DATABASE'),
      synchronize: process.env['DB_SYNCHRONIZE'] === 'true',
      logging: process.env['DB_LOGGING'] === 'true',
    },

    jwt: {
      accessSecret: throwIfEmpty(process.env['JWT_ACCESS_SECRET'], 'JWT_ACCESS_SECRET'),
      accessExpiresIn: process.env['JWT_ACCESS_EXPIRES'] || '15m',
      refreshSecret: throwIfEmpty(process.env['JWT_REFRESH_SECRET'], 'JWT_REFRESH_SECRET'),
      refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES'] || '7d',
    },

    bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] || '10', 10),

    corsOrigin: process.env['CORS_ORIGIN'] || 'http://localhost:3001',

    rateLimit: {
      windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '15000', 10),
      maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
    },
  };
}

let config: EnvConfig;

export function getEnv(): EnvConfig {
  if (!config) {
    config = parseEnv();
  }
  return config;
}
