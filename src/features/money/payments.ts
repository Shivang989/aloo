import { BotContext, CommandHandler } from "../../types/bot";
import { transferMoneyTx } from "../../database/users";
import { escapeHtml } from "../../ui/fancy-text";
import { sendMessage } from "../../telegram/messages";

const handlePayment: CommandHandler = async (ctx: BotContext) => {
  try {
    const reply = ctx.reply;

    if (!reply || ctx.args.length === 0) {
      const guideText =
        `💸 <b>Send Money</b>\n\n` +
        `Reply to a player's message with:\n` +
        `<code>/pay &lt;amount&gt;</code> or <code>/give &lt;amount&gt;</code>`;

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
        "❌ You cannot send money to yourself.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const rawAmount = ctx.args[0].trim();
    const amount = parseInt(rawAmount, 10);
    if (ctx.args.length > 1 || !/^\d+$/.test(rawAmount) || isNaN(amount) || amount <= 0) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        '❌ Invalid amount. Reply with <code>/pay &lt;amount&gt;</code> or <code>/give &lt;amount&gt;</code>.',
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const res = await transferMoneyTx(ctx.userId, targetId, amount);

    if (res.status === "sender_dead") {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "💀 You are eliminated. Revive first using <code>/revive</code>.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    if (res.status === "insufficient_balance") {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `❌ <b>Insufficient Balance</b>\n\nRequired: ₹${amount}\nYour balance: ₹${res.balance}`,
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const senderName = escapeHtml(ctx.message.from?.first_name || "Player");
    const targetName = escapeHtml(reply.from.first_name || "Player");

    const sentText =
      `💸 <b>Money Sent</b>  ₹${amount}\n\n` +
      `👤 ${senderName} → ${targetName}\n` +
      ` •  💼 ₹${res.senderNewBalance}`;

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, sentText, undefined, ctx.message?.message_id);
  } catch (err: any) {
    console.error("Transfer command error:", err);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      `⚠️ <code>${err?.message || "Execution error"}</code>`,
      undefined,
      ctx.message?.message_id
    );
  }
};

export const paymentHandlers: Record<string, CommandHandler> = {
  "/pay": handlePayment,
  "/give": handlePayment,
};
