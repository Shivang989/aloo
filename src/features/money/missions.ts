import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import {
  claimMissionRewardTx,
  getUserMissionsBoard,
  MissionProgressItem,
} from "../../database/active-income";
import { getIstDateKey, getIstWeekKey } from "../../database/economy";
import { ensureUserExists } from "../../database/users";
import { formatRupees, formatCompactIndianPrice } from "./market-pricing";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
} from "../../telegram/messages";

function formatMissionStatus(item: MissionProgressItem): string {
  if (item.claimed) return "✅ Claimed";
  if (item.progress >= item.target) return `🎁 Ready (${item.progress}/${item.target})`;
  return `⏳ ${item.progress}/${item.target}`;
}

export async function buildMissionsView(
  ownerId: number,
  period: "daily" | "weekly"
): Promise<{ text: string; replyMarkup: { inline_keyboard: any[][] } }> {
  const now = Math.floor(Date.now() / 1000);
  const items = await getUserMissionsBoard(ownerId, period, now);

  const header =
    period === "daily" ? "🎯 <b>DAILY MISSIONS</b>" : "🏆 <b>WEEKLY CHALLENGES</b>";
  const periodLabel =
    period === "daily"
      ? `Reset Cycle: IST Daily (${getIstDateKey(now)})`
      : `Reset Cycle: IST Weekly (${getIstWeekKey(now)})`;

  const lines = items.map((m, idx) => {
    const rewardLabel =
      m.reward >= 100_000 ? formatCompactIndianPrice(m.reward) : formatRupees(m.reward);
    return (
      `${idx + 1}. <b>${m.title}</b>\n` +
      `   Reward: <b>${rewardLabel}</b> • ${formatMissionStatus(m)}`
    );
  });

  const text =
    `${header}\n` +
    `<i>${periodLabel}</i>\n\n` +
    `${lines.join("\n\n")}`;

  const keyboard: any[][] = [];
  const prefix = period === "daily" ? "msn" : "wkl";

  for (const m of items) {
    if (!m.claimed && m.progress >= m.target) {
      const rewardLabel =
        m.reward >= 100_000 ? formatCompactIndianPrice(m.reward) : formatRupees(m.reward);
      keyboard.push([
        {
          text: `🎁 Claim: ${m.title} (+${rewardLabel})`,
          callback_data: `${prefix}:${ownerId}:claim:${m.mission_id}`,
        },
      ]);
    }
  }

  const switchBtn =
    period === "daily"
      ? { text: "🏆 View Weekly Challenges", callback_data: `wkl:${ownerId}:view` }
      : { text: "🎯 View Daily Missions", callback_data: `msn:${ownerId}:view` };

  keyboard.push([
    switchBtn,
    { text: "🔄 Refresh", callback_data: `${prefix}:${ownerId}:view` },
  ]);

  return { text, replyMarkup: { inline_keyboard: keyboard } };
}

export async function handleMissionCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (!data.startsWith("msn:") && !data.startsWith("wkl:")) return false;

  const clickerId = cq.from?.id;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  if (!clickerId || !chatId) return false;

  const parts = data.split(":");
  const period: "daily" | "weekly" = parts[0] === "wkl" ? "weekly" : "daily";
  const ownerId = Number(parts[1]);
  const action = parts[2];
  const missionId = parts[3] || "";

  if (!Number.isInteger(ownerId) || ownerId <= 0 || !action) {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid or expired menu.", true);
    return true;
  }

  if (clickerId !== ownerId) {
    await answerCallbackQuery(
      env.BOT_TOKEN,
      cq.id,
      "⚠️ These missions belong to another player. Send /mission or /weekly to view yours!",
      true
    );
    return true;
  }

  try {
    await ensureUserExists(clickerId, cq.from?.first_name);

    if (action === "view") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = await buildMissionsView(ownerId, period);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "claim") {
      const claimRes = await claimMissionRewardTx(
        ownerId,
        period,
        missionId,
        `${period}_claim_${cq.id}`
      );

      if (claimRes.status === "duplicate" || claimRes.status === "already_claimed") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Reward already claimed.");
      } else if (claimRes.status === "not_completed") {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `⏳ Progress: ${claimRes.progress}/${claimRes.target} — complete the objective first!`,
          true
        );
        return true;
      } else if (claimRes.status === "not_found") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Mission not found.", true);
        return true;
      } else {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `🎁 Claimed +${formatRupees(claimRes.reward)}!`,
          true
        );
      }

      const view = await buildMissionsView(ownerId, period);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, view.text, view.replyMarkup);
      }
      return true;
    }

    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid action.", true);
    return true;
  } catch (err: any) {
    console.error("Mission callback error:", err?.message || err, err);
    const detail = err?.message ? String(err.message).slice(0, 140) : "Mission error.";
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, `⚠️ ${detail}`, true);
    return true;
  }
}

export const missionHandlers: Record<string, CommandHandler> = {
  "/mission": async (ctx: BotContext) => {
    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const view = await buildMissionsView(ctx.userId, "daily");
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      view.text,
      view.replyMarkup,
      ctx.message?.message_id
    );
  },

  "/weekly": async (ctx: BotContext) => {
    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const view = await buildMissionsView(ctx.userId, "weekly");
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      view.text,
      view.replyMarkup,
      ctx.message?.message_id
    );
  },
};
