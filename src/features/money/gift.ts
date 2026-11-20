import { BotContext, CommandHandler } from "../../types/bot";
import { TelegramUser } from "../../telegram/types";
import {
  resolveMarketItem,
  formatRupees,
  formatCompactIndianPrice,
} from "./market-pricing";
import { giftMarketItemTx } from "../../database/inventory";
import { escapeHtml } from "../../ui/fancy-text";
import { sendMessage } from "../../telegram/messages";

function formatUserReference(user: TelegramUser): string {
  if (user.username && user.username.trim().length > 0) {
    return `@${escapeHtml(user.username.trim().replace(/^@+/, ""))}`;
  }
  const safeName = escapeHtml((user.first_name || "Player").trim());
  return `<a href="tg://user?id=${user.id}">${safeName}</a>`;
}

export const giftHandlers: Record<string, CommandHandler> = {
  "/gift": async (ctx: BotContext) => {
    try {
      const reply = ctx.reply;

      // 1. Reply-only enforcement
      if (!reply) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "⚠️ <b>Reply Required</b>\n\n" +
            "<code>/gift</code> is a reply-only command. Reply to another user's message with:\n" +
            "<code>/gift &lt;item name&gt;</code>\n\n" +
            "<i>Examples:</i> <code>/gift rose</code>, <code>/gift BMW X5 xDrive40i</code>",
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      // 2. Recipient validation
      const recipient = reply.from;
      if (!recipient || !recipient.id) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "❌ Unable to identify the recipient.",
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      if (recipient.is_bot) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "❌ You cannot gift items to a bot.",
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      if (recipient.id === ctx.userId) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "❌ You cannot gift an item to yourself.",
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      // 3. Item query validation
      const rawQuery = ctx.args.join(" ").trim();
      if (!rawQuery) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "⚠️ <b>Usage:</b> Reply to a player's message with <code>/gift &lt;item name&gt;</code>\n\n" +
            "<i>Examples:</i>\n" +
            "• <code>/gift rose</code>\n" +
            "• <code>/gift burger</code>\n" +
            "• <code>/gift BMW X5 xDrive40i</code>",
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      const resolved = resolveMarketItem(rawQuery);

      if (resolved.status === "not_found") {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          `❌ Item "<b>${escapeHtml(rawQuery)}</b>" was not found in Aloo Market.\n` +
            `Open <code>/market</code> to browse available items.`,
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      if (resolved.status === "ambiguous") {
        const matchList = resolved.matches
          .slice(0, 12)
          .map(
            (m) =>
              `• ${m.emoji} <b>${escapeHtml(m.name)}</b> (${formatCompactIndianPrice(
                m.price_amount
              )})`
          )
          .join("\n");

        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          `⚠️ <b>Multiple Models Matched "${escapeHtml(rawQuery)}"</b>\n\n` +
            `Please specify the exact item name:\n\n` +
            `${matchList}\n\n` +
            `<i>No money was deducted.</i>`,
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      // 4. Atomic gift purchase & inventory transfer
      const item = resolved.item;
      const idempotencyKey = `gift_upd_${ctx.update.update_id}`;

      const txRes = await giftMarketItemTx(
        ctx.userId,
        recipient.id,
        recipient.first_name,
        item.id,
        item.price_amount,
        idempotencyKey
      );

      if (txRes.status === "duplicate") {
        return;
      }

      if (txRes.status === "insufficient_balance") {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          `❌ <b>Insufficient Balance</b>\n\n` +
            `Gift: ${item.emoji} <b>${escapeHtml(item.name)}</b>\n` +
            `Required: <b>${formatRupees(item.price_amount)}</b>\n` +
            `Your Balance: <b>${formatRupees(txRes.balance)}</b>\n\n` +
            `No money was deducted.`,
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      const senderDisplay = ctx.message.from
        ? formatUserReference(ctx.message.from)
        : `<a href="tg://user?id=${ctx.userId}">Player</a>`;
      const recipientDisplay = formatUserReference(recipient);

      let receiptText: string;
      if (item.category === "cars") {
        receiptText =
          `🎁 <b>LUXURY GIFT SENT</b>\n\n` +
          `${senderDisplay} gifted a <b>${escapeHtml(item.name)}</b> to ${recipientDisplay}.\n\n` +
          `Vehicle value: <b>${formatRupees(item.price_amount)}</b>\n\n` +
          `The vehicle has been added to ${recipientDisplay}'s inventory.`;
      } else {
        receiptText =
          `🎁 <b>GIFT SENT SUCCESSFULLY</b>\n\n` +
          `${senderDisplay} gifted ${item.emoji} <b>${escapeHtml(
            item.name
          )}</b> to ${recipientDisplay}.\n\n` +
          `Gift value: <b>${formatRupees(item.price_amount)}</b>\n\n` +
          `The item has been added to ${recipientDisplay}'s inventory.`;
      }

      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        receiptText,
        undefined,
        ctx.message?.message_id
      );
    } catch (err: any) {
      console.error("Gift command error:", err);
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
