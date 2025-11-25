// src/rateLimiter.ts

import rateLimit from "express-rate-limit";
import { getRedisClient, ensureRedisConnected } from "../config/redis";
import { RateLimitRequestHandler } from "express-rate-limit";
import RedisStore from "rate-limit-redis"; // install: npm i rate-limit-redis

export default async function createAPIRateLimiter(): Promise<RateLimitRequestHandler> {
  await ensureRedisConnected();
  const redis = getRedisClient();

  return rateLimit({
    windowMs: 1000, //1 second
    max: 50, // 50 req/sec/IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests from this IP.",
      retryAfter: "2 seconds",
    },
    store: new RedisStore({
      // @ts-expext-error - library typings can be a bit loose
      sendCommand: (cmd: string, ...args: string[]) =>
        redis.sendCommand([cmd, ...args]),
      prefix: "rl:api:",
    }),
  });
}
