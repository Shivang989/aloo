import { getOpsDb } from "./index";

export interface ForceJoinRule {
  group_id: number;
  button_name: string;
  link: string;
  target_chat: string;
  created_at: number;
}

export async function isForceJoinModerator(groupId: number, userId: number): Promise<boolean> {
  const res = await getOpsDb().query(
    "SELECT 1 FROM force_sub_authorized WHERE group_id = $1 AND user_id = $2 LIMIT 1",
    [groupId, userId]
  );
  return res.rows.length > 0;
}

export async function authorizeForceJoinModerator(groupId: number, userId: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await getOpsDb().query(
    `INSERT INTO force_sub_authorized (group_id, user_id, created_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (group_id, user_id) DO UPDATE SET created_at = EXCLUDED.created_at`,
    [groupId, userId, now]
  );
}

export async function getForceJoinRule(groupId: number): Promise<ForceJoinRule | null> {
  const res = await getOpsDb().query(
    "SELECT group_id, button_name, link, target_chat, created_at FROM force_sub WHERE group_id = $1",
    [groupId]
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    group_id: Number(r.group_id),
    button_name: String(r.button_name),
    link: String(r.link),
    target_chat: String(r.target_chat),
    created_at: Number(r.created_at),
  };
}

export async function upsertForceJoinRule(
  groupId: number,
  buttonName: string,
  link: string,
  targetChat: string
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await getOpsDb().query(
    `INSERT INTO force_sub (group_id, button_name, link, target_chat, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (group_id) DO UPDATE SET
       button_name = EXCLUDED.button_name,
       link = EXCLUDED.link,
       target_chat = EXCLUDED.target_chat,
       created_at = EXCLUDED.created_at`,
    [groupId, buttonName, link, targetChat, now]
  );
}

export async function deleteForceJoinRule(groupId: number): Promise<void> {
  await getOpsDb().query("DELETE FROM force_sub WHERE group_id = $1", [groupId]);
}

export async function hasForceJoinRequest(userId: number, cleanTarget: string): Promise<boolean> {
  const res = await getOpsDb().query(
    `SELECT 1 FROM force_sub_requests
     WHERE user_id = $1 AND (target_chat = $2 OR target_chat = $3 OR target_chat = $4)
     LIMIT 1`,
    [userId, cleanTarget, cleanTarget.toLowerCase(), cleanTarget.replace("@", "")]
  );
  return res.rows.length > 0;
}

export async function deleteForceJoinRequest(userId: number, cleanTarget: string): Promise<void> {
  await getOpsDb().query(
    "DELETE FROM force_sub_requests WHERE user_id = $1 AND (target_chat = $2 OR target_chat = $3)",
    [userId, cleanTarget, cleanTarget.toLowerCase()]
  );
}

export async function recordForceJoinRequest(
  userId: number,
  chatIdStr: string,
  usernameStr: string | null
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const db = getOpsDb();
  await db.query(
    `INSERT INTO force_sub_requests (user_id, target_chat, created_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, target_chat) DO NOTHING`,
    [userId, chatIdStr, now]
  );

  if (usernameStr) {
    await db.query(
      `INSERT INTO force_sub_requests (user_id, target_chat, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, target_chat) DO NOTHING`,
      [userId, usernameStr, now]
    );
  }
}
