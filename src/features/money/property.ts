import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import { PROPERTY_CATALOG } from "../../settings/economy-config";
import {
  calculatePropertyAccrual,
  calculateUpgradeCost,
  collectAllPropertyRentTx,
  getUserProperties,
  purchasePropertyTx,
  upgradePropertyTx,
} from "../../database/investments-and-bank";
import { ensureUserExists, getUser } from "../../database/users";
import { formatCompactIndianPrice, formatRupees } from "./market-pricing";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
} from "../../telegram/messages";

export async function buildPropertyHubView(
  ownerId: number
): Promise<{ text: string; replyMarkup: { inline_keyboard: any[][] } }> {
  const now = Math.floor(Date.now() / 1000);
  const [user, owned] = await Promise.all([getUser(ownerId), getUserProperties(ownerId)]);
  const wallet = user?.balance ?? 0;

  const keyboard: any[][] = [];

  if (owned.length === 0) {
    const text =
      `🏠 <b>ALOO PROPERTIES</b>\n\n` +
      `Wallet: <b>${formatRupees(wallet)}</b>\n\n` +
      `You do not own any properties yet.\n` +
      `Purchase real estate to earn passive daily rent (48h cap).`;

    keyboard.push([
      { text: "🛒 Browse & Buy Properties", callback_data: `prp:${ownerId}:shop` },
    ]);
    return { text, replyMarkup: { inline_keyboard: keyboard } };
  }

  let totalPendingRent = 0;
  const lines: string[] = [];

  for (const p of owned) {
    const acc = calculatePropertyAccrual(p.catalog, p.level, p.last_rent_collected_at, now);
    totalPendingRent += acc.accruedRent;
    lines.push(
      `${p.catalog.emoji} <b>${p.catalog.name}</b> (Lv.${p.level}/${p.catalog.maxLevel})\n` +
        `Daily rent: <b>${formatRupees(acc.dailyRent)}</b> • Ready: <b>${formatRupees(
          acc.accruedRent
        )}</b>`
    );

    if (p.level < p.catalog.maxLevel) {
      const upCost = calculateUpgradeCost(p.catalog.purchasePrice, p.level);
      keyboard.push([
        {
          text: `⬆️ Upgrade ${p.catalog.name} (${formatCompactIndianPrice(upCost)})`,
          callback_data: `prp:${ownerId}:upgrade:${p.id}`,
        },
      ]);
    }
  }

  keyboard.unshift([
    {
      text: `💰 Collect All Rent (${formatCompactIndianPrice(totalPendingRent)})`,
      callback_data: `prp:${ownerId}:rent`,
    },
  ]);

  keyboard.push([
    { text: "🛒 Property Catalogue", callback_data: `prp:${ownerId}:shop` },
  ]);

  const text =
    `🏠 <b>MY REAL ESTATE PORTFOLIO</b>\n` +
    `Wallet: <b>${formatRupees(wallet)}</b> • Owned: <b>${owned.length}</b>\n\n` +
    `${lines.join("\n\n")}\n\n` +
    `Total Uncollected Rent: <b>${formatRupees(totalPendingRent)}</b>`;

  return { text, replyMarkup: { inline_keyboard: keyboard } };
}

export async function buildPropertyShopView(
  ownerId: number
): Promise<{ text: string; replyMarkup: { inline_keyboard: any[][] } }> {
  const [user, owned] = await Promise.all([getUser(ownerId), getUserProperties(ownerId)]);
  const wallet = user?.balance ?? 0;
  const ownedTypes = new Set(owned.map((o) => o.property_type));

  const lines = PROPERTY_CATALOG.map((item) => {
    const tag = ownedTypes.has(item.id) ? " ✅ Owned" : "";
    return (
      `${item.emoji} <b>${item.name}</b>${tag}\n` +
      `Price: <b>${formatCompactIndianPrice(item.purchasePrice)}</b> • Rent/day: <b>${formatRupees(
        item.dailyBaseRent
      )}</b>`
    );
  });

  const keyboard: any[][] = [];
  for (const item of PROPERTY_CATALOG) {
    if (!ownedTypes.has(item.id)) {
      keyboard.push([
        {
          text: `${item.emoji} Buy ${item.name} • ${formatCompactIndianPrice(item.purchasePrice)}`,
          callback_data: `prp:${ownerId}:buy:${item.id}`,
        },
      ]);
    }
  }
  keyboard.push([{ text: "🔙 Back", callback_data: `prp:${ownerId}:home` }]);

  const text =
    `🏠 <b>PROPERTY CATALOGUE</b>\n\n` +
    `Wallet: <b>${formatRupees(wallet)}</b>\n` +
    `<i>Rent accumulates continuously up to 48 hours.</i>\n\n` +
    `${lines.join("\n\n")}`;

  return { text, replyMarkup: { inline_keyboard: keyboard } };
}

