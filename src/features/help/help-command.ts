import { BotContext, CommandHandler } from "../../types/bot";
import { sendMessage } from "../../telegram/messages";
import { buildHelpMessage } from "./help-text";

export const helpHandlers: Record<string, CommandHandler> = {
  "/help": async (ctx: BotContext) => {
    const { body, inlineKeyboard } = buildHelpMessage();
    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, body, inlineKeyboard);
  },
};
