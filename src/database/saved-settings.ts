import { getCoreDb } from "./index";

export async function getSetting<T>(key: string): Promise<T | null> {
  const res = await getCoreDb().query("SELECT value FROM saved_settings WHERE key = $1", [key]);
  if (res.rows.length === 0) return null;
  const val = res.rows[0].value;
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  }
  return val as T;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await getCoreDb().query(
    `INSERT INTO saved_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [key, JSON.stringify(value), now]
  );
}

export async function deleteSetting(key: string): Promise<void> {
  await getCoreDb().query("DELETE FROM saved_settings WHERE key = $1", [key]);
}
