import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import { ECONOMY_LIMITS } from "../../settings/economy-config";
import {
  bankDepositTx,
  bankWithdrawTx,
  claimBankInterestTx,
  getBankAccountState,
  getBankTransactionHistory,
} from "../../database/investments-and-bank";
import { ensureUserExists } from "../../database/users";
import { formatCompactIndianPrice, formatRupees } from "./market-pricing";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
} from "../../telegram/messages";

export async function buildBankView(
  ownerId: number
): Promise<{ text: string; replyMarkup: { inline_keyboard: any[][] } }> {
  const state = await getBankAccountState(ownerId);

  const capNote =
    state.savingsBalance > ECONOMY_LIMITS.BANK_MAX_INTEREST_PRINCIPAL
      ? `\nInterest-bearing principal: <b>${formatCompactIndianPrice(
          state.eligiblePrincipal
        )}</b> (Cap reached)`
      : "";

  const text =
    `🏦 <b>ALOO BANK</b>\n\n` +
    `Wallet: <b>${formatRupees(state.walletBalance)}</b>\n` +
    `Savings: <b>${formatRupees(state.savingsBalance)}</b>${capNote}\n\n` +
    `Interest rate: <b>0.03% / day</b> (Max ₹10 Crore principal)\n` +
    `Available interest: <b>${formatRupees(state.availableInterest)}</b>\n\n` +
    `<i>Tip: Use buttons below or <code>/bank deposit &lt;amount&gt;</code> / <code>/bank withdraw &lt;amount&gt;</code>.</i>`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "➕ Deposit", callback_data: `bnk:${ownerId}:dep_menu` },
        { text: "➖ Withdraw", callback_data: `bnk:${ownerId}:wdr_menu` },
      ],
      [
        {
          text: `💰 Collect Interest (${formatRupees(state.availableInterest)})`,
          callback_data: `bnk:${ownerId}:interest`,
        },
        { text: "📜 History", callback_data: `bnk:${ownerId}:history` },
      ],
    ],
  };

  return { text, replyMarkup };
}

async function buildAmountMenu(
  ownerId: number,
  mode: "deposit" | "withdraw"
): Promise<{ text: string; replyMarkup: { inline_keyboard: any[][] } }> {
  const state = await getBankAccountState(ownerId);
  const available = mode === "deposit" ? state.walletBalance : state.savingsBalance;
  const prefix = mode === "deposit" ? "dep" : "wdr";
  const title = mode === "deposit" ? "➕ <b>DEPOSIT TO SAVINGS</b>" : "➖ <b>WITHDRAW TO WALLET</b>";

  const presets = [10_000, 50_000, 250_000, 1_000_000];
  const keyboard: any[][] = [];
  const row1: any[] = [];
  const row2: any[] = [];

  for (let i = 0; i < presets.length; i++) {
    const amt = presets[i];
    const btn = {
      text: formatCompactIndianPrice(amt),
      callback_data: `bnk:${ownerId}:${prefix}:${amt}`,
    };
    if (i < 2) row1.push(btn);
    else row2.push(btn);
  }
  keyboard.push(row1, row2);

  if (available > 0) {
    keyboard.push([
      {
        text: `${mode === "deposit" ? "Deposit" : "Withdraw"} All (${formatCompactIndianPrice(
          available
        )})`,
        callback_data: `bnk:${ownerId}:${prefix}:all`,
      },
    ]);
  }
  keyboard.push([{ text: "🔙 Back to Bank", callback_data: `bnk:${ownerId}:home` }]);

  const text =
    `${title}\n\n` +
    `Wallet: <b>${formatRupees(state.walletBalance)}</b>\n` +
    `Savings: <b>${formatRupees(state.savingsBalance)}</b>\n\n` +
    `Select an amount or use <code>/bank ${mode} &lt;amount&gt;</code>:`;

  return { text, replyMarkup: { inline_keyboard: keyboard } };
}

