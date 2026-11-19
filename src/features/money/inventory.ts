import { BotContext, CommandHandler } from "../../types/bot";
import { getInventory } from "../../database/inventory";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";

const handleInventory: CommandHandler = async (ctx: BotContext) => {
  const items = await getInventory(ctx.userId);

  if (!items || items.length === 0) {
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      "🎒 <b>Inventory Empty:</b> You have no commodities stashed."
    );
    return;
  }

  const rows = items.slice(0, 6).map((item) => ({
    label: item.item_name.toUpperCase().slice(0, 10),
    value: `x${item.quantity}`,
  }));

  const card = createStatusCard({
    title: "🎒 CONTRABAND STASH",
    rows,
    footer: "💡 Sell items using /sell [item_name]",
  });

  await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
};

export const inventoryHandlers: Record<string, CommandHandler> = {
  "/inv": handleInventory,
  "/inventory": handleInventory,
};
