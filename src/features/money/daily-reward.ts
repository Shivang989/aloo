import { BotContext, CommandHandler } from "../../types/bot";
import { claimDailyRewardTx } from "../../database/users";
import { sendMessage } from "../../telegram/messages";
import { formatRemainingTime } from "./protection";

export const dailyRewardHandlers: Record<string, CommandHandler> = {
  "/daily": async (ctx: BotContext) => {
    try {
      const REWARD = 1000;
      const COOLDOWN_SECONDS = 86400;

      const res = await claimDailyRewardTx(ctx.userId, REWARD, COOLDOWN_SECONDS);

      if (res.status === "ok") {
        const successText =
          `🎁 <b>Daily Reward Claimed!</b>\n\n` +
          `💰 You received ₹1,000.\n\n` +
          `Come back after 24 hours for your next reward!`;

        await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, successText, undefined, ctx.message?.message_id);
        return;
      }

      const cooldownText =
        `⏳ <b>You've already claimed your daily reward.</b>\n\n` +
        `Next reward available in: "${formatRemainingTime(res.remainingSeconds)}"`;

      await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, cooldownText, undefined, ctx.message?.message_id);
    } catch (err: any) {
      console.error("Daily handler failure:", err);
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `⚠️ <b>Error processing daily:</b> <code>${err?.message || "Internal error"}</code>`
      );
    }
  },
};
