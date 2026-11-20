import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import { MARKET_ITEMS } from "../../settings/market-items";
import {
  SHOP_CATEGORIES,
  ShopCategoryKey,
  isValidShopCategory,
  getShopItemsByCategory,
  getShopItemById,
  formatRupees,
  calculateMarketPrice,
} from "./market-pricing";
import { sendFlowerAnimatedMenu } from "./flower-animation";
import { ensureUserExists, getUser } from "../../database/users";
import { buyMarketItemTx, sellInventoryItemTx } from "../../database/inventory";
import { acquireWorkerLease } from "../../database/cache";
import { createStatusCard } from "../../ui/status-card";
import { escapeHtml } from "../../ui/fancy-text";
import {
  sendMessage,
  editMessageText,
  editMessageCaption,
  deleteMessage,
  answerCallbackQuery,
} from "../../telegram/messages";

const ITEMS_PER_PAGE = 5;

export function buildMainMarketView(): {
  text: string;
  replyMarkup: { inline_keyboard: any[][] };
} {
  const text =
    `🛒 <b>ALOO MARKET</b>\n\n` +
    `Select a category to explore and purchase items.`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: SHOP_CATEGORIES.cars.buttonText, callback_data: "mkt:cat:cars:0" },
        { text: SHOP_CATEGORIES.flowers.buttonText, callback_data: "mkt:cat:flowers:0" },
      ],
      [
        { text: SHOP_CATEGORIES.bikes.buttonText, callback_data: "mkt:cat:bikes:0" },
        { text: SHOP_CATEGORIES.food.buttonText, callback_data: "mkt:cat:food:0" },
      ],
    ],
  };

  return { text, replyMarkup };
}

export function buildCategoryView(
  category: ShopCategoryKey,
  requestedPage: number = 0
): {
  text: string;
  replyMarkup: { inline_keyboard: any[][] };
} {
  const meta = SHOP_CATEGORIES[category];
  const allItems = getShopItemsByCategory(category);
  const totalPages = Math.max(1, Math.ceil(allItems.length / ITEMS_PER_PAGE));
  const page = Math.min(Math.max(0, requestedPage), totalPages - 1);

  const startIdx = page * ITEMS_PER_PAGE;
  const pageItems = allItems.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const lines = pageItems.map(
    (item, idx) =>
      `${startIdx + idx + 1}. ${item.emoji} <b>${escapeHtml(item.name)}</b> — ${formatRupees(
        item.price
      )}`
  );

  const pageFooter = totalPages > 1 ? `\n\n<i>Page ${page + 1} of ${totalPages}</i>` : "";
  const text =
    `${meta.emoji} <b>ALOO MARKET — ${meta.label.toUpperCase()}</b>\n\n` +
    `Select an item to view details and purchase:\n\n` +
    `${lines.join("\n")}${pageFooter}`;

  const keyboard: any[][] = pageItems.map((item) => [
    {
      text: `${item.emoji} ${item.name} • ${formatRupees(item.price)}`,
      callback_data: `mkt:item:${item.id}`,
    },
  ]);

  if (totalPages > 1) {
    const navRow: any[] = [];
    if (page > 0) {
      navRow.push({ text: "⬅️ Prev", callback_data: `mkt:cat:${category}:${page - 1}` });
    }
    if (page < totalPages - 1) {
      navRow.push({ text: "Next ➡️", callback_data: `mkt:cat:${category}:${page + 1}` });
    }
    if (navRow.length > 0) {
      keyboard.push(navRow);
    }
  }

  keyboard.push([{ text: "🔙 Back", callback_data: "mkt:main" }]);

  return {
    text,
    replyMarkup: { inline_keyboard: keyboard },
  };
}

