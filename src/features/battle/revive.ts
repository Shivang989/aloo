import { BotContext, CommandHandler } from "../../types/bot";
import { ensureUserExists, revivePlayerTx } from "../../database/users";
import { escapeHtml } from "../../ui/fancy-text";
import { sendMessage } from "../../telegram/messages";

export const REVIVE_COST = 200;

export const reviveHandlers: Record<string, CommandHandler> = {
  "/revive": async (ctx: BotContext) => {
    try {
      const reply = ctx.reply;
      const senderName = escapeHtml(ctx.message.from?.first_name || "Player");
      const senderMention = `<a href="tg://user?id=${ctx.userId}">${senderName}</a>`;

      // Mode B: Reply-based revive for another player
      if (reply) {
        const target = reply.from;
        if (!target || !target.id) {
          await sendMessage(
            ctx.env.BOT_TOKEN,
            ctx.chatId,
            "❌ Unable to identify the player to revive.",
            undefined,
            ctx.message?.message_id
          );
          return;
        }

        if (target.is_bot) {
          await sendMessage(
            ctx.env.BOT_TOKEN,
            ctx.chatId,
            "❌ Bots cannot be revived.",
            undefined,
            ctx.message?.message_id
          );
          return;
        }

        if (target.id === ctx.userId) {
          await sendMessage(
            ctx.env.BOT_TOKEN,
            ctx.chatId,
            "⚠️ To revive yourself, send <code>/revive</code> without replying to your own message.",
            undefined,
            ctx.message?.message_id
          );
          return;
        }

        await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
        const targetName = escapeHtml(target.first_name || "Player");
        const targetMention = `<a href="tg://user?id=${target.id}">${targetName}</a>`;

        const res = await revivePlayerTx(
          ctx.userId,
          REVIVE_COST,
          target.id,
          `revive_upd_${ctx.update.update_id}`
        );

        if (res.status === "duplicate") return;

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

        if (res.status === "already_alive") {
          await sendMessage(
            ctx.env.BOT_TOKEN,
            ctx.chatId,
            `🟢 ${targetMention} is already alive.`,
            undefined,
            ctx.message?.message_id
          );
          return;
        }

        if (res.status === "insufficient_balance") {
          await sendMessage(
            ctx.env.BOT_TOKEN,
            ctx.chatId,
            `❌ <b>Insufficient Balance</b>\n\n` +
              `Revive cost: <b>₹${REVIVE_COST}</b>\n` +
              `Your balance: <b>₹${res.payerBalance}</b>`,
            undefined,
            ctx.message?.message_id
          );
          return;
        }

        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          `❤️ <b>PLAYER REVIVED</b>\n\n` +
            `${senderMention} paid <b>₹${REVIVE_COST}</b> and revived ${targetMention}!\n` +
            `Your remaining balance: <b>₹${res.payerNewBalance}</b>`,
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      // Mode A: Independent self-revive
      await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
      const res = await revivePlayerTx(
        ctx.userId,
        REVIVE_COST,
        ctx.userId,
        `revive_upd_${ctx.update.update_id}`
      );

      if (res.status === "duplicate") return;

      if (res.status === "target_not_found") return;

      if (res.status === "already_alive") {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "🟢 You are already alive.",
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      if (res.status === "insufficient_balance") {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          `❌ <b>Insufficient Balance</b>\n\n` +
            `Revive cost: <b>₹${REVIVE_COST}</b>\n` +
            `Your balance: <b>₹${res.payerBalance}</b>`,
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `❤️ <b>REVIVAL SUCCESSFUL</b>\n\n` +
          `${senderMention} has been revived!\n` +
          `Cost paid: <b>₹${REVIVE_COST}</b>\n` +
          `Remaining balance: <b>₹${res.payerNewBalance}</b>`,
        undefined,
        ctx.message?.message_id
      );
    } catch (err: any) {
      console.error("Revive command error:", err);
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
