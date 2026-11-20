import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import { MARKET_ITEMS } from "../../settings/market-items";
import {
  SHOP_CATEGORIES,
  ShopCategoryKey,
  MarketProduct,
  isValidShopCategory,
  getShopItemsByCategory,
  getShopItemById,
  formatRupees,
  formatCompactIndianPrice,
  calculateMarketPrice,
} from "./market-pricing";
import { sendFlowerAnimatedMenu } from "./flower-animation";
import { ensureUserExists, getUser } from "../../database/users";
import { buyMarketItemTx, getInventory, sellInventoryItemTx } from "../../database/inventory";
import { acquireWorkerLease, releaseWorkerLease } from "../../database/cache";
import { createStatusCard } from "../../ui/status-card";
import { escapeHtml } from "../../ui/fancy-text";
import {
  sendMessage,
  sendPhoto,
  editMessageText,
  editMessageCaption,
  editMessageMedia,
  deleteMessage,
  answerCallbackQuery,
} from "../../telegram/messages";

const ITEMS_PER_PAGE = 5;

function getPriceBadge(item: MarketProduct): string {
  const compact = formatCompactIndianPrice(item.price_amount);
  if (item.price_type === "Estimated India Import Price") {
    return `${compact} (Estimated India Import Price)`;
  }
  if (item.price_type === "Discontinued — Historical Price") {
    return `${compact} (Discontinued — Historical Price)`;
  }
  if (item.price_type === "Introductory India Ex-Showroom Price") {
    return `${compact} (Introductory Price)`;
  }
  if (item.price_type === "India Ex-Showroom Starting Price") {
    return `${compact} (Starting)`;
  }
  return compact;
}

export function buildMainMarketView(
  ownerId: number,
  balance: number
): {
  text: string;
  replyMarkup: { inline_keyboard: any[][] };
} {
  const text =
    `        🛍️ <b>ALOO MARKET</b>\n\n` +
    `   Your personal marketplace\n\n` +
    `   Wallet: <b>${formatRupees(balance)}</b>\n\n` +
    `   ━━━━━━━━━━━━━━━━━\n\n` +
    `   Choose a collection to explore.\n\n` +
    `   🚗 <b>Cars</b>       Premium automobiles\n` +
    `   🌸 <b>Flowers</b>    Beautiful flower collection\n` +
    `   🏍️ <b>Bikes</b>      Bikes and motorcycles\n` +
    `   🍔 <b>Food</b>       Food and snacks\n\n` +
    `   ━━━━━━━━━━━━━━━━━`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: SHOP_CATEGORIES.cars.buttonText, callback_data: `mkt:${ownerId}:cat:cars:0` },
        {
          text: SHOP_CATEGORIES.flowers.buttonText,
          callback_data: `mkt:${ownerId}:cat:flowers:0`,
        },
      ],
      [
        { text: SHOP_CATEGORIES.bikes.buttonText, callback_data: `mkt:${ownerId}:cat:bikes:0` },
        { text: SHOP_CATEGORIES.food.buttonText, callback_data: `mkt:${ownerId}:cat:food:0` },
      ],
    ],
  };

  return { text, replyMarkup };
}

