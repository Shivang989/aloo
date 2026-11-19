import { RuntimeEnv } from "../types/environment";
import { initCoreDb, getCoreDb, withCoreTransaction, closeCoreDb } from "./clients/core-postgres";
import { initOpsDb, getOpsDb, withOpsTransaction, closeOpsDb } from "./clients/ops-postgres";
import { initRedis, getRedisClient, getRedisStatus, closeRedis } from "./clients/redis";

export { getCoreDb, withCoreTransaction, getOpsDb, withOpsTransaction, getRedisClient };

export async function initDatabases(env: RuntimeEnv): Promise<void> {
  const core = initCoreDb(env.CORE_DATABASE_URL);
  const ops = initOpsDb(env.OPS_DATABASE_URL);

  await core.query("SELECT 1");
  await ops.query("SELECT 1");
  await initRedis(env.REDIS_URL);
}

export async function checkDatabaseHealth(): Promise<{
  core: boolean;
  ops: boolean;
  redis: "connected" | "disabled" | "disconnected";
}> {
  let coreOk = false;
  let opsOk = false;
  try {
    await getCoreDb().query("SELECT 1");
    coreOk = true;
  } catch {
    coreOk = false;
  }
  try {
    await getOpsDb().query("SELECT 1");
    opsOk = true;
  } catch {
    opsOk = false;
  }
  return {
    core: coreOk,
    ops: opsOk,
    redis: getRedisStatus(),
  };
}

export async function closeDatabases(): Promise<void> {
  await Promise.all([closeCoreDb(), closeOpsDb(), closeRedis()]);
}