export async function handleBankCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (!data.startsWith("bnk:")) return false;

  const clickerId = cq.from?.id;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  if (!clickerId || !chatId) return false;

  const parts = data.split(":");
  const ownerId = Number(parts[1]);
  const action = parts[2];
  const arg = parts[3] || "";

  if (!Number.isInteger(ownerId) || ownerId <= 0 || !action) {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid or expired menu.", true);
    return true;
  }

  if (clickerId !== ownerId) {
    await answerCallbackQuery(
      env.BOT_TOKEN,
      cq.id,
      "⚠️ This bank session belongs to another player. Send /bank to open yours!",
      true
    );
    return true;
  }

  try {
    await ensureUserExists(clickerId, cq.from?.first_name);

    if (action === "home") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = await buildBankView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "dep_menu" || action === "wdr_menu") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = await buildAmountMenu(ownerId, action === "dep_menu" ? "deposit" : "withdraw");
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "dep") {
      const state = await getBankAccountState(ownerId);
      const amount = arg === "all" ? state.walletBalance : Number(arg);
      const res = await bankDepositTx(ownerId, amount, `bnk_dep_${cq.id}`);

      if (res.status === "duplicate") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Deposit already processed.");
      } else if (res.status === "invalid_amount") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Nothing available to deposit.", true);
        return true;
      } else if (res.status === "insufficient_balance") {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `❌ Insufficient wallet balance (${formatRupees(res.walletBalance)}).`,
          true
        );
        return true;
      } else {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `✅ Deposited ${formatRupees(res.deposited)}!`,
          true
        );
      }

      const view = await buildBankView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "wdr") {
      const state = await getBankAccountState(ownerId);
      const amount = arg === "all" ? state.savingsBalance : Number(arg);
      const res = await bankWithdrawTx(ownerId, amount, `bnk_wdr_${cq.id}`);

      if (res.status === "duplicate") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Withdrawal already processed.");
      } else if (res.status === "invalid_amount") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Nothing available to withdraw.", true);
        return true;
      } else if (res.status === "insufficient_savings") {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `❌ Insufficient savings (${formatRupees(res.savingsBalance)}).`,
          true
        );
        return true;
      } else {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `✅ Withdrew ${formatRupees(res.withdrawn)}!`,
          true
        );
      }

      const view = await buildBankView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "interest") {
      const res = await claimBankInterestTx(ownerId, `bnk_int_${cq.id}`);
      if (res.status === "duplicate") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Interest already collected.");
      } else if (res.status === "no_interest_yet") {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          "⏳ No interest accrued yet. Deposit savings and check back later!",
          true
        );
        return true;
      } else {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `💰 Collected ${formatRupees(res.interestEarned)} interest!`,
          true
        );
      }

      const view = await buildBankView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "history") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const rows = await getBankTransactionHistory(ownerId, 8);
      const lines =
        rows.length === 0
          ? ["<i>No bank transactions recorded yet.</i>"]
          : rows.map((r) => {
              const label =
                r.tx_type === "bank_deposit"
                  ? "➕ Deposit"
                  : r.tx_type === "bank_withdraw"
                  ? "➖ Withdraw"
                  : "💰 Interest";
              return `• ${label}: <b>${formatRupees(Math.abs(r.amount))}</b>`;
            });

      const text = `📜 <b>BANK HISTORY</b>\n\n${lines.join("\n")}`;
      const kb = {
        inline_keyboard: [[{ text: "🔙 Back to Bank", callback_data: `bnk:${ownerId}:home` }]],
      };
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, text, kb);
      }
      return true;
    }

    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid action.", true);
    return true;
  } catch (err: any) {
    console.error("Bank callback error:", err?.message || err, err);
    const detail = err?.message ? String(err.message).slice(0, 140) : "Bank error.";
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, `⚠️ ${detail}`, true);
    return true;
  }
}

export const bankHandlers: Record<string, CommandHandler> = {
  "/bank": async (ctx: BotContext) => {
    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const sub = (ctx.args[0] || "").toLowerCase();
    const amtRaw = ctx.args[1] || "";

    if ((sub === "deposit" || sub === "withdraw") && amtRaw) {
      const parsed = Number(amtRaw);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          `⚠️ Please enter a valid positive whole rupee amount for <code>/bank ${sub}</code>.`,
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      if (sub === "deposit") {
        const res = await bankDepositTx(ctx.userId, parsed, `bnk_cmd_${ctx.update.update_id}`);
        if (res.status === "insufficient_balance") {
          await sendMessage(
            ctx.env.BOT_TOKEN,
            ctx.chatId,
            `❌ Insufficient wallet balance (<b>${formatRupees(res.walletBalance)}</b>).`,
            undefined,
            ctx.message?.message_id
          );
          return;
        }
        if (res.status === "ok") {
          await sendMessage(
            ctx.env.BOT_TOKEN,
            ctx.chatId,
            `✅ Deposited <b>${formatRupees(res.deposited)}</b> into Aloo Bank.\n` +
              `Wallet: <b>${formatRupees(res.walletBalance)}</b> • Savings: <b>${formatRupees(
                res.savingsBalance
              )}</b>`,
            undefined,
            ctx.message?.message_id
          );
          return;
        }
      } else {
        const res = await bankWithdrawTx(ctx.userId, parsed, `bnk_cmd_${ctx.update.update_id}`);
        if (res.status === "insufficient_savings") {
          await sendMessage(
            ctx.env.BOT_TOKEN,
            ctx.chatId,
            `❌ Insufficient bank savings (<b>${formatRupees(res.savingsBalance)}</b>).`,
            undefined,
            ctx.message?.message_id
          );
          return;
        }
        if (res.status === "ok") {
          await sendMessage(
            ctx.env.BOT_TOKEN,
            ctx.chatId,
            `✅ Withdrew <b>${formatRupees(res.withdrawn)}</b> to your wallet.\n` +
              `Wallet: <b>${formatRupees(res.walletBalance)}</b> • Savings: <b>${formatRupees(
                res.savingsBalance
              )}</b>`,
            undefined,
            ctx.message?.message_id
          );
          return;
        }
      }
    }

    const view = await buildBankView(ctx.userId);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      view.text,
      view.replyMarkup,
      ctx.message?.message_id
    );
  },
};
