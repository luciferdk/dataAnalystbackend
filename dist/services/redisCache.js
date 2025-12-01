"use strict";
// src/services/redisCache.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCache = getCache;
exports.setCache = setCache;
const redis_1 = require("../config/redis");
const DEFAULT_TTL_SECONDS = 300; //5 Min
async function getCache(key) {
    await (0, redis_1.ensureRedisConnected)();
    const redis = (0, redis_1.getRedisClient)();
    const data = await redis.get(key);
    if (!data)
        return null;
    try {
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
async function setCache(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
    await (0, redis_1.ensureRedisConnected)();
    const redis = (0, redis_1.getRedisClient)();
    const serialized = JSON.stringify(value);
    await redis.set(key, serialized, { EX: ttlSeconds });
}
