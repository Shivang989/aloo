import Redis from "ioredis";

let redisClient: Redis | null = null;
let redisEnabled = false;

function normalizeRedisUrl(rawUrl: string): string {
  let cleaned = rawUrl.trim();
  const urlMatch = cleaned.match(/(rediss?:\/\/[^\s'"]+)/i);
  if (urlMatch) {
    cleaned = urlMatch[1];
  }
  if (cleaned.includes("upstash.io") && cleaned.startsWith("redis://")) {
    cleaned = cleaned.replace(/^redis:\/\//i, "rediss://");
  }
  return cleaned;
}

export async function initRedis(redisUrl?: string): Promise<Redis | null> {
  if (!redisUrl) {
    redisEnabled = false;
    return null;
  }

  const normalizedUrl = normalizeRedisUrl(redisUrl);
  redisEnabled = true;

  try {
    if (!redisClient) {
      const isTls = normalizedUrl.startsWith("rediss://");
      redisClient = new Redis(normalizedUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 5_000,
        lazyConnect: true,
        enableReadyCheck: true,
        tls: isTls ? { rejectUnauthorized: false } : undefined,
        retryStrategy(times) {
          return Math.min(times * 250, 5_000);
        },
      });

      redisClient.on("error", (err) => {
        console.error("Redis runtime error:", err.message);
      });
    }

    if (redisClient.status === "wait") {
      await redisClient.connect();
    }
    await redisClient.ping();
    return redisClient;
  } catch (err: any) {
    console.error("Redis initialization failed (falling back safely):", err?.message || err);
    return null;
  }
}

export function getRedisClient(): Redis | null {
  if (!redisEnabled || !redisClient) return null;
  if (redisClient.status !== "ready") return null;
  return redisClient;
}

export function getRedisStatus(): "connected" | "disabled" | "disconnected" {
  if (!redisEnabled) return "disabled";
  if (redisClient && redisClient.status === "ready") return "connected";
  return "disconnected";
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
    redisClient = null;
  }
  redisEnabled = false;
}
