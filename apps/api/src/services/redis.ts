import Redis from 'ioredis';
import { config } from '../config';

let redis: Redis | null = null;

export function isRedisEnabled(): boolean {
  return config.redisEnabled;
}

export function getRedis(): Redis {
  if (!config.redisEnabled) {
    throw new Error('Redis is disabled (REDIS_ENABLED=false). Enable it to use cache/session features.');
  }
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}

export async function healthCheckRedis(): Promise<boolean | 'disabled'> {
  if (!config.redisEnabled) {
    return 'disabled';
  }
  try {
    const client = getRedis();
    if (client.status !== 'ready') {
      await client.connect();
    }
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
