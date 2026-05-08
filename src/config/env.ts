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
    url?: string;
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
    logging: boolean;
    ssl: boolean;
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

  // Redis
  redis: {
    host: string;
    port: number;
    password?: string;
  };

  // SMTP
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };

  // Cloudinary
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
    folder?: string;
  };

  // Gemini
  gemini: {
    apiKey: string;
    embeddingModel: string;
    apiVersion: string;
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
      url: process.env['DATABASE_URL'],
      host: throwIfEmpty(process.env['DB_HOST'], 'DB_HOST'),
      port: parseInt(process.env['DB_PORT'] || '5432', 10),
      username: throwIfEmpty(process.env['DB_USERNAME'], 'DB_USERNAME'),
      password: throwIfEmpty(process.env['DB_PASSWORD'], 'DB_PASSWORD'),
      database: throwIfEmpty(process.env['DB_DATABASE'], 'DB_DATABASE'),
      synchronize: process.env['DB_SYNCHRONIZE'] === 'true',
      logging: process.env['DB_LOGGING'] === 'true',
      ssl: process.env['DB_SSL'] === 'true',
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

    redis: {
      host: process.env['REDIS_HOST'] || '127.0.0.1',
      port: parseInt(process.env['REDIS_PORT'] || '6380', 10),
      password: process.env['REDIS_PASSWORD'],
    },

    smtp: {
      host: process.env['SMTP_HOST'] || 'smtp.gmail.com',
      port: parseInt(process.env['SMTP_PORT'] || '587', 10),
      user: process.env['SMTP_USER'] || '',
      pass: process.env['SMTP_PASS'] || '',
    },

    cloudinary: {
      cloudName: throwIfEmpty(process.env['CLOUDINARY_CLOUD_NAME'], 'CLOUDINARY_CLOUD_NAME'),
      apiKey: throwIfEmpty(process.env['CLOUDINARY_API_KEY'], 'CLOUDINARY_API_KEY'),
      apiSecret: throwIfEmpty(process.env['CLOUDINARY_API_SECRET'], 'CLOUDINARY_API_SECRET'),
      folder: process.env['CLOUDINARY_FOLDER'],
    },

    gemini: {
      apiKey: process.env['GEMINI_API_KEY'] || '',
      embeddingModel: process.env['GEMINI_EMBEDDING_MODEL'] || 'text-embedding-004',
      apiVersion: process.env['GEMINI_API_VERSION'] || 'v1',
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
