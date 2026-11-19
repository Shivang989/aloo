import { describe, it, expect } from "vitest";
import {
  cacheSetJson,
  cacheGetJson,
  cacheDeleteByPrefix,
  checkRateLimit,
  acquireWorkerLease,
  releaseWorkerLease,
  signalWorkerWake,
  consumeWorkerWake,
} from "../../src/database/cache";

describe("Shared Redis / Fallback Runtime Layer", () => {
  it("stores, reads, and prefix-invalidates cached entries", async () => {
    await cacheSetJson("fsub:verified:-1001:111", true, 60);
    await cacheSetJson("fsub:verified:-1001:222", true, 60);
    await cacheSetJson("fsub:verified:-1002:333", true, 60);

    expect(await cacheGetJson<boolean>("fsub:verified:-1001:111")).toBe(true);
    await cacheDeleteByPrefix("fsub:verified:-1001:");

    expect(await cacheGetJson<boolean>("fsub:verified:-1001:111")).toBeNull();
    expect(await cacheGetJson<boolean>("fsub:verified:-1001:222")).toBeNull();
    expect(await cacheGetJson<boolean>("fsub:verified:-1002:333")).toBe(true);
  });

  it("enforces sliding rate-limit thresholds", async () => {
    const key = `rl:test:${Date.now()}`;
    expect((await checkRateLimit(key, 2, 10)).allowed).toBe(true);
    expect((await checkRateLimit(key, 2, 10)).allowed).toBe(true);
    expect((await checkRateLimit(key, 2, 10)).allowed).toBe(false);
  });

  it("manages exclusive worker leases and wake signals", async () => {
    const lock = `lease:test:${Date.now()}`;
    expect(await acquireWorkerLease(lock, "worker_a", 30)).toBe(true);
    expect(await acquireWorkerLease(lock, "worker_b", 30)).toBe(false);
    await releaseWorkerLease(lock, "worker_a");
    expect(await acquireWorkerLease(lock, "worker_b", 30)).toBe(true);

    const sig = `wake:test:${Date.now()}`;
    await signalWorkerWake(sig);
    expect(await consumeWorkerWake(sig)).toBe(true);
    expect(await consumeWorkerWake(sig)).toBe(false);
  });
});
