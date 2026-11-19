import { BotContext, CommandHandler } from "../../types/bot";
import { clearBroadcastWizard, setBroadcastOptOut } from "../../database/broadcast-data";
import { sendMessage } from "../../telegram/messages";
import { renderDashboard } from "./dashboard";

export function isBroadcastOwner(userId: number, ownerId: number): boolean {
  return String(userId).trim() === String(ownerId).trim();
}

export const broadcastHandlers: Record<string, CommandHandler> = {
  "/broadcast": async (ctx: BotContext) => {
    if (!isBroadcastOwner(ctx.userId, ctx.env.OWNER_ID)) return;
    await clearBroadcastWizard(ctx.userId);
    await renderDashboard(ctx.env.BOT_TOKEN, ctx.chatId);
  },

  "/broadcaststop": async (ctx: BotContext) => {
    await setBroadcastOptOut(ctx.userId, true);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      "🔕 <b>Broadcasts Disabled:</b> You will no longer receive DM announcements.",
      undefined,
      ctx.message.message_id
    );
  },

  "/broadcaststart": async (ctx: BotContext) => {
    await setBroadcastOptOut(ctx.userId, false);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      "🔔 <b>Broadcasts Enabled:</b> You will now receive official announcements.",
      undefined,
      ctx.message.message_id
    );
  },
};
