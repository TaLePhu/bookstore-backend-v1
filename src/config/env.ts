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
  corsOrigin: string | string[];

  // Rate Limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };

  // Redis
  redis: {
    url?: string;
    host: string;
    port: number;
    password?: string;
    tls: boolean;
  };

  // SMTP
  smtp: {
    host: string;
    port: number;
    family: 4 | 6;
    user: string;
    pass: string;
    rejectUnauthorized: boolean;
  };

  // Email
  email: {
    from: string;
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
    generationModel: string;
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
  const databaseUrl = process.env['DATABASE_URL'];
  const redisUrl = process.env['REDIS_URL'];
  const parsedRedisUrl = redisUrl ? new URL(redisUrl) : null;
  const redisProtocol = parsedRedisUrl?.protocol;
  const redisTls =
    process.env['REDIS_TLS'] === 'true' ||
    redisProtocol === 'rediss:';

  const dbSsl =
    process.env['DB_SSL'] === 'true' ||
    Boolean(databaseUrl && databaseUrl.includes('sslmode=require'));
  const nodeEnv = (process.env['NODE_ENV'] as NodeEnv) || 'development';
  const dbSynchronize = process.env['DB_SYNCHRONIZE'] === 'true';
  const corsOrigin = (process.env['CORS_ORIGIN'] || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (nodeEnv === 'production' && dbSynchronize) {
    throw new Error('DB_SYNCHRONIZE must be false in production. Use migrations instead.');
  }

  return {
    nodeEnv,
    port: parseInt(process.env['PORT'] || '3000', 10),
    appName: process.env['APP_NAME'] || 'BookStore Backend',
    logLevel: process.env['LOG_LEVEL'] || 'debug',

    db: {
      url: databaseUrl,
      host: databaseUrl ? process.env['DB_HOST'] || '' : throwIfEmpty(process.env['DB_HOST'], 'DB_HOST'),
      port: parseInt(process.env['DB_PORT'] || '5432', 10),
      username: databaseUrl ? process.env['DB_USERNAME'] || '' : throwIfEmpty(process.env['DB_USERNAME'], 'DB_USERNAME'),
      password: databaseUrl ? process.env['DB_PASSWORD'] || '' : throwIfEmpty(process.env['DB_PASSWORD'], 'DB_PASSWORD'),
      database: databaseUrl ? process.env['DB_DATABASE'] || '' : throwIfEmpty(process.env['DB_DATABASE'], 'DB_DATABASE'),
      synchronize: dbSynchronize,
      logging: process.env['DB_LOGGING'] === 'true',
      ssl: dbSsl,
    },

    jwt: {
      accessSecret: throwIfEmpty(process.env['JWT_ACCESS_SECRET'], 'JWT_ACCESS_SECRET'),
      accessExpiresIn: process.env['JWT_ACCESS_EXPIRES'] || '15m',
      refreshSecret: throwIfEmpty(process.env['JWT_REFRESH_SECRET'], 'JWT_REFRESH_SECRET'),
      refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES'] || '7d',
    },

    bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] || '10', 10),

    corsOrigin: corsOrigin.length === 1 ? corsOrigin[0] : corsOrigin,

    rateLimit: {
      windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '15000', 10),
      maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
    },

    redis: {
      url: redisUrl,
      host: parsedRedisUrl?.hostname || process.env['REDIS_HOST'] || '127.0.0.1',
      port: parsedRedisUrl?.port ? parseInt(parsedRedisUrl.port, 10) : parseInt(process.env['REDIS_PORT'] || '6380', 10),
      password: parsedRedisUrl?.password ? decodeURIComponent(parsedRedisUrl.password) : process.env['REDIS_PASSWORD'],
      tls: redisTls,
    },

    smtp: {
      host: process.env['SMTP_HOST'] || 'smtp.gmail.com',
      port: parseInt(process.env['SMTP_PORT'] || '587', 10),
      family: process.env['SMTP_FAMILY'] === '6' ? 6 : 4,
      user: process.env['SMTP_USER'] || '',
      pass: process.env['SMTP_PASS'] || '',
      rejectUnauthorized: process.env['SMTP_TLS_REJECT_UNAUTHORIZED'] !== 'false',
    },

    email: {
      from: process.env['EMAIL_FROM'] || process.env['SMTP_USER'] || 'no-reply@example.com',
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
      generationModel: process.env['GEMINI_GENERATION_MODEL'] || 'gemini-2.5-flash',
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
