import { RuntimeEnv } from "../types/environment";
import { initCoreDb, getCoreDb, withCoreTransaction, closeCoreDb } from "./clients/core-postgres";
import { initOpsDb, getOpsDb, withOpsTransaction, closeOpsDb } from "./clients/ops-postgres";

export { getCoreDb, withCoreTransaction, getOpsDb, withOpsTransaction };

export async function initDatabases(env: RuntimeEnv): Promise<void> {
  const core = initCoreDb(env.CORE_DATABASE_URL);
  const ops = initOpsDb(env.OPS_DATABASE_URL);

  await core.query("SELECT 1");
  await ops.query("SELECT 1");
}

export async function checkDatabaseHealth(): Promise<{ core: boolean; ops: boolean }> {
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
  return { core: coreOk, ops: opsOk };
}

export async function closeDatabases(): Promise<void> {
  await Promise.all([closeCoreDb(), closeOpsDb()]);
}