export function buildItemDetailView(
  itemId: string,
  buyerBalance: number
): {
  text: string;
  replyMarkup: { inline_keyboard: any[][] };
} | null {
  const item = getShopItemById(itemId);
  if (!item) return null;

  const meta = SHOP_CATEGORIES[item.category];
  const allItems = getShopItemsByCategory(item.category);
  const idx = allItems.findIndex((x) => x.id === item.id);
  const page = idx >= 0 ? Math.floor(idx / ITEMS_PER_PAGE) : 0;

  const text =
    `${item.emoji} <b>${escapeHtml(item.name)}</b>\n\n` +
    `• <b>Category:</b> ${meta.emoji} ${meta.label}\n` +
    `• <b>Price:</b> ${formatRupees(item.price)}\n` +
    `• <b>Your Balance:</b> ${formatRupees(buyerBalance)}\n\n` +
    `Tap below to confirm your purchase:`;

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: `✅ Buy ${item.name} (${formatRupees(item.price)})`,
          callback_data: `mkt:buy:${item.id}`,
        },
      ],
      [
        { text: `🔙 Back to ${meta.label}`, callback_data: `mkt:cat:${item.category}:${page}` },
        { text: "🛒 Market", callback_data: "mkt:main" },
      ],
    ],
  };

  return { text, replyMarkup };
}

function hasMediaAttachment(message: any): boolean {
  return Boolean(message?.animation || message?.video || message?.photo || message?.document);
}

async function renderUpdatedMenuMessage(
  botToken: string,
  chatId: number,
  message: any,
  text: string,
  replyMarkup: { inline_keyboard: any[][] },
  preferFlowerAnimation: boolean = false
): Promise<void> {
  const messageId: number | undefined = message?.message_id;
  const isMedia = hasMediaAttachment(message);

  if (preferFlowerAnimation && !isMedia) {
    const sentAnim = await sendFlowerAnimatedMenu(botToken, chatId, text, replyMarkup);
    if (sentAnim) {
      if (messageId) {
        await deleteMessage(botToken, chatId, messageId);
      }
      return;
    }
  }

  if (!preferFlowerAnimation && isMedia) {
    await sendMessage(botToken, chatId, text, replyMarkup);
    if (messageId) {
      await deleteMessage(botToken, chatId, messageId);
    }
    return;
  }

  if (messageId) {
    if (isMedia) {
      const capRes = await editMessageCaption(botToken, chatId, messageId, text, replyMarkup);
      if (capRes.ok) return;
    } else {
      const txtRes = await editMessageText(botToken, chatId, messageId, text, replyMarkup);
      if (txtRes.ok) return;
    }
  }

  await sendMessage(botToken, chatId, text, replyMarkup);
}

