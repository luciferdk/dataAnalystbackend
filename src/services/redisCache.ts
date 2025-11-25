// src/services/redisCache.ts

import { getRedisClient, ensureRedisConnected } from "../config/redis";

const DEFAULT_TTL_SECONDS = 300; //5 Min

export async function getCache<T>(key: string): Promise<T | null> {
  await ensureRedisConnected();
  const redis = getRedisClient();
  const data = await redis.get(key);

  if (!data) return null;

  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  await ensureRedisConnected();
  const redis = getRedisClient();
  const serialized = JSON.stringify(value);
  await redis.set(key, serialized, { EX: ttlSeconds });
}
