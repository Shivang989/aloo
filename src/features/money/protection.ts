import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import { activateSafeProtectionTx } from "../../database/users";
import { sendMessage, answerCallbackQuery } from "../../telegram/messages";

export const SAFE_CONFIG: Record<number, { durationSec: number; price: number; label: string }> = {
  1: { durationSec: 86400, price: 300, label: "1 day" },
  2: { durationSec: 172800, price: 400, label: "2 days" },
  3: { durationSec: 259200, price: 600, label: "3 days" },
};

export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || (d === 0 && h === 0)) parts.push(`${m}m`);

  return parts.join(" ") || "1m";
}

export async function activateSafeProtection(
  userId: number,
  durationDays: number
): Promise<{ ok: boolean; message: string }> {
  const plan = SAFE_CONFIG[durationDays];
  if (!plan) {
    return {
      ok: false,
      message:
        "🛡️ <b>Safe Protection</b>\n\n" +
        "Usage:\n" +
        "<code>/safe 1</code> — 1 day (₹300)\n" +
        "<code>/safe 2</code> — 2 days (₹400)\n" +
        "<code>/safe 3</code> — 3 days (₹600)\n\n" +
        "Protection prevents robbery while active.",
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const result = await activateSafeProtectionTx(userId, plan.durationSec, plan.price);

  if (result.status === "already_active") {
    const remaining = formatRemainingTime(result.protectedUntil - now);
    return {
      ok: false,
      message:
        `🛡️ <b>Protection Already Active</b>\n\n` +
        `Time remaining: ${remaining}\n\n` +
        `No additional payment was taken.`,
    };
  }

  if (result.status === "insufficient_balance") {
    return {
      ok: false,
      message:
        `❌ <b>Insufficient balance</b>\n\n` +
        `Required: ₹${plan.price}\n` +
        `Your balance: ₹${result.balance}\n\n` +
        `Earn more money and try again.`,
    };
  }

  const expiryDate = new Date(result.expiryTimestamp * 1000).toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return {
    ok: true,
    message:
      `🛡️ <b>Protection Activated</b>\n\n` +
      `Duration: ${plan.label}\n` +
      `Paid: ₹${plan.price}\n` +
      `Expires: ${expiryDate} IST\n\n` +
      `Your balance is now protected from robbery.`,
  };
}

export async function handleSafeCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (!data.startsWith("safe:")) return false;

  const days = parseInt(data.replace("safe:", ""), 10);
  const userId = cq.from?.id;
  const chatId = cq.message?.chat?.id;

  if (!userId || !chatId || !days) return false;

  await answerCallbackQuery(env.BOT_TOKEN, cq.id);

  const res = await activateSafeProtection(userId, days);
  await sendMessage(env.BOT_TOKEN, chatId, res.message);
  return true;
}

export const protectionHandlers: Record<string, CommandHandler> = {
  "/safe": async (ctx: BotContext) => {
    try {
      const rawArg = (ctx.args[0] || "").toLowerCase().trim().replace("d", "");
      const isPrivate = ctx.message.chat.type === "private" || ctx.chatId > 0;

      if (rawArg === "1" || rawArg === "2" || rawArg === "3") {
        const days = parseInt(rawArg, 10);
        const res = await activateSafeProtection(ctx.userId, days);
        await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, res.message, undefined, ctx.message.message_id);
        return;
      }

      if (isPrivate) {
        const dmText =
          `🛡️ <b>Safe Protection</b>\n\n` +
          `Choose your protection duration:\n\n` +
          `• 1 day — ₹300\n` +
          `• 2 days — ₹400\n` +
          `• 3 days — ₹600`;

        const dmKb = {
          inline_keyboard: [
            [
              { text: "1 Day", callback_data: "safe:1" },
              { text: "2 Days", callback_data: "safe:2" },
              { text: "3 Days", callback_data: "safe:3" },
            ],
          ],
        };

        await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, dmText, dmKb, ctx.message.message_id);
      } else {
        const groupText =
          `🛡️ <b>Safe Protection</b>\n\n` +
          `Usage:\n` +
          `<code>/safe 1</code> — 1 day (₹300)\n` +
          `<code>/safe 2</code> — 2 days (₹400)\n` +
          `<code>/safe 3</code> — 3 days (₹600)\n\n` +
          `Protection prevents robbery while active.`;

        await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, groupText, undefined, ctx.message.message_id);
      }
    } catch (err: any) {
      console.error("Safe command error:", err);
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `⚠️ <code>${err?.message || "Execution error"}</code>`
      );
    }
  },
};
