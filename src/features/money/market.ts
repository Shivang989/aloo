import { BotContext, CommandHandler } from "../../types/bot";
import { MARKET_ITEMS } from "../../settings/market-items";
import { calculateMarketPrice } from "./market-pricing";
import { sellInventoryItemTx } from "../../database/inventory";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";

export const marketHandlers: Record<string, CommandHandler> = {
  "/market": async (ctx: BotContext) => {
    const currentTime = Math.floor(Date.now() / 1000);
    const marketEntries = Object.entries(MARKET_ITEMS);

    const rows = marketEntries.slice(0, 6).map(([, item]) => {
      const currentPrice = calculateMarketPrice(
        item.base_price,
        item.volatility ?? 0,
        currentTime
      );
      return {
        label: `${item.emoji ?? "📦"} ${item.name}`.slice(0, 10),
        value: `₹${currentPrice}`,
      };
    });

    const card = createStatusCard({
      title: "📊 BLACK MARKET COMMODITIES",
      rows,
      footer: "📈 Prices fluctuate dynamically with global volatility.",
    });

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
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

    const marketItem = MARKET_ITEMS[rawItem];
    if (!marketItem) {
      await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, "❌ Item not traded on the black market.");
      return;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const sellPrice = calculateMarketPrice(
      marketItem.base_price,
      marketItem.volatility ?? 0,
      currentTime
    );

    const res = await sellInventoryItemTx(ctx.userId, rawItem, sellPrice);

    if (res.status === "user_not_found") return;
    if (res.status === "item_not_owned") {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `❌ You don't own any <b>${marketItem.name}</b>.`
      );
      return;
    }

    const card = createStatusCard({
      title: "💰 ASSET LIQUIDATED",
      rows: [
        { label: "📦 ITEM", value: marketItem.name },
        { label: "💰 SOLD FOR", value: `₹${sellPrice}` },
        { label: "💼 NEW BALANCE", value: `₹${res.newBalance}` },
      ],
      footer: "⚡ Transaction settled. Cash transferred to vault.",
    });

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
  },
};
