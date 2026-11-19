import { BotContext, CommandHandler } from "../../types/bot";
import { revivePlayerTx } from "../../database/users";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";

export const reviveHandlers: Record<string, CommandHandler> = {
  "/revive": async (ctx: BotContext) => {
    const REVIVE_COST = 100;
    const res = await revivePlayerTx(ctx.userId, REVIVE_COST);

    if (res.status === "not_found") return;

    if (res.status === "already_alive") {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "🟢 You are already operational and combat-ready."
      );
      return;
    }

    if (res.status === "insufficient_balance") {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `❌ Field revive requires <b>₹${REVIVE_COST}</b>. Acquire funds or request a teammate to transfer via /pay.`
      );
      return;
    }

    const card = createStatusCard({
      title: "❤️ OPERATIVE REVIVED",
      rows: [
        { label: "👤 OPERATIVE", value: ctx.message.from?.first_name || "Player" },
        { label: "❤️ STATUS", value: "ALIVE" },
        { label: "💰 COST", value: `₹${REVIVE_COST}` },
        { label: "💼 BALANCE", value: `₹${res.newBalance}` },
      ],
      footer: "⚡ Vital signs restored. You are back in the fray.",
    });

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
  },
};