export function buildCategoryView(
  ownerId: number,
  category: ShopCategoryKey,
  requestedPage: number = 0,
  balance?: number
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

  const headingTitle =
    category === "cars"
      ? "🚗 <b>CAR COLLECTION</b>"
      : `${meta.emoji} <b>${meta.label.toUpperCase()} COLLECTION</b>`;

  const sortingLine =
    category === "cars" ? `\nSorting: Highest price first` : "";
  const walletLine = balance !== undefined ? `\nWallet: <b>${formatRupees(balance)}</b>` : "";

  const entries = pageItems.map((item) => {
    return `${item.emoji} <b>${escapeHtml(item.name)}</b>\n${getPriceBadge(item)}`;
  });

  const actionPrompt =
    category === "cars"
      ? "Select a vehicle to view its details."
      : "Select an item to view its details.";

  const pageFooter = totalPages > 1 ? ` • Page ${page + 1}/${totalPages}` : "";

  const text =
    `${headingTitle}\n\n` +
    `${meta.subtitle}${walletLine}\n\n` +
    `${allItems.length} ${meta.pluralNoun} available${sortingLine}${pageFooter}\n\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `${entries.join("\n\n")}\n\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `${actionPrompt}`;

  const keyboard: any[][] = pageItems.map((item) => [
    {
      text: `${item.emoji} ${item.name} • ${formatCompactIndianPrice(item.price_amount)}`,
      callback_data: `mkt:${ownerId}:item:${item.id}`,
    },
  ]);

  if (totalPages > 1) {
    const navRow: any[] = [];
    if (page > 0) {
      navRow.push({
        text: "⬅️ Prev",
        callback_data: `mkt:${ownerId}:cat:${category}:${page - 1}`,
      });
    }
    if (page < totalPages - 1) {
      navRow.push({
        text: "Next ➡️",
        callback_data: `mkt:${ownerId}:cat:${category}:${page + 1}`,
      });
    }
    if (navRow.length > 0) {
      keyboard.push(navRow);
    }
  }

  keyboard.push([{ text: "🔙 Back", callback_data: `mkt:${ownerId}:main` }]);

  return {
    text,
    replyMarkup: { inline_keyboard: keyboard },
  };
}

