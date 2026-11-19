import { BotContext, CommandHandler } from "../../types/bot";
import { sendMessage } from "../../telegram/messages";

export const pingHandlers: Record<string, CommandHandler> = {
  "/ping": async (ctx: BotContext) => {
    const start = Date.now();
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      `🏓 <b>Pong!</b> <code>${Date.now() - start}ms</code>`
    );
  },
};
