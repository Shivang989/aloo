import { PoolConfig, types } from "pg";

// Parse PostgreSQL BIGINT (OID 20) as JavaScript numbers safely
types.setTypeParser(20, (val: string) => parseInt(val, 10));

export function buildPostgresPoolConfig(connectionString: string, maxConnections: number): PoolConfig {
  const isLocal =
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

  return {
    connectionString,
    max: maxConnections,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  };
}
