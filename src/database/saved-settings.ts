import { getCoreDb } from "./index";
import { cacheGetJson, cacheSetJson, cacheDelete } from "./cache";

const SETTINGS_CACHE_TTL_SEC = 300;

function settingCacheKey(key: string): string {
  return `settings:${key}`;
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const cached = await cacheGetJson<T>(settingCacheKey(key));
  if (cached !== null) {
    return cached;
  }

  const res = await getCoreDb().query("SELECT value FROM saved_settings WHERE key = $1", [key]);
  if (res.rows.length === 0) return null;

  const val = res.rows[0].value;
  let parsed: T;
  if (typeof val === "string") {
    try {
      parsed = JSON.parse(val) as T;
    } catch {
      parsed = val as unknown as T;
    }
  } else {
    parsed = val as T;
  }

  await cacheSetJson(settingCacheKey(key), parsed, SETTINGS_CACHE_TTL_SEC);
  return parsed;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await getCoreDb().query(
    `INSERT INTO saved_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [key, JSON.stringify(value), now]
  );
  await cacheSetJson(settingCacheKey(key), value, SETTINGS_CACHE_TTL_SEC);
}

export async function deleteSetting(key: string): Promise<void> {
  await getCoreDb().query("DELETE FROM saved_settings WHERE key = $1", [key]);
  await cacheDelete(settingCacheKey(key));
}
