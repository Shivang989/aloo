import { BotContext, CommandHandler } from "../../types/bot";
import { ECONOMY_LIMITS } from "../../settings/economy-config";
import { adminAdjustWalletTx } from "../../database/economy";
import { formatRupees } from "./market-pricing";
import { escapeHtml } from "../../ui/fancy-text";
import { sendMessage } from "../../telegram/messages";

export const adminTransferHandlers: Record<string, CommandHandler> = {
  "/transfer": async (ctx: BotContext) => {
    const isOwner = String(ctx.userId).trim() === String(ctx.env.OWNER_ID).trim();
    if (!isOwner) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "❌ <b>Access Denied:</b> Only the bot owner can use <code>/transfer</code>.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const targetUser = ctx.reply?.from;
    if (!targetUser || !targetUser.id) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ <b>Reply Required</b>\n\n" +
          "Reply to a player's message with:\n" +
          "• <code>/transfer 500000</code> (credit wallet)\n" +
          "• <code>/transfer -500000</code> (debit wallet)",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    if (targetUser.is_bot) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "❌ Cannot adjust the wallet of a bot account.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    if (ctx.args.length !== 1) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ <b>Usage:</b> Reply to a player's message with <code>/transfer &lt;amount&gt;</code> (e.g., <code>/transfer 500000</code> or <code>/transfer -200000</code>).",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const rawAmount = ctx.args[0].trim();
    if (!/^[+-]?\d+$/.test(rawAmount)) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "❌ Invalid amount. Enter a whole integer rupee value (no decimals or text).",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const parsedAmount = Number(rawAmount);
    if (
      !Number.isSafeInteger(parsedAmount) ||
      parsedAmount === 0 ||
      Math.abs(parsedAmount) > ECONOMY_LIMITS.MAX_SAFE_ADJUSTMENT
    ) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `❌ Amount must be a non-zero integer within ±${formatRupees(
          ECONOMY_LIMITS.MAX_SAFE_ADJUSTMENT
        )}.`,
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const txRes = await adminAdjustWalletTx({
      ownerId: ctx.userId,
      targetUserId: targetUser.id,
      targetFirstName: targetUser.first_name,
      deltaAmount: parsedAmount,
      idempotencyKey: `transfer_upd_${ctx.update.update_id}`,
    });

    if (txRes.status === "duplicate") return;

    const targetName = escapeHtml(targetUser.first_name || "Player");

    if (txRes.status === "insufficient_balance") {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `❌ <b>Debit Rejected</b>\n\n` +
          `Player: <b>${targetName}</b>\n` +
          `Current balance: <b>${formatRupees(txRes.balance)}</b>\n` +
          `Requested removal: <b>-${formatRupees(Math.abs(parsedAmount))}</b>\n\n` +
          `Wallet balance cannot become negative.`,
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const absFormatted = formatRupees(Math.abs(txRes.adjustedAmount));
    const oldFormatted = formatRupees(txRes.oldBalance);
    const newFormatted = formatRupees(txRes.newBalance);

    if (txRes.adjustedAmount > 0) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `✅ <b>WALLET CREDITED</b>\n\n` +
          `Player: <b>${targetName}</b>\n` +
          `Amount added: <b>+${absFormatted}</b>\n\n` +
          `Previous balance: <b>${oldFormatted}</b>\n` +
          `New balance: <b>${newFormatted}</b>\n\n` +
          `Admin adjustment completed.`,
        undefined,
        ctx.message?.message_id
      );
    } else {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `✅ <b>WALLET DEBITED</b>\n\n` +
          `Player: <b>${targetName}</b>\n` +
          `Amount removed: <b>-${absFormatted}</b>\n\n` +
          `Previous balance: <b>${oldFormatted}</b>\n` +
          `New balance: <b>${newFormatted}</b>\n\n` +
          `Admin adjustment completed.`,
        undefined,
        ctx.message?.message_id
      );
    }
  },
};
