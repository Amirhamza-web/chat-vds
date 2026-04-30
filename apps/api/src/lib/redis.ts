import { Redis } from 'ioredis';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

export const redisPub = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: false,
});
export const redisSub = redisPub.duplicate();
export const redis = redisPub;
