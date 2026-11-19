import { BotContext, CommandHandler } from "../../types/bot";
import { deployShieldTx } from "../../database/users";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";

const handleDefend: CommandHandler = async (ctx: BotContext) => {
  const SHIELD_COST = 200;
  const SHIELD_DURATION_SEC = 300;

  const res = await deployShieldTx(ctx.userId, SHIELD_COST, SHIELD_DURATION_SEC);

  if (res.status === "not_found") return;

  if (res.status === "dead") {
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      "💀 You are eliminated. Revive first using <code>/revive</code>."
    );
    return;
  }

  if (res.status === "insufficient_balance") {
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      `❌ Insufficient cash. Shield deployment costs <b>₹${SHIELD_COST}</b>.`
    );
    return;
  }

  const card = createStatusCard({
    title: "🛡️ SHIELD DEPLOYED",
    rows: [
      { label: "👤 OPERATIVE", value: ctx.message.from?.first_name || "Player" },
      { label: "💰 COST", value: `₹${SHIELD_COST}` },
      { label: "⏳ DURATION", value: "5 Minutes" },
      { label: "💼 BALANCE", value: `₹${res.newBalance}` },
    ],
    footer: "🟢 Active barrier prevents incoming strikes for 300 seconds.",
  });

  await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
};

export const defenseHandlers: Record<string, CommandHandler> = {
  "/defend": handleDefend,
  "/shield": handleDefend,
};
