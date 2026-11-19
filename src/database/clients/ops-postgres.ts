import { Pool, PoolClient } from "pg";
import { buildPostgresPoolConfig } from "../config";

let opsPool: Pool | null = null;

export function initOpsDb(connectionString: string): Pool {
  if (!opsPool) {
    opsPool = new Pool(buildPostgresPoolConfig(connectionString, 8));
    opsPool.on("error", (err) => {
      console.error("Unexpected aloo_ops pool error:", err.message);
    });
  }
  return opsPool;
}

export function getOpsDb(): Pool {
  if (!opsPool) {
    throw new Error("aloo_ops database has not been initialized.");
  }
  return opsPool;
}

export async function withOpsTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getOpsDb().connect();
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

export async function closeOpsDb(): Promise<void> {
  if (opsPool) {
    await opsPool.end();
    opsPool = null;
  }
}
