import { BotContext, CommandHandler } from "../../types/bot";
import { getInventory } from "../../database/inventory";
import { MARKET_ITEMS } from "../../settings/market-items";
import { getShopItemById } from "./market-pricing";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";

function formatInventoryLabel(rawItemName: string): string {
  const shopItem = getShopItemById(rawItemName);
  if (shopItem) {
    return `${shopItem.emoji} ${shopItem.name.toUpperCase()}`;
  }

  const legacyItem = MARKET_ITEMS[rawItemName.toLowerCase()];
  if (legacyItem) {
    return `${legacyItem.emoji ?? "📦"} ${legacyItem.name.toUpperCase()}`;
  }

  return rawItemName.replace(/_/g, " ").toUpperCase();
}

const handleInventory: CommandHandler = async (ctx: BotContext) => {
  const items = await getInventory(ctx.userId);

  if (!items || items.length === 0) {
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      "🎒 <b>Inventory Empty:</b> You have no items stashed."
    );
    return;
  }

  const rows = items.slice(0, 15).map((item) => ({
    label: formatInventoryLabel(item.item_name),
    value: `x${item.quantity}`,
  }));

  const card = createStatusCard({
    title: "🎒 INVENTORY STASH",
    rows,
    footer:
      items.length > 15
        ? `Showing 15 of ${items.length} item types • Sell via /sell [item_name]`
        : "💡 Buy items in /market or sell via /sell [item_name]",
  });

  await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
};

export const inventoryHandlers: Record<string, CommandHandler> = {
  "/inv": handleInventory,
  "/inventory": handleInventory,
};
