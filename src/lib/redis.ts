import { Redis } from "ioredis";

const url = process.env.REDIS_URL || "redis://localhost:6379";
const g = globalThis as unknown as { __redis?: Redis };

export const redis: Redis = g.__redis ?? (g.__redis = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false }));

/** Fixed-window rate limit. Returns true when the call is allowed. */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const k = `rl:${key}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowSec);
  return n <= limit;
}
