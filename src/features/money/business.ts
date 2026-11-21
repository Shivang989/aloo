import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import { BUSINESS_CATALOG } from "../../settings/economy-config";
import {
  calculateBusinessAccrual,
  calculateUpgradeCost,
  collectBusinessProfitTx,
  getAllowedBusinessSlots,
  getPlayerNetWorth,
  getUserBusinesses,
  purchaseBusinessTx,
  upgradeBusinessTx,
} from "../../database/investments-and-bank";
import { ensureUserExists, getUser } from "../../database/users";
import { formatCompactIndianPrice, formatRupees } from "./market-pricing";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
} from "../../telegram/messages";

export async function buildBusinessHubView(
  ownerId: number
): Promise<{ text: string; replyMarkup: { inline_keyboard: any[][] } }> {
  const now = Math.floor(Date.now() / 1000);
  const [user, owned, nw] = await Promise.all([
    getUser(ownerId),
    getUserBusinesses(ownerId),
    getPlayerNetWorth(ownerId, now),
  ]);

  const wallet = user?.balance ?? 0;
  const maxSlots = getAllowedBusinessSlots(nw.netWorth);

  const keyboard: any[][] = [];

  if (owned.length === 0) {
    const text =
      `🏢 <b>ALOO BUSINESSES</b>\n\n` +
      `Wallet: <b>${formatRupees(wallet)}</b>\n` +
      `Business Slots: <b>0 / ${maxSlots}</b>\n\n` +
      `You do not own any businesses yet.\n` +
      `Purchase a business to earn passive net profits (15% operating expenses, 48h cap).`;

    keyboard.push([
      { text: "🛒 Browse & Buy Businesses", callback_data: `biz:${ownerId}:shop` },
    ]);
    return { text, replyMarkup: { inline_keyboard: keyboard } };
  }

  const sections: string[] = [];
  for (const b of owned) {
    const acc = calculateBusinessAccrual(b.catalog, b.level, b.last_collected_at, now);
    sections.push(
      `${b.catalog.emoji} <b>MY ${b.catalog.name.toUpperCase()}</b> (Lv.${b.level}/${b.catalog.maxLevel})\n` +
        `Gross revenue: <b>${formatRupees(acc.accruedGross)}</b>\n` +
        `Operating expenses (15%): <b>${formatRupees(acc.accruedExpenses)}</b>\n` +
        `Net profit ready: <b>${formatRupees(acc.accruedNet)}</b>`
    );

    const actionRow: any[] = [
      {
        text: `💰 Collect (${formatCompactIndianPrice(acc.accruedNet)})`,
        callback_data: `biz:${ownerId}:collect:${b.id}`,
      },
    ];
    if (b.level < b.catalog.maxLevel) {
      const upCost = calculateUpgradeCost(b.catalog.purchasePrice, b.level);
      actionRow.push({
        text: `⬆️ Upgrade (${formatCompactIndianPrice(upCost)})`,
        callback_data: `biz:${ownerId}:upgrade:${b.id}`,
      });
    }
    keyboard.push(actionRow);
    keyboard.push([
      {
        text: `📊 ${b.catalog.name} Details`,
        callback_data: `biz:${ownerId}:detail:${b.id}`,
      },
    ]);
  }

  if (owned.length < maxSlots) {
    keyboard.push([
      { text: "🛒 Buy Another Business", callback_data: `biz:${ownerId}:shop` },
    ]);
  } else {
    keyboard.push([
      { text: "📋 View Business Catalogue", callback_data: `biz:${ownerId}:shop` },
    ]);
  }

  const text =
    `🏢 <b>MY BUSINESS PORTFOLIO</b>\n` +
    `Wallet: <b>${formatRupees(wallet)}</b> • Slots: <b>${owned.length}/${maxSlots}</b>\n\n` +
    `${sections.join("\n\n━━━━━━━━━━━━━━━━\n\n")}`;

  return { text, replyMarkup: { inline_keyboard: keyboard } };
}

export async function buildBusinessShopView(
  ownerId: number
): Promise<{ text: string; replyMarkup: { inline_keyboard: any[][] } }> {
  const [user, owned, nw] = await Promise.all([
    getUser(ownerId),
    getUserBusinesses(ownerId),
    getPlayerNetWorth(ownerId),
  ]);

  const wallet = user?.balance ?? 0;
  const maxSlots = getAllowedBusinessSlots(nw.netWorth);
  const ownedTypes = new Set(owned.map((o) => o.business_type));

  const lines = BUSINESS_CATALOG.map((item) => {
    const dailyNet = Math.floor(item.dailyGrossIncome * 0.85);
    const tag = ownedTypes.has(item.id) ? " ✅ Owned" : "";
    return (
      `${item.emoji} <b>${item.name}</b>${tag}\n` +
      `Price: <b>${formatCompactIndianPrice(item.purchasePrice)}</b> • Net/day: <b>${formatRupees(
        dailyNet
      )}</b>`
    );
  });

  const keyboard: any[][] = [];
  for (const item of BUSINESS_CATALOG) {
    if (!ownedTypes.has(item.id)) {
      keyboard.push([
        {
          text: `${item.emoji} Buy ${item.name} • ${formatCompactIndianPrice(item.purchasePrice)}`,
          callback_data: `biz:${ownerId}:buy:${item.id}`,
        },
      ]);
    }
  }
  keyboard.push([{ text: "🔙 Back", callback_data: `biz:${ownerId}:home` }]);

  const text =
    `🏢 <b>BUSINESS CATALOGUE</b>\n\n` +
    `Wallet: <b>${formatRupees(wallet)}</b> • Slots: <b>${owned.length}/${maxSlots}</b>\n` +
    `<i>15% operating expenses apply • Uncollected profit caps at 48h.</i>\n\n` +
    `${lines.join("\n\n")}`;

  return { text, replyMarkup: { inline_keyboard: keyboard } };
}

