"use strict";
// src/rateLimiter.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createAPIRateLimiter;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const redis_1 = require("../config/redis");
const rate_limit_redis_1 = __importDefault(require("rate-limit-redis")); // install: npm i rate-limit-redis
async function createAPIRateLimiter() {
    await (0, redis_1.ensureRedisConnected)();
    const redis = (0, redis_1.getRedisClient)();
    return (0, express_rate_limit_1.default)({
        windowMs: 1000, //1 second
        max: 50, // 50 req/sec/IP
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            error: "Too many requests from this IP.",
            retryAfter: "2 seconds",
        },
        store: new rate_limit_redis_1.default({
            // @ts-expext-error - library typings can be a bit loose
            sendCommand: (cmd, ...args) => redis.sendCommand([cmd, ...args]),
            prefix: "rl:api:",
        }),
    });
}
