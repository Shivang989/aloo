export interface RuntimeEnv {
  BOT_TOKEN: string;
  OWNER_ID: number;
  CORE_DATABASE_URL: string;
  OPS_DATABASE_URL: string;
  HEALTH_PORT: number;
}

export function loadRuntimeEnv(): RuntimeEnv {
  const botToken = (process.env.BOT_TOKEN || "").trim();
  const coreDbUrl = (process.env.CORE_DATABASE_URL || "").trim();
  const opsDbUrl = (process.env.OPS_DATABASE_URL || "").trim();
  const ownerIdRaw = (process.env.OWNER_ID || "8210345021").trim();
  const healthPortRaw = (process.env.HEALTH_PORT || "3000").trim();

  const missing: string[] = [];
  if (!botToken) missing.push("BOT_TOKEN");
  if (!coreDbUrl) missing.push("CORE_DATABASE_URL");
  if (!opsDbUrl) missing.push("OPS_DATABASE_URL");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    BOT_TOKEN: botToken,
    OWNER_ID: Number(ownerIdRaw) || 8210345021,
    CORE_DATABASE_URL: coreDbUrl,
    OPS_DATABASE_URL: opsDbUrl,
    HEALTH_PORT: Number(healthPortRaw) || 3000,
  };
}
