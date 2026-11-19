import { getCoreDb } from "./index";
import { AdminRecord } from "../types/player";

export async function getAdmin(chatId: number, userId: number): Promise<AdminRecord | null> {
  const res = await getCoreDb().query(
    "SELECT chat_id, user_id, level, title FROM admins WHERE chat_id = $1 AND user_id = $2",
    [chatId, userId]
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    chat_id: Number(r.chat_id),
    user_id: Number(r.user_id),
    level: Number(r.level),
    title: String(r.title || "Admin"),
  };
}

export async function setAdmin(
  chatId: number,
  userId: number,
  level: number,
  title: string = "Admin"
): Promise<void> {
  await getCoreDb().query(
    `INSERT INTO admins (chat_id, user_id, level, title)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (chat_id, user_id)
     DO UPDATE SET level = EXCLUDED.level, title = EXCLUDED.title`,
    [chatId, userId, level, title]
  );
}

export async function removeAdmin(chatId: number, userId: number): Promise<void> {
  await getCoreDb().query("DELETE FROM admins WHERE chat_id = $1 AND user_id = $2", [
    chatId,
    userId,
  ]);
}

export async function getAllAdmins(chatId: number): Promise<AdminRecord[]> {
  const res = await getCoreDb().query(
    "SELECT chat_id, user_id, level, title FROM admins WHERE chat_id = $1",
    [chatId]
  );
  return res.rows.map((r) => ({
    chat_id: Number(r.chat_id),
    user_id: Number(r.user_id),
    level: Number(r.level),
    title: String(r.title || "Admin"),
  }));
}
