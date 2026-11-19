import { getRedisClient } from "./clients/redis";

// Local fallback stores used automatically when REDIS_URL is not configured
const fallbackCache = new Map<string, { value: string; expiresAt: number }>();
const fallbackRateLimits = new Map<string, { count: number; expiresAt: number }>();
const fallbackLocks = new Map<string, { owner: string; expiresAt: number }>();
const fallbackSignals = new Set<string>();

function cleanupExpiredFallback(now: number): void {
  if (fallbackCache.size > 5000) {
    for (const [k, v] of fallbackCache.entries()) {
      if (v.expiresAt <= now) fallbackCache.delete(k);
    }
  }
  if (fallbackRateLimits.size > 5000) {
    for (const [k, v] of fallbackRateLimits.entries()) {
      if (v.expiresAt <= now) fallbackRateLimits.delete(k);
    }
  }
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      // Fall through to local fallback
    }
  }

  const now = Date.now();
  const entry = fallbackCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    fallbackCache.delete(key);
    return null;
  }
  try {
    return JSON.parse(entry.value) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const serialized = JSON.stringify(value);
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(key, serialized, "EX", ttlSeconds);
      return;
    } catch {
      // Fall through to local fallback
    }
  }

  const now = Date.now();
  cleanupExpiredFallback(now);
  fallbackCache.set(key, {
    value: serialized,
    expiresAt: now + ttlSeconds * 1000,
  });
}

export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // Ignore Redis error
    }
  }
  fallbackCache.delete(key);
}

export async function cacheDeleteByPrefix(prefix: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch {
      // Ignore Redis scan error
    }
  }

  for (const key of fallbackCache.keys()) {
    if (key.startsWith(prefix)) {
      fallbackCache.delete(key);
    }
  }
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
      return {
        allowed: count <= maxRequests,
        remaining: Math.max(0, maxRequests - count),
      };
    } catch {
      // Fall through to local fallback
    }
  }

  const now = Date.now();
  cleanupExpiredFallback(now);
  const existing = fallbackRateLimits.get(key);
  if (!existing || existing.expiresAt <= now) {
    fallbackRateLimits.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: Math.max(0, maxRequests - 1) };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= maxRequests,
    remaining: Math.max(0, maxRequests - existing.count),
  };
}

export async function acquireWorkerLease(
  lockKey: string,
  ownerToken: string,
  ttlSeconds: number
): Promise<boolean> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const res = await redis.set(lockKey, ownerToken, "EX", ttlSeconds, "NX");
      return res === "OK";
    } catch {
      // Fall through to local fallback
    }
  }

  const now = Date.now();
  const existing = fallbackLocks.get(lockKey);
  if (!existing || existing.expiresAt <= now || existing.owner === ownerToken) {
    fallbackLocks.set(lockKey, { owner: ownerToken, expiresAt: now + ttlSeconds * 1000 });
    return true;
  }
  return false;
}

export async function releaseWorkerLease(lockKey: string, ownerToken: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await redis.eval(script, 1, lockKey, ownerToken);
    } catch {
      // Ignore release error; TTL expires automatically
    }
  }

  const existing = fallbackLocks.get(lockKey);
  if (existing && existing.owner === ownerToken) {
    fallbackLocks.delete(lockKey);
  }
}

export async function signalWorkerWake(signalKey: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(signalKey, "1", "EX", 30);
    } catch {
      // Ignore Redis signal error
    }
  }
  fallbackSignals.add(signalKey);
}

export async function consumeWorkerWake(signalKey: string): Promise<boolean> {
  let woken = fallbackSignals.delete(signalKey);
  const redis = getRedisClient();
  if (redis) {
    try {
      const deleted = await redis.del(signalKey);
      if (deleted > 0) woken = true;
    } catch {
      // Ignore Redis error
    }
  }
  return woken;
}
