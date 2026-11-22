import { BotContext, CommandHandler } from "../../types/bot";
import { setSetting } from "../../database/saved-settings";
import { sendMessage } from "../../telegram/messages";
import { DMUI_STATE_KEY } from "./types";

export function isBotOwner(userId: number | string, ownerId: number): boolean {
  return String(userId).trim() === String(ownerId).trim();
}

export const dmMenuHandlers: Record<string, CommandHandler> = {
  "/dmui": async (ctx: BotContext) => {
    if (!isBotOwner(ctx.userId, ctx.env.OWNER_ID)) {
      await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, "⛔ <b>Access Denied:</b> Owner only.");
      return;
    }

    await setSetting(DMUI_STATE_KEY, "IDLE");

    const text =
      `⚙️ <b>ALOO DM "/start" CONFIGURATION</b>\n\n` +
      `Choose a component to configure:`;

    const kb = {
      inline_keyboard: [
        [
          { text: "📝 Text", callback_data: "dmui:ask_text" },
          { text: "🖼 Media", callback_data: "dmui:ask_media" },
        ],
        [{ text: "👁 Live Preview", callback_data: "dmui:preview" }],
      ],
    };

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, text, kb);
  },
};