export function buildProductDetailView(
  ownerId: number,
  item: MarketProduct,
  buyerBalance: number
): {
  text: string;
  replyMarkup: { inline_keyboard: any[][] };
} {
  const meta = SHOP_CATEGORIES[item.category];
  const allItems = getShopItemsByCategory(item.category);
  const idx = allItems.findIndex((x) => x.id === item.id);
  const page = idx >= 0 ? Math.floor(idx / ITEMS_PER_PAGE) : 0;

  const specs = item.technical_specs;
  const specLines: string[] = [
    `Manufacturer: ${escapeHtml(item.brand)}`,
    `Model: ${escapeHtml(item.model)}`,
    `Variant: ${escapeHtml(item.variant)}`,
  ];

  if (specs.vehicle_type) specLines.push(`Type: ${escapeHtml(specs.vehicle_type)}`);
  if (specs.engine) specLines.push(`Engine: ${escapeHtml(specs.engine)}`);
  if (specs.fuel_type) specLines.push(`Fuel: ${escapeHtml(specs.fuel_type)}`);
  if (specs.transmission) specLines.push(`Transmission: ${escapeHtml(specs.transmission)}`);
  if (specs.drivetrain) specLines.push(`Drivetrain: ${escapeHtml(specs.drivetrain)}`);
  if (specs.power) specLines.push(`Power: ${escapeHtml(specs.power)}`);
  if (specs.torque) specLines.push(`Torque: ${escapeHtml(specs.torque)}`);

  const exactRupees = formatRupees(item.price_amount);
  const compactPrice = formatCompactIndianPrice(item.price_amount);
  const formattedPriceLine =
    item.price_amount >= 100_000 ? `${exactRupees} (${compactPrice})` : exactRupees;

  const statusLine =
    item.availability_status !== "Available"
      ? `\nStatus: <b>${escapeHtml(item.availability_status)}</b>`
      : "";
  const noteLine = specs.origin_or_note ? `\nNote: <i>${escapeHtml(specs.origin_or_note)}</i>` : "";

  const sectionHeader = item.category === "cars" ? "MODEL DETAILS" : "PRODUCT DETAILS";

  const text =
    `${item.emoji} <b>${escapeHtml(item.name)}</b>\n\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `<b>${sectionHeader}</b>\n\n` +
    `${specLines.join("\n")}\n\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `<b>PRICE INFORMATION</b>\n\n` +
    `${escapeHtml(item.price_type)}:\n` +
    `<b>${formattedPriceLine}</b>${statusLine}${noteLine}\n` +
    `Your Wallet: <b>${formatRupees(buyerBalance)}</b>\n\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `${escapeHtml(item.description)}\n\n` +
    `Select an action below.`;

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: `🛒 Buy • ${compactPrice}`,
          callback_data: `mkt:${ownerId}:confirm:${item.id}`,
        },
      ],
      [
        {
          text: `🔙 Back to ${meta.label}`,
          callback_data: `mkt:${ownerId}:cat:${item.category}:${page}`,
        },
        { text: "🛍️ Market", callback_data: `mkt:${ownerId}:main` },
      ],
    ],
  };

  return { text, replyMarkup };
}

export function buildPurchaseConfirmationView(
  ownerId: number,
  item: MarketProduct,
  buyerBalance: number
): {
  text: string;
  replyMarkup: { inline_keyboard: any[][] };
} {
  const afterBalance = buyerBalance - item.price_amount;
  const afterLine =
    afterBalance >= 0
      ? `After purchase: <b>${formatRupees(afterBalance)}</b>`
      : `Shortfall: <b>${formatRupees(Math.abs(afterBalance))}</b> (Insufficient balance)`;

  const subjectNoun = item.category === "cars" ? "this vehicle" : "this item";
  const categoryLabel =
    item.technical_specs.vehicle_type || SHOP_CATEGORIES[item.category].label;

  const text =
    `🛒 <b>PURCHASE CONFIRMATION</b>\n\n` +
    `${item.emoji} <b>${escapeHtml(item.name)}</b>\n\n` +
    `Variant: ${escapeHtml(item.variant)}\n` +
    `Category: ${escapeHtml(categoryLabel)}\n\n` +
    `Price: <b>${formatRupees(item.price_amount)}</b>\n\n` +
    `Your balance: <b>${formatRupees(buyerBalance)}</b>\n` +
    `${afterLine}\n\n` +
    `Are you sure you want to purchase ${subjectNoun}?`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "✅ Confirm Purchase", callback_data: `mkt:${ownerId}:buy:${item.id}` },
        { text: "❌ Cancel", callback_data: `mkt:${ownerId}:item:${item.id}` },
      ],
    ],
  };

  return { text, replyMarkup };
}

function getMessageMediaKind(message: any): "none" | "animation" | "photo" {
  if (!message) return "none";
  if (message.animation) return "animation";
  if (message.photo && message.photo.length > 0) return "photo";
  if (message.video || message.document) return "photo";
  return "none";
}

async function renderMarketScreen(
  botToken: string,
  chatId: number,
  message: any,
  text: string,
  replyMarkup: { inline_keyboard: any[][] },
  options: {
    flowerAnimation?: boolean;
    productPhotoUrl?: string;
  } = {}
): Promise<void> {
  const messageId: number | undefined = message?.message_id;
  const currentMedia = getMessageMediaKind(message);

  // Case 1: Flowers collection prefers animated bloom GIF
  if (options.flowerAnimation) {
    if (currentMedia === "animation" && messageId) {
      const res = await editMessageCaption(botToken, chatId, messageId, text, replyMarkup);
      if (res.ok) return;
    }

    const sentAnim = await sendFlowerAnimatedMenu(botToken, chatId, text, replyMarkup);
    if (sentAnim) {
      if (messageId) {
        await deleteMessage(botToken, chatId, messageId);
      }
      return;
    }
  }

  // Case 2: Product Detail Page with high-res model image
  if (options.productPhotoUrl) {
    if (currentMedia === "photo" && messageId) {
      const mediaRes = await editMessageMedia(
        botToken,
        chatId,
        messageId,
        {
          type: "photo",
          media: options.productPhotoUrl,
          caption: text,
        },
        replyMarkup
      );
      if (mediaRes.ok) return;
    }

    const photoRes = await sendPhoto(
      botToken,
      chatId,
      options.productPhotoUrl,
      text,
      replyMarkup
    );
    if (photoRes.ok) {
      if (messageId) {
        await deleteMessage(botToken, chatId, messageId);
      }
      return;
    }
    // Graceful fallback to text-only view if Telegram cannot fetch external photo URL
  }

  // Case 3: Standard text-based screen (Dashboard, Cars/Bikes/Food list, Confirmation, Receipt)
  if (currentMedia !== "none") {
    await sendMessage(botToken, chatId, text, replyMarkup);
    if (messageId) {
      await deleteMessage(botToken, chatId, messageId);
    }
    return;
  }

  if (messageId) {
    const editRes = await editMessageText(botToken, chatId, messageId, text, replyMarkup);
    if (editRes.ok) return;
  }

  await sendMessage(botToken, chatId, text, replyMarkup);
}

export async function handleMarketCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (!data.startsWith("mkt:")) return false;

  const clickerId = cq.from?.id;
  const chatId = cq.message?.chat?.id;
  if (!clickerId || !chatId) return false;

  const parts = data.split(":");
  const ownerId = Number(parts[1]);
  const action = parts[2];

  if (!Number.isInteger(ownerId) || ownerId <= 0 || !action) {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Expired or invalid market menu.", true);
    return true;
  }

  // User-specific session guard: prevent other group members from hijacking this menu
  if (clickerId !== ownerId) {
    await answerCallbackQuery(
      env.BOT_TOKEN,
      cq.id,
      "⚠️ This market menu belongs to another player. Send /market to open your own!",
      true
    );
    return true;
  }

  try {
    // 1. Main Market Dashboard
    if (action === "main") {
      await ensureUserExists(clickerId, cq.from?.first_name);
      const user = await getUser(clickerId);
      const balance = user?.balance ?? 0;

      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = buildMainMarketView(ownerId, balance);
      await renderMarketScreen(env.BOT_TOKEN, chatId, cq.message, view.text, view.replyMarkup);
      return true;
    }

    // 2. Category Page (Cars, Flowers, Bikes, Food)
    if (action === "cat") {
      const rawCat = (parts[3] || "").toLowerCase();
      if (!isValidShopCategory(rawCat)) {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid or expired category.", true);
        return true;
      }

      const parsedPage = parts[4] !== undefined ? parseInt(parts[4], 10) : 0;
      const page = Number.isInteger(parsedPage) && parsedPage >= 0 ? parsedPage : 0;

      await ensureUserExists(clickerId, cq.from?.first_name);
      const user = await getUser(clickerId);
      const balance = user?.balance ?? 0;

      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = buildCategoryView(ownerId, rawCat, page, balance);
      await renderMarketScreen(env.BOT_TOKEN, chatId, cq.message, view.text, view.replyMarkup, {
        flowerAnimation: rawCat === "flowers",
      });
      return true;
    }

    // 3. Detailed Product Page
    if (action === "item") {
      const itemId = (parts[3] || "").toLowerCase();
      const item = getShopItemById(itemId);
      if (!item) {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Product not found.", true);
        return true;
      }

      await ensureUserExists(clickerId, cq.from?.first_name);
      const user = await getUser(clickerId);
      const balance = user?.balance ?? 0;

      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = buildProductDetailView(ownerId, item, balance);
      await renderMarketScreen(env.BOT_TOKEN, chatId, cq.message, view.text, view.replyMarkup, {
        productPhotoUrl: item.image_reference,
      });
      return true;
    }

    // 4. Purchase Confirmation Screen (no money deducted yet)
    if (action === "confirm") {
      const itemId = (parts[3] || "").toLowerCase();
      const item = getShopItemById(itemId);
      if (!item) {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Product not found.", true);
        return true;
      }

      await ensureUserExists(clickerId, cq.from?.first_name);
      const user = await getUser(clickerId);
      const balance = user?.balance ?? 0;

      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const view = buildPurchaseConfirmationView(ownerId, item, balance);
      await renderMarketScreen(env.BOT_TOKEN, chatId, cq.message, view.text, view.replyMarkup);
      return true;
    }

    // 5. Execute Atomic Purchase & Show Receipt
    if (action === "buy") {
      const itemId = (parts[3] || "").toLowerCase();
      const item = getShopItemById(itemId);
      if (!item) {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid or expired button.", true);
        return true;
      }

      const clickGuardKey = `mkt:buy_guard:${clickerId}:${item.id}`;
      const acquired = await acquireWorkerLease(clickGuardKey, cq.id, 3);
      if (!acquired) {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⏳ Processing your purchase...");
        return true;
      }

      let txRes: Awaited<ReturnType<typeof buyMarketItemTx>>;
      try {
        await ensureUserExists(clickerId, cq.from?.first_name);
        txRes = await buyMarketItemTx(
          clickerId,
          item.id,
          item.price_amount,
          `mkt_cq_${cq.id}`
        );
      } finally {
        await releaseWorkerLease(clickGuardKey, cq.id);
      }

      if (txRes.status === "duplicate") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Purchase already processed.");
        return true;
      }

      if (txRes.status === "insufficient_balance") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "❌ Insufficient balance.", true);
        const failText =
          `❌ <b>INSUFFICIENT BALANCE</b>\n\n` +
          `Item: ${item.emoji} <b>${escapeHtml(item.name)}</b>\n` +
          `Required: <b>${formatRupees(item.price_amount)}</b>\n` +
          `Your balance: <b>${formatRupees(txRes.balance)}</b>\n\n` +
          `Earn more money and try again.`;

        const failMarkup = {
          inline_keyboard: [
            [
              { text: "🔙 Back to Item", callback_data: `mkt:${ownerId}:item:${item.id}` },
              { text: "🛍️ Back to Market", callback_data: `mkt:${ownerId}:main` },
            ],
          ],
        };

        await renderMarketScreen(env.BOT_TOKEN, chatId, cq.message, failText, failMarkup);
        return true;
      }

      await answerCallbackQuery(env.BOT_TOKEN, cq.id, `✅ Purchased ${item.name}!`);
      const addedLine =
        item.category === "cars"
          ? "The vehicle has been added to your inventory."
          : "The item has been added to your inventory.";

      const receiptText =
        `✅ <b>PURCHASE SUCCESSFUL</b>\n\n` +
        `You purchased:\n\n` +
        `${item.emoji} <b>${escapeHtml(item.name)}</b>\n\n` +
        `Amount paid: <b>${formatRupees(item.price_amount)}</b>\n\n` +
        `Remaining balance: <b>${formatRupees(txRes.newBalance)}</b>\n\n` +
        `${addedLine}`;

      const receiptMarkup = {
        inline_keyboard: [
          [
            { text: "🎒 My Inventory", callback_data: `mkt:${ownerId}:inv` },
            { text: "🛍️ Back to Market", callback_data: `mkt:${ownerId}:main` },
          ],
        ],
      };

      await renderMarketScreen(env.BOT_TOKEN, chatId, cq.message, receiptText, receiptMarkup);
      return true;
    }

    // 6. Inline My Inventory View from Receipt
    if (action === "inv") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      const items = await getInventory(clickerId);

      let invText: string;
      if (!items || items.length === 0) {
        invText = `🎒 <b>MY INVENTORY</b>\n\nYour inventory is currently empty.`;
      } else {
        const lines = items.slice(0, 15).map((entry) => {
          const shopItem = getShopItemById(entry.item_name);
          if (shopItem) {
            return `${shopItem.emoji} <b>${escapeHtml(shopItem.name)}</b> — x${entry.quantity}`;
          }
          const legacyItem = MARKET_ITEMS[entry.item_name.toLowerCase()];
          if (legacyItem) {
            return `${legacyItem.emoji ?? "📦"} <b>${escapeHtml(legacyItem.name)}</b> — x${
              entry.quantity
            }`;
          }
          return `📦 <b>${escapeHtml(entry.item_name)}</b> — x${entry.quantity}`;
        });
        invText =
          `🎒 <b>MY INVENTORY</b>\n\n` +
          `${lines.join("\n")}\n\n` +
          `<i>Use /inv anytime or /gift &lt;item&gt; by replying to a friend.</i>`;
      }

      const invMarkup = {
        inline_keyboard: [[{ text: "🛍️ Back to Market", callback_data: `mkt:${ownerId}:main` }]],
      };

      await renderMarketScreen(env.BOT_TOKEN, chatId, cq.message, invText, invMarkup);
      return true;
    }

    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid or expired market button.", true);
    return true;
  } catch (err: any) {
    console.error("Market callback error:", err);
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Market error. Please try again.", true);
    return true;
  }
}

export const marketHandlers: Record<string, CommandHandler> = {
  "/market": async (ctx: BotContext) => {
    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const user = await getUser(ctx.userId);
    const balance = user?.balance ?? 0;

    const view = buildMainMarketView(ctx.userId, balance);
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
      : Math.max(1, Math.floor((shopItem?.price_amount ?? 0) * 0.5));
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