export async function handlePropertyCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (!data.startsWith("prp:")) return false;

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
      "⚠️ This property dashboard belongs to another player. Send /property to open yours!",
      true
    );
    return true;
  }

  try {
    await ensureUserExists(clickerId, cq.from?.first_name);

    if (action === "home") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = await buildPropertyHubView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "shop") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = await buildPropertyShopView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "buy") {
      const res = await purchasePropertyTx(ownerId, arg, `prp_buy_${cq.id}`);
      if (res.status === "duplicate") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Purchase already processed.");
      } else if (res.status === "not_found") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Property not found.", true);
        return true;
      } else if (res.status === "already_owned_type") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ You already own this property.", true);
        return true;
      } else if (res.status === "limit_reached") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Maximum properties owned.", true);
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
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, `✅ Purchased ${res.name}!`, true);
      }

      const view = await buildPropertyHubView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "rent") {
      const res = await collectAllPropertyRentTx(ownerId, `prp_rent_${cq.id}`);
      if (res.status === "duplicate") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Rent already collected.");
      } else if (res.status === "no_properties") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ You don't own any properties yet.", true);
        return true;
      } else if (res.status === "nothing_to_collect") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⏳ No rent accrued yet.", true);
        return true;
      } else {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `💰 Collected ${formatRupees(res.totalRent)} rent!`,
          true
        );
      }

      const view = await buildPropertyHubView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    if (action === "upgrade") {
      const propId = Number(arg);
      const res = await upgradePropertyTx(ownerId, propId, `prp_upg_${cq.id}`);
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
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Property not found.", true);
        return true;
      } else {
        const settledNote =
          res.settledPriorRent > 0
            ? ` (+${formatRupees(res.settledPriorRent)} prior rent settled)`
            : "";
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          `⬆️ Upgraded ${res.name} to Lv.${res.newLevel}!${settledNote}`,
          true
        );
      }

      const view = await buildPropertyHubView(ownerId);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
      }
      return true;
    }

    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid action.", true);
    return true;
  } catch (err: any) {
    console.error("Property callback error:", err?.message || err, err);
    const detail = err?.message ? String(err.message).slice(0, 140) : "Property error.";
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, `⚠️ ${detail}`, true);
    return true;
  }
}

export const propertyHandlers: Record<string, CommandHandler> = {
  "/property": async (ctx: BotContext) => {
    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const view = await buildPropertyHubView(ctx.userId);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      view.text,
      view.replyMarkup,
      ctx.message?.message_id
    );
  },

  "/rent": async (ctx: BotContext) => {
    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const res = await collectAllPropertyRentTx(ctx.userId, `rent_cmd_${ctx.update.update_id}`);

    if (res.status === "duplicate") return;

    if (res.status === "no_properties") {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "🏠 You do not own any properties yet. Open <code>/property</code> to invest.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    if (res.status === "nothing_to_collect") {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⏳ No rent has accrued yet. Check back later or view <code>/property</code>.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      `💰 <b>RENT COLLECTED</b>\n\n` +
        `Properties collected: <b>${res.propertyCount}</b>\n` +
        `Rent received: <b>${formatRupees(res.totalRent)}</b>\n\n` +
        `Wallet: <b>${formatRupees(res.newBalance)}</b>`,
      undefined,
      ctx.message?.message_id
    );
  },
};