export async function handleBusinessCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (!data.startsWith("biz:")) return false;

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
      "⚠️ This business dashboard belongs to another player. Send /business to open yours!",
      true
    );
    return true;
  }

  try {
    await ensureUserExists(clickerId, cq.from?.first_name);

    if (action === "home") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = await buildBusinessHubView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "shop") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = await buildBusinessShopView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "buy") {
      const res = await purchaseBusinessTx(ownerId, arg, `biz_buy_${cq.id}`);
      if (res.status === "duplicate") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Purchase already processed.");
      } else if (res.status === "not_found") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Business not found.", true);
        return true;
      } else if (res.status === "already_owned_type") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ You already own this business.", true);
        return true;
      } else if (res.status === "slot_limit_reached") {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `⚠️ Slot limit reached (${res.current}/${res.maxAllowed}). Increase net worth to unlock more slots!`,
          true
        );
        return true;
      } else if (res.status === "insufficient_balance") {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `❌ Need ${formatRupees(res.required)} (Wallet: ${formatRupees(res.balance)}).`,
          true
        );
        return true;
      } else {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `✅ Purchased ${res.name}!`,
          true
        );
      }

      const view = await buildBusinessHubView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "collect") {
      const bizId = Number(arg);
      const res = await collectBusinessProfitTx(ownerId, bizId, `biz_col_${cq.id}`);

      if (res.status === "duplicate") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Profit already collected.");
      } else if (res.status === "nothing_to_collect") {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          "⏳ No net profit accrued yet. Check back shortly!",
          true
        );
        return true;
      } else if (res.status === "not_found") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Business not found.", true);
        return true;
      } else {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `💰 Collected ${formatRupees(res.netProfit)} net profit!`,
          true
        );
      }

      const view = await buildBusinessHubView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "upgrade") {
      const bizId = Number(arg);
      const res = await upgradeBusinessTx(ownerId, bizId, `biz_upg_${cq.id}`);

      if (res.status === "duplicate") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Upgrade already applied.");
      } else if (res.status === "max_level") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "🏆 Already at maximum level!", true);
        return true;
      } else if (res.status === "insufficient_balance") {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `❌ Upgrade costs ${formatRupees(res.required)} (Wallet: ${formatRupees(res.balance)}).`,
          true
        );
        return true;
      } else if (res.status === "not_found") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Business not found.", true);
        return true;
      } else {
        const settledNote =
          res.settledPriorNet > 0
            ? ` (+${formatRupees(res.settledPriorNet)} prior profit settled)`
            : "";
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `⬆️ Upgraded ${res.name} to Lv.${res.newLevel}!${settledNote}`,
          true
        );
      }

      const view = await buildBusinessHubView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "detail") {
      const bizId = Number(arg);
      const owned = await getUserBusinesses(ownerId);
      const biz = owned.find((b) => b.id === bizId);
      if (!biz) {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Business not found.", true);
        return true;
      }

      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const now = Math.floor(Date.now() / 1000);
      const acc = calculateBusinessAccrual(biz.catalog, biz.level, biz.last_collected_at, now);

      const text =
        `📊 <b>BUSINESS DETAILS — ${biz.catalog.name.toUpperCase()}</b>\n\n` +
        `Level: <b>${biz.level} / ${biz.catalog.maxLevel}</b>\n` +
        `Daily Gross Rate: <b>${formatRupees(acc.dailyGross)}</b>\n` +
        `Daily Operating Expenses (15%): <b>${formatRupees(acc.dailyExpenses)}</b>\n` +
        `Daily Net Profit: <b>${formatRupees(acc.dailyNet)}</b>\n\n` +
        `Accrued Ready: <b>${formatRupees(acc.accruedNet)}</b> (48h cap)\n` +
        `Lifetime Net Collected: <b>${formatRupees(biz.total_earned)}</b>`;

      const kb = {
        inline_keyboard: [[{ text: "🔙 Back to Businesses", callback_data: `biz:${ownerId}:home` }]],
      };

      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, text, kb);
      }
      return true;
    }

    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid action.", true);
    return true;
  } catch (err: any) {
    console.error("Business callback error:", err?.message || err, err);
    const detail = err?.message ? String(err.message).slice(0, 140) : "Business error.";
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, `⚠️ ${detail}`, true);
    return true;
  }
}

export const businessHandlers: Record<string, CommandHandler> = {
  "/business": async (ctx: BotContext) => {
    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const view = await buildBusinessHubView(ctx.userId);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      view.text,
      view.replyMarkup,
      ctx.message?.message_id
    );
  },
};
