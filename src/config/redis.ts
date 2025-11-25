// src/config/redis.ts

import { createClient, RedisClientType } from "redis";
import dotenv from "dotenv";

dotenv.config();

let client: RedisClientType | null = null;
let isConnecting = false;

export function getRedisClient(): RedisClientType {
  if (!client) {
    client = createClient({
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

export async function ensureRedisConnected(): Promise<void> {
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
  } catch (error) {
    console.error(`Worker ${process.pid}: Failed to connect to Redis:`, error);
    throw error;
  } finally {
    isConnecting = false;
  }
}

export async function closeRedisConnection(): Promise<void> {
  if (client && client.isOpen) {
    await client.quit();
    console.log(`Worker ${process.pid}: Redis connection closed`);
  }
}
