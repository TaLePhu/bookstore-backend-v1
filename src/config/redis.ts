import { Redis } from 'ioredis';
import { getEnv } from './env';

const env = getEnv();

const redisOptions = {
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
  maxRetriesPerRequest: null,
};

// Main redis client
export const redisConfig = new Redis(redisOptions);

export default redisConfig;
