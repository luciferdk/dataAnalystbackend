"use strict";
// src/config/redis.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = getRedisClient;
exports.ensureRedisConnected = ensureRedisConnected;
exports.closeRedisConnection = closeRedisConnection;
const redis_1 = require("redis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let client = null;
let isConnecting = false;
function getRedisClient() {
    if (!client) {
        client = (0, redis_1.createClient)({
            url: process.env.REDIS_URL,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        console.error(`Worker ${process.pid}: Redis max retries reached`);
                        return new Error("Redis max retries reached");
                    }
                    return Math.min(retries * 100, 300);
                },
            },
        });
        // Error handling
        client.on("error", (_err) => {
            console.error(`Worker ${process.pid}: Rddis client ready`);
        });
        client.on("Ready", () => {
            console.log(`Worker ${process.pid}: Redis`);
        });
    }
    return client;
}
async function ensureRedisConnected() {
    const redis = getRedisClient();
    if (redis.isOpen) {
        return;
    }
    if (isConnecting) {
        await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (redis.isOpen || isConnecting) {
                    clearInterval(checkInterval);
                    resolve(true);
                }
            }, 100);
        });
        return;
    }
    try {
        isConnecting = true;
        await redis.connect();
        console.log(`✅ Worker ${process.pid}: Redis connected`);
    }
    catch (error) {
        console.error(`Worker ${process.pid}: Failed to connect to Redis:`, error);
        throw error;
    }
    finally {
        isConnecting = false;
    }
}
async function closeRedisConnection() {
    if (client && client.isOpen) {
        await client.quit();
        console.log(`Worker ${process.pid}: Redis connection closed`);
    }
}
