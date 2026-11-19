import { BotContext } from "../../types/bot";
import {
  isForceJoinModerator,
  getForceJoinRule,
  hasForceJoinRequest,
  deleteForceJoinRequest,
} from "../../database/force-join-data";
import { getChatMember } from "../../telegram/chats";
import { deleteMessage, sendMessage } from "../../telegram/messages";
import { escapeHtml } from "../../ui/fancy-text";

const VERIFIED_CACHE = new Map<string, number>();
const CACHE_TTL_MS = 60_000;

export function clearGroupVerifiedCache(groupId: number): void {
  const prefix = `${groupId}:`;
  for (const key of VERIFIED_CACHE.keys()) {
    if (key.startsWith(prefix)) {
      VERIFIED_CACHE.delete(key);
    }
  }
}

export async function handleForceSubCheck(ctx: BotContext): Promise<boolean> {
  if (ctx.chatId > 0) return false;

  const isOwner = String(ctx.userId).trim() === String(ctx.env.OWNER_ID).trim();
  if (isOwner || ctx.message.from?.is_bot || ctx.message.sender_chat) {
    return false;
  }

  const authorized = await isForceJoinModerator(ctx.chatId, ctx.userId);
  if (authorized) {
    return false;
  }

  try {
    const rule = await getForceJoinRule(ctx.chatId);
    if (!rule) return false;

    const cacheKey = `${ctx.chatId}:${ctx.userId}`;
    const cachedTime = VERIFIED_CACHE.get(cacheKey);
    const now = Date.now();
    if (cachedTime && now - cachedTime < CACHE_TTL_MS) {
      return false;
    }

    const cleanTarget = rule.target_chat.trim();
    const hasRequested = await hasForceJoinRequest(ctx.userId, cleanTarget);
    if (hasRequested) {
      VERIFIED_CACHE.set(cacheKey, now);
      return false;
    }

    const check = await getChatMember(ctx.env.BOT_TOKEN, cleanTarget, ctx.userId);

    if (check.ok) {
      if (check.isMember) {
        VERIFIED_CACHE.set(cacheKey, now);
        return false;
      }

      if (check.status === "left" || check.status === "kicked") {
        VERIFIED_CACHE.delete(cacheKey);
        await deleteForceJoinRequest(ctx.userId, cleanTarget);
      }
    } else {
      console.error(`ForceSub check API error on '${cleanTarget}':`, check.error);
      return false;
    }

    await deleteMessage(ctx.env.BOT_TOKEN, ctx.chatId, ctx.message.message_id);

    const name = escapeHtml(ctx.message.from?.first_name || "User");
    const text =
      `⚠️ <b>Hey <a href="tg://user?id=${ctx.userId}">${name}</a>!</b>\n\n` +
      `You must join our channel/group or send a join request before you can chat here.`;

    const kb = {
      inline_keyboard: [[{ text: rule.button_name, url: rule.link }]],
    };

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, text, kb);
    return true;
  } catch (err) {
    console.error("Non-fatal handleForceSubCheck error:", err);
    return false;
  }
}
