import Redis from "ioredis";

let redisClient: Redis | null = null;
let redisEnabled = false;

export async function initRedis(redisUrl?: string): Promise<Redis | null> {
  if (!redisUrl) {
    redisEnabled = false;
    return null;
  }

  redisEnabled = true;
  if (!redisClient) {
    const isTls = redisUrl.startsWith("rediss://");
    redisClient = new Redis(redisUrl, {
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

  try {
    if (redisClient.status === "wait") {
      await redisClient.connect();
    }
    await redisClient.ping();
    return redisClient;
  } catch (err: any) {
    console.error("Initial Redis ping failed (falling back safely):", err?.message || err);
    return redisClient;
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
