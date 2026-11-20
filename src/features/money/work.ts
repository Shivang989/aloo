import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import { ECONOMY_LIMITS, PROFESSIONS, ProfessionConfig } from "../../settings/economy-config";
import {
  completeWorkShiftTx,
  getUserWorkState,
  selectUserProfession,
} from "../../database/active-income";
import { ensureUserExists } from "../../database/users";
import { formatRupees } from "./market-pricing";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
} from "../../telegram/messages";

export function calculateBalancedShiftPay(minPay: number, maxPay: number): number {
  if (maxPay <= minPay) return minPay;
  // Triangular distribution centered near the midpoint, rounded to nearest ₹100
  const u1 = Math.random();
  const u2 = Math.random();
  const triangular = (u1 + u2) / 2;
  const raw = minPay + triangular * (maxPay - minPay);
  const rounded = Math.round(raw / 100) * 100;
  return Math.min(maxPay, Math.max(minPay, rounded));
}

function formatDurationCompact(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${rem}s`;
  return `${rem}s`;
}

function getProfessionById(id: string | null): ProfessionConfig | undefined {
  if (!id) return undefined;
  return PROFESSIONS.find((p) => p.id === id);
}

export function buildProfessionPickerView(
  ownerId: number,
  currentProfId: string | null
): { text: string; replyMarkup: { inline_keyboard: any[][] } } {
  const lines = PROFESSIONS.map(
    (p) =>
      `${p.emoji} <b>${p.name}</b> — ${formatRupees(p.minPay)} – ${formatRupees(p.maxPay)} / shift`
  );

  const text =
    `💼 <b>SELECT PROFESSION</b>\n\n` +
    `Choose your career path to earn hourly shift salaries:\n\n` +
    `${lines.join("\n")}\n\n` +
    `<i>Note: Switching professions later has a 6-hour cooldown.</i>`;

  const keyboard: any[][] = [];
  for (let i = 0; i < PROFESSIONS.length; i += 2) {
    const row: any[] = [];
    for (const p of PROFESSIONS.slice(i, i + 2)) {
      const activeMark = p.id === currentProfId ? " ✓" : "";
      row.push({
        text: `${p.emoji} ${p.name}${activeMark}`,
        callback_data: `wrk:${ownerId}:set:${p.id}`,
      });
    }
    keyboard.push(row);
  }

  if (currentProfId) {
    keyboard.push([{ text: "🔙 Back to Work Centre", callback_data: `wrk:${ownerId}:home` }]);
  }

  return { text, replyMarkup: { inline_keyboard: keyboard } };
}

export async function buildWorkCentreView(
  ownerId: number
): Promise<{ text: string; replyMarkup: { inline_keyboard: any[][] } }> {
  const now = Math.floor(Date.now() / 1000);
  const state = await getUserWorkState(ownerId, now);
  const prof = getProfessionById(state.profession);

  if (!prof) {
    return buildProfessionPickerView(ownerId, null);
  }

  const elapsed = now - state.lastWorkAt;
  const remaining =
    state.lastWorkAt > 0 && elapsed < ECONOMY_LIMITS.WORK_COOLDOWN_SEC
      ? ECONOMY_LIMITS.WORK_COOLDOWN_SEC - elapsed
      : 0;

  const statusText =
    remaining === 0
      ? "Ready to work"
      : `Cooldown (${formatDurationCompact(remaining)} remaining)`;

  const text =
    `💼 <b>WORK CENTRE</b>\n\n` +
    `Profession: ${prof.emoji} <b>${prof.name}</b>\n\n` +
    `Salary per shift:\n` +
    `<b>${formatRupees(prof.minPay)} – ${formatRupees(prof.maxPay)}</b>\n\n` +
    `Wallet: <b>${formatRupees(state.balance)}</b>\n` +
    `Status: <b>${statusText}</b>`;

  const replyMarkup = {
    inline_keyboard: [
      [{ text: "💼 Start Work", callback_data: `wrk:${ownerId}:shift` }],
      [
        { text: "🔄 Change Profession", callback_data: `wrk:${ownerId}:choose` },
        { text: "📊 Work Statistics", callback_data: `wrk:${ownerId}:stats` },
      ],
    ],
  };

  return { text, replyMarkup };
}

export async function handleWorkCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (!data.startsWith("wrk:")) return false;

  const clickerId = cq.from?.id;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  if (!clickerId || !chatId) return false;

  const parts = data.split(":");
  const ownerId = Number(parts[1]);
  const action = parts[2];

  if (!Number.isInteger(ownerId) || ownerId <= 0 || !action) {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Expired or invalid menu.", true);
    return true;
  }

  if (clickerId !== ownerId) {
    await answerCallbackQuery(
      env.BOT_TOKEN,
      cq.id,
      "⚠️ This Work Centre belongs to another player. Send /work to open yours!",
      true
    );
    return true;
  }

  try {
    await ensureUserExists(clickerId, cq.from?.first_name);

    if (action === "home") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = await buildWorkCentreView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "choose") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const state = await getUserWorkState(ownerId);
      const view = buildProfessionPickerView(ownerId, state.profession);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "set") {
      const profId = parts[3] || "";
      const res = await selectUserProfession(ownerId, profId);

      if (res.status === "invalid_profession") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid profession.", true);
        return true;
      }
      if (res.status === "already_selected") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "ℹ️ Already working in this profession.");
        return true;
      }
      if (res.status === "switch_cooldown") {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `⏳ You can switch professions again in ${formatDurationCompact(res.remainingSec)}.`,
          true
        );
        return true;
      }

      const prof = getProfessionById(profId)!;
      await answerCallbackQuery(env.BOT_TOKEN, cq.id, `✅ Profession set to ${prof.name}!`);
      const view = await buildWorkCentreView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "stats") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const state = await getUserWorkState(ownerId);
      const prof = getProfessionById(state.profession);

      const text =
        `📊 <b>WORK STATISTICS</b>\n\n` +
        `Current Profession: <b>${prof ? `${prof.emoji} ${prof.name}` : "None"}</b>\n` +
        `Completed Shifts: <b>${state.totalShifts}</b>\n` +
        `Today's Active Earnings: <b>${formatRupees(state.dailyActiveEarned)}</b> / ${formatRupees(
          ECONOMY_LIMITS.DAILY_ACTIVE_INCOME_CAP
        )}\n` +
        `Wallet Balance: <b>${formatRupees(state.balance)}</b>`;

      const kb = {
        inline_keyboard: [[{ text: "🔙 Back to Work Centre", callback_data: `wrk:${ownerId}:home` }]],
      };

      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, text, kb);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, text, kb);
      }
      return true;
    }

    if (action === "shift") {
      const state = await getUserWorkState(ownerId);
      const prof = getProfessionById(state.profession);
      if (!prof) {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Choose a profession first.", true);
        const view = buildProfessionPickerView(ownerId, null);
        if (messageId) {
          await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
        }
        return true;
      }

      const payout = calculateBalancedShiftPay(prof.minPay, prof.maxPay);
      const shiftRes = await completeWorkShiftTx(ownerId, payout, `work_cq_${cq.id}`);

      if (shiftRes.status === "duplicate") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Shift already recorded.");
        return true;
      }

      if (shiftRes.status === "no_profession") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Please select a profession first.", true);
        return true;
      }

      if (shiftRes.status === "cooldown") {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `⏳ Next shift available in ${formatDurationCompact(shiftRes.remainingSec)}.`,
          true
        );
        return true;
      }

      if (shiftRes.status === "daily_cap_reached") {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `⚠️ Daily active income limit (${formatRupees(shiftRes.cap)}) reached!`,
          true
        );
        return true;
      }

      await answerCallbackQuery(
        env.BOT_TOKEN,
        cq.id,
        `✅ Earned ${formatRupees(shiftRes.earned)}!`
      );

      const receiptText =
        `✅ <b>SHIFT COMPLETED</b>\n\n` +
        `Profession: ${prof.emoji} <b>${prof.name}</b>\n` +
        `Salary earned: <b>${formatRupees(shiftRes.earned)}</b>\n\n` +
        `Wallet: <b>${formatRupees(shiftRes.newBalance)}</b>\n\n` +
        `Next shift available in 60 minutes.`;

      const kb = {
        inline_keyboard: [
          [
            { text: "📊 Work Statistics", callback_data: `wrk:${ownerId}:stats` },
            { text: "🔙 Work Centre", callback_data: `wrk:${ownerId}:home` },
          ],
        ],
      };

      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, receiptText, kb);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, receiptText, kb);
      }
      return true;
    }

    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid action.", true);
    return true;
  } catch (err) {
    console.error("Work callback error:", err);
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Error processing work action.", true);
    return true;
  }
}

export const workHandlers: Record<string, CommandHandler> = {
  "/work": async (ctx: BotContext) => {
    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const view = await buildWorkCentreView(ctx.userId);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      view.text,
      view.replyMarkup,
      ctx.message?.message_id
    );
  },
};
