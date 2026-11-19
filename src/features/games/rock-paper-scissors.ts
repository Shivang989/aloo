import { BotContext, CommandHandler } from "../../types/bot";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";

export const rpsHandlers: Record<string, CommandHandler> = {
  "/rps": async (ctx: BotContext) => {
    const playerMove = ctx.args[0]?.toLowerCase();
    const validMoves = ["rock", "paper", "scissors"];

    if (!playerMove || !validMoves.includes(playerMove)) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ <b>Usage:</b> <code>/rps [rock|paper|scissors]</code>"
      );
      return;
    }

    const botMove = validMoves[Math.floor(Math.random() * validMoves.length)];
    let outcome = "TIE";

    if (playerMove === botMove) {
      outcome = "DRAW";
    } else if (
      (playerMove === "rock" && botMove === "scissors") ||
      (playerMove === "paper" && botMove === "rock") ||
      (playerMove === "scissors" && botMove === "paper")
    ) {
      outcome = "WIN";
    } else {
      outcome = "LOSS";
    }

    const card = createStatusCard({
      title: "✂️ ROCK-PAPER-SCISSORS",
      rows: [
        { label: "👤 YOU", value: playerMove.toUpperCase() },
        { label: "🤖 BOT", value: botMove.toUpperCase() },
        { label: "🏆 RESULT", value: outcome },
      ],
      footer:
        outcome === "WIN"
          ? "🎉 Clean read! You dismantled the machine."
          : outcome === "DRAW"
          ? "🤝 Parried! Both chose the exact same move."
          : "💀 Countered! The bot anticipated your strike.",
    });

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
  },
};
