import { BotContext, CommandHandler } from "../../types/bot";
import { escapeHtml } from "../../ui/fancy-text";
import { sendMessage } from "../../telegram/messages";

export const idHandlers: Record<string, CommandHandler> = {
  "/id": async (ctx: BotContext) => {
    const targetUser = ctx.reply ? ctx.reply.from : ctx.message.from;

    if (!targetUser || !targetUser.id) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ Unable to identify this user.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const safeName = escapeHtml((targetUser.first_name || "User").trim());
    const text = `👤 Name: ${safeName}\n🆔 ID: <code>${targetUser.id}</code>`;

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, text, undefined, ctx.message?.message_id);
  },
};
