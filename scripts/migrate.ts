import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Pool } from "pg";
import { buildPostgresPoolConfig } from "../src/database/config";

dotenv.config();

async function runDirectoryMigrations(
  name: string,
  connectionString: string | undefined,
  folderPath: string
): Promise<void> {
  if (!connectionString) {
    throw new Error(`Missing connection string for ${name}`);
  }

  const pool = new Pool(buildPostgresPoolConfig(connectionString, 2));
  try {
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(folderPath, file), "utf8");
      await pool.query(sql);
      console.log(`[${name}] Applied ${file}`);
    }
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const rootDir = path.resolve(__dirname, "../../migrations");
  await runDirectoryMigrations(
    "aloo_core",
    process.env.CORE_DATABASE_URL,
    path.join(rootDir, "core")
  );
  await runDirectoryMigrations(
    "aloo_ops",
    process.env.OPS_DATABASE_URL,
    path.join(rootDir, "operations")
  );
  console.log("All PostgreSQL migrations completed successfully.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
