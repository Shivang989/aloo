import { Pool, PoolClient } from "pg";
import { buildPostgresPoolConfig } from "../config";

let corePool: Pool | null = null;

export function initCoreDb(connectionString: string): Pool {
  if (!corePool) {
    corePool = new Pool(buildPostgresPoolConfig(connectionString, 10));
    corePool.on("error", (err) => {
      console.error("Unexpected aloo_core pool error:", err.message);
    });
  }
  return corePool;
}

export function getCoreDb(): Pool {
  if (!corePool) {
    throw new Error("aloo_core database has not been initialized.");
  }
  return corePool;
}

export async function withCoreTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getCoreDb().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closeCoreDb(): Promise<void> {
  if (corePool) {
    await corePool.end();
    corePool = null;
  }
}
