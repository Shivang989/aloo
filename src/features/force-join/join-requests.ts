import { TelegramUpdate } from "../../telegram/types";
import { recordForceJoinRequest } from "../../database/force-join-data";

export async function handleJoinRequest(update: TelegramUpdate): Promise<void> {
  const req = update.chat_join_request;
  if (!req || !req.from || !req.chat) return;

  const userId = Number(req.from.id);
  const chatIdStr = String(req.chat.id);
  const usernameStr = req.chat.username ? `@${String(req.chat.username).toLowerCase()}` : null;

  try {
    await recordForceJoinRequest(userId, chatIdStr, usernameStr);
  } catch (err) {
    console.error("Non-fatal join request tracking error:", err);
  }
}
