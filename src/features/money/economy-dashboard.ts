import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import { PROFESSIONS } from "../../settings/economy-config";
import { getUserMissionsBoard, getUserWorkState } from "../../database/active-income";
import {
  getPlayerNetWorth,
  getTopWealthLeaderboard,
} from "../../database/investments-and-bank";
import { ensureUserExists } from "../../database/users";
import { formatCompactIndianPrice, formatRupees } from "./market-pricing";
import { escapeHtml } from "../../ui/fancy-text";
import { buildWorkCentreView } from "./work";
import { buildMissionsView } from "./missions";
import { buildBusinessHubView } from "./business";
import { buildPropertyHubView } from "./property";
import { buildBankView } from "./bank";
import { buildMainMarketView } from "./market";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
} from "../../telegram/messages";

export async function buildNetWorthView(
  ownerId: number
): Promise<{ text: string; replyMarkup: { inline_keyboard: any[][] } }> {
  const nw = await getPlayerNetWorth(ownerId);

  const text =
    `📊 <b>NET WORTH & WEALTH RANK</b>\n\n` +
    `Rank: ${nw.rank.emoji} <b>${nw.rank.name}</b>\n` +
    `Total Net Worth: <b>${formatRupees(nw.netWorth)}</b> (${formatCompactIndianPrice(
      nw.netWorth
    )})\n\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `💵 Wallet: <b>${formatRupees(nw.wallet)}</b>\n` +
    `🏦 Bank Savings: <b>${formatRupees(nw.bankSavings)}</b>\n` +
    `🏢 Businesses: <b>${formatRupees(nw.businessValue)}</b>\n` +
    `🏠 Properties: <b>${formatRupees(nw.propertyValue)}</b>\n` +
    `🚗 Vehicles & Assets: <b>${formatRupees(nw.inventoryValue)}</b>\n\n` +
    `━━━━━━━━━━━━━━━━`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "🏆 Wealth Leaderboard", callback_data: `eco:${ownerId}:wealth_top` },
        { text: "💰 Economy Hub", callback_data: `eco:${ownerId}:home` },
      ],
    ],
  };

  return { text, replyMarkup };
}

export async function buildEconomyDashboardView(
  ownerId: number
): Promise<{ text: string; replyMarkup: { inline_keyboard: any[][] } }> {
  const now = Math.floor(Date.now() / 1000);
  const [nw, workState, dailyMissions] = await Promise.all([
    getPlayerNetWorth(ownerId, now),
    getUserWorkState(ownerId, now),
    getUserMissionsBoard(ownerId, "daily", now),
  ]);

  const prof = PROFESSIONS.find((p) => p.id === workState.profession);
  const profLabel = prof ? `${prof.emoji} ${prof.name}` : "Unassigned";

  const claimableCount = dailyMissions.filter(
    (m) => !m.claimed && m.progress >= m.target
  ).length;
  const activeCount = dailyMissions.filter((m) => !m.claimed).length;

  const text =
    `💰 <b>ALOO ECONOMY</b>\n\n` +
    `Wallet: <b>${formatRupees(nw.wallet)}</b>\n` +
    `Bank: <b>${formatRupees(nw.bankSavings)}</b>\n` +
    `Net worth: <b>${formatRupees(nw.netWorth)}</b> (${nw.rank.emoji} ${nw.rank.name})\n\n` +
    `Daily business profit: <b>${formatRupees(nw.dailyBusinessNet)}</b>\n` +
    `Daily rental income: <b>${formatRupees(nw.dailyRentalIncome)}</b>\n\n` +
    `Profession: <b>${profLabel}</b>\n` +
    `Daily missions: <b>${activeCount} active</b> (${claimableCount} ready to claim)\n\n` +
    `━━━━━━━━━━━━━━━━`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "💼 Work", callback_data: `eco:${ownerId}:work` },
        { text: "📦 Delivery", callback_data: `eco:${ownerId}:delivery` },
      ],
      [
        { text: "🎯 Missions", callback_data: `eco:${ownerId}:missions` },
        { text: "🏢 Business", callback_data: `eco:${ownerId}:business` },
      ],
      [
        { text: "🏠 Property", callback_data: `eco:${ownerId}:property` },
        { text: "🏦 Bank", callback_data: `eco:${ownerId}:bank` },
      ],
      [
        { text: "🛍️ Market", callback_data: `eco:${ownerId}:market` },
        { text: "📊 Net Worth", callback_data: `eco:${ownerId}:networth` },
      ],
    ],
  };

  return { text, replyMarkup };
}

export async function handleEconomyCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (!data.startsWith("eco:")) return false;

  const clickerId = cq.from?.id;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  if (!clickerId || !chatId) return false;

  const parts = data.split(":");
  const ownerId = Number(parts[1]);
  const section = parts[2];

  if (!Number.isInteger(ownerId) || ownerId <= 0 || !section) {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid or expired menu.", true);
    return true;
  }

  if (clickerId !== ownerId) {
    await answerCallbackQuery(
      env.BOT_TOKEN,
      cq.id,
      "⚠️ This economy dashboard belongs to another player. Send /economy to open yours!",
      true
    );
    return true;
  }

  try {
    await ensureUserExists(clickerId, cq.from?.first_name);
    await answerCallbackQuery(env.BOT_TOKEN, cq.id);

    if (section === "home") {
      const view = await buildEconomyDashboardView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (section === "work") {
      const view = await buildWorkCentreView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (section === "delivery") {
      const text =
        `📦 <b>DELIVERY DISPATCH</b>\n\n` +
        `Send <code>/delivery</code> to accept or complete your active delivery route.`;
      const kb = {
        inline_keyboard: [[{ text: "🔙 Back to Economy", callback_data: `eco:${ownerId}:home` }]],
      };
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, text, kb);
      }
      return true;
    }

    if (section === "missions") {
      const view = await buildMissionsView(ownerId, "daily");
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (section === "business") {
      const view = await buildBusinessHubView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (section === "property") {
      const view = await buildPropertyHubView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (section === "bank") {
      const view = await buildBankView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (section === "market") {
      const nw = await getPlayerNetWorth(ownerId);
      const view = buildMainMarketView(ownerId, nw.wallet);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (section === "networth") {
      const view = await buildNetWorthView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (section === "wealth_top") {
      const leaders = await getTopWealthLeaderboard(10);
      const lines =
        leaders.length === 0
          ? ["<i>No ranked players yet.</i>"]
          : leaders.map((entry, i) => {
              const name = escapeHtml(entry.first_name || `Player ${entry.user_id}`);
              return `${i + 1}. <a href="tg://user?id=${entry.user_id}">${name}</a> — <b>${formatCompactIndianPrice(
                entry.net_worth
              )}</b>`;
            });

      const text = `🏆 <b>WEALTH LEADERBOARD (NET WORTH)</b>\n\n${lines.join("\n")}`;
      const kb = {
        inline_keyboard: [
          [
            { text: "📊 My Net Worth", callback_data: `eco:${ownerId}:networth` },
            { text: "💰 Economy Hub", callback_data: `eco:${ownerId}:home` },
          ],
        ],
      };
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, text, kb);
      }
      return true;
    }

    return true;
  } catch (err) {
    console.error("Economy dashboard callback error:", err);
    return true;
  }
}

export const economyDashboardHandlers: Record<string, CommandHandler> = {
  "/economy": async (ctx: BotContext) => {
    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const view = await buildEconomyDashboardView(ctx.userId);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      view.text,
      view.replyMarkup,
      ctx.message?.message_id
    );
  },

  "/networth": async (ctx: BotContext) => {
    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const view = await buildNetWorthView(ctx.userId);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      view.text,
      view.replyMarkup,
      ctx.message?.message_id
    );
  },
};
