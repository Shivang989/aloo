import { BotContext, CommandHandler } from "../../types/bot";
import { getUser, updateBalance } from "../../database/users";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";

export const diceHandlers: Record<string, CommandHandler> = {
  "/dice": async (ctx: BotContext) => {
    const user = await getUser(ctx.userId);
    if (!user) return;

    const playerRoll = Math.floor(Math.random() * 6) + 1;
    const botRoll = Math.floor(Math.random() * 6) + 1;

    let result = "TIE";
    let footer = "🤝 Dead heat! Nobody takes the pot.";
    let newBalance = user.balance;

    if (playerRoll > botRoll) {
      result = "VICTORY";
      const prize = 50;
      newBalance = user.balance + prize;
      await updateBalance(ctx.userId, newBalance);
      footer = `🎉 You won! +₹${prize} credited to your balance.`;
    } else if (playerRoll < botRoll) {
      result = "DEFEAT";
      footer = "💀 The house wins this round. Better luck next time!";
    }

    const card = createStatusCard({
      title: "🎲 DICE SHOWDOWN",
      rows: [
        { label: "👤 PLAYER", value: `${ctx.message.from?.first_name || "Player"} [${playerRoll}]` },
        { label: "🤖 DEALER", value: `Supreme AI [${botRoll}]` },
        { label: "🏆 RESULT", value: result },
        { label: "💼 BALANCE", value: `₹${newBalance}` },
      ],
      footer,
    });

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
  },
};