export async function handleMarketCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (!data.startsWith("mkt:")) return false;

  const userId = cq.from?.id;
  const chatId = cq.message?.chat?.id;
  if (!userId || !chatId) return false;

  const parts = data.split(":");
  const action = parts[1];

  try {
    // 1. Return to main 4-category market menu
    if (action === "main") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = buildMainMarketView();
      await renderUpdatedMenuMessage(
        env.BOT_TOKEN,
        chatId,
        cq.message,
        view.text,
        view.replyMarkup,
        false
      );
      return true;
    }

    // 2. Open category item list (with pagination)
    if (action === "cat") {
      const rawCat = (parts[2] || "").toLowerCase();
      if (!isValidShopCategory(rawCat)) {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid or expired category.", true);
        return true;
      }

      const parsedPage = parts[3] !== undefined ? parseInt(parts[3], 10) : 0;
      const page = Number.isInteger(parsedPage) && parsedPage >= 0 ? parsedPage : 0;

      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = buildCategoryView(rawCat, page);
      await renderUpdatedMenuMessage(
        env.BOT_TOKEN,
        chatId,
        cq.message,
        view.text,
        view.replyMarkup,
        rawCat === "flowers"
      );
      return true;
    }

    // 3. Select item to view details & confirm purchase
    if (action === "item") {
      const itemId = (parts[2] || "").toLowerCase();
      const item = getShopItemById(itemId);
      if (!item) {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ This item is no longer available.", true);
        return true;
      }

      await ensureUserExists(userId, cq.from?.first_name);
      const buyer = await getUser(userId);
      const balance = buyer?.balance ?? 0;

      const view = buildItemDetailView(item.id, balance);
      if (!view) {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Item unavailable.", true);
        return true;
      }

      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      await renderUpdatedMenuMessage(
        env.BOT_TOKEN,
        chatId,
        cq.message,
        view.text,
        view.replyMarkup,
        item.category === "flowers"
      );
      return true;
    }

    // 4. Execute atomic item purchase for the user who clicked
    if (action === "buy") {
      const itemId = (parts[2] || "").toLowerCase();
      const item = getShopItemById(itemId);
      if (!item) {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid or expired market button.", true);
        return true;
      }

      // Guard against rapid accidental double-clicks by the same user on the same item
      const clickGuardKey = `mkt:buy_guard:${userId}:${item.id}`;
      const acquired = await acquireWorkerLease(clickGuardKey, cq.id, 3);
      if (!acquired) {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⏳ Processing your purchase...", false);
        return true;
      }

      await ensureUserExists(userId, cq.from?.first_name);
      const txRes = await buyMarketItemTx(userId, item.id, item.price, `mkt_cq_${cq.id}`);

      if (txRes.status === "duplicate") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Purchase already processed.");
        return true;
      }

      const buyerName = escapeHtml(cq.from?.first_name || "Player");
      const buyerMention = `<a href="tg://user?id=${userId}">${buyerName}</a>`;

      if (txRes.status === "insufficient_balance") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "❌ Insufficient balance.", true);
        const failText =
          `❌ <b>Insufficient Balance</b>\n\n` +
          `Buyer: ${buyerMention}\n` +
          `Item: ${item.emoji} <b>${escapeHtml(item.name)}</b>\n` +
          `Required: ${formatRupees(item.price)}\n` +
          `Your Balance: ${formatRupees(txRes.balance)}`;

        await sendMessage(env.BOT_TOKEN, chatId, failText);
        return true;
      }

      await answerCallbackQuery(env.BOT_TOKEN, cq.id, `✅ Purchased ${item.name}!`);
      const successText =
        `✅ <b>Purchase Successful!</b>\n\n` +
        `Buyer: ${buyerMention}\n` +
        `Item: ${item.emoji} <b>${escapeHtml(item.name)}</b> (Owned: x${txRes.newQuantity})\n` +
        `Paid: ${formatRupees(item.price)}\n` +
        `Remaining Balance: ${formatRupees(txRes.newBalance)}`;

      await sendMessage(env.BOT_TOKEN, chatId, successText);
      return true;
    }

    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid or expired market action.", true);
    return true;
  } catch (err: any) {
    console.error("Market callback error:", err);
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Market error. Please try again.", true);
    return true;
  }
}

export const marketHandlers: Record<string, CommandHandler> = {
  "/market": async (ctx: BotContext) => {
    const view = buildMainMarketView();
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      view.text,
      view.replyMarkup,
      ctx.message?.message_id
    );
  },

  "/sell": async (ctx: BotContext) => {
    const rawItem = ctx.args.join("_").toLowerCase().trim();
    if (!rawItem) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ <b>Usage:</b> <code>/sell [item_name]</code> (e.g., /sell cheap_watch)"
      );
      return;
    }

    const legacyItem = MARKET_ITEMS[rawItem];
    const shopItem = getShopItemById(rawItem);

    if (!legacyItem && !shopItem) {
      await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, "❌ Item not traded on the market.");
      return;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const sellPrice = legacyItem
      ? calculateMarketPrice(legacyItem.base_price, legacyItem.volatility ?? 0, currentTime)
      : Math.max(1, Math.floor((shopItem?.price ?? 0) * 0.5));
    const displayName = legacyItem ? legacyItem.name : shopItem!.name;

    const res = await sellInventoryItemTx(ctx.userId, rawItem, sellPrice);

    if (res.status === "user_not_found") return;
    if (res.status === "item_not_owned") {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `❌ You don't own any <b>${escapeHtml(displayName)}</b>.`
      );
      return;
    }

    const card = createStatusCard({
      title: "💰 ASSET LIQUIDATED",
      rows: [
        { label: "📦 ITEM", value: displayName },
        { label: "💰 SOLD FOR", value: `₹${sellPrice}` },
        { label: "💼 NEW BALANCE", value: `₹${res.newBalance}` },
      ],
      footer: "⚡ Transaction settled. Cash transferred to vault.",
    });

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
  },
};
