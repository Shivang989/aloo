import { BotContext, CommandHandler } from "../../types/bot";
import { robPlayerTx } from "../../database/users";
import { escapeHtml } from "../../ui/fancy-text";
import { sendMessage } from "../../telegram/messages";

export const robberyHandlers: Record<string, CommandHandler> = {
  "/rob": async (ctx: BotContext) => {
    try {
      const reply = ctx.reply;

      if (!reply) {
        const guideText =
          `💰 <b>Robbery Usage</b>\n\n` +
          `Reply to another player's message with:\n\n` +
          `<code>/rob</code> — Rob ₹1,000\n` +
          `<code>/rob 250</code> — Rob ₹250`;

        await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, guideText, undefined, ctx.message?.message_id);
        return;
      }

      if (!reply.from || reply.from.is_bot) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "❌ Unable to identify this player.",
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      const targetId = reply.from.id;

      if (targetId === ctx.userId) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "❌ You cannot rob yourself.",
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      let amount = 1000;
      if (ctx.args.length > 0) {
        const rawAmount = ctx.args[0].trim();
        const parsed = parseInt(rawAmount, 10);
        if (isNaN(parsed) || parsed <= 0 || !/^\d+$/.test(rawAmount)) {
          await sendMessage(
            ctx.env.BOT_TOKEN,
            ctx.chatId,
            '❌ Invalid amount. Use "/rob" or "/rob <amount>".',
            undefined,
            ctx.message?.message_id
          );
          return;
        }
        amount = parsed;
      }

      const targetName = escapeHtml(reply.from.first_name || "Player");
      const res = await robPlayerTx(ctx.userId, targetId, amount);

      if (res.status === "attacker_dead") {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "💀 You must be alive to rob another player. Revive first using <code>/revive</code>.",
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      if (res.status === "target_not_found") {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "❌ Player profile not found.",
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      if (res.status === "target_protected") {
        const blockedText =
          `🛡️ <b>Robbery Blocked</b>\n\n` +
          `You received ₹10 compensation.\n` +
          `The target is protected.`;

        await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, blockedText, undefined, ctx.message?.message_id);
        return;
      }

      if (res.status === "target_insufficient") {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "❌ Target does not have enough money.",
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      const successText =
        `💰 <b>Robbery Successful</b>\n\n` +
        `Target: ${targetName}\n` +
        `Robbed: ₹${amount}`;

      await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, successText, undefined, ctx.message?.message_id);
    } catch (err: any) {
      console.error("Rob command error:", err);
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `⚠️ <code>${err?.message || "Execution error"}</code>`,
        undefined,
        ctx.message?.message_id
      );
    }
  },
};
