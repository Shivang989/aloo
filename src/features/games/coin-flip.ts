import { BotContext, CommandHandler } from "../../types/bot";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";

export const coinFlipHandlers: Record<string, CommandHandler> = {
  "/flip": async (ctx: BotContext) => {
    const guess = ctx.args[0]?.toLowerCase();
    const outcomes = ["heads", "tails"];
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];

    if (!guess || !outcomes.includes(guess)) {
      const card = createStatusCard({
        title: "🪙 COIN TOSS",
        rows: [
          { label: "👤 FLIPPER", value: ctx.message.from?.first_name || "Player" },
          { label: "🪙 RESULT", value: outcome.toUpperCase() },
        ],
        footer: "💡 HINT • Guess the outcome: /flip heads or /flip tails",
      });
      await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
      return;
    }

    const won = guess === outcome;
    const card = createStatusCard({
      title: "🪙 COIN TOSS CALL",
      rows: [
        { label: "👤 CALL", value: guess.toUpperCase() },
        { label: "🪙 RESULT", value: outcome.toUpperCase() },
        { label: "🎯 VERDICT", value: won ? "MATCH" : "MISMATCH" },
      ],
      footer: won ? "🎉 Sharp call! You called it right." : "❌ Bad call! Gravity had other plans.",
    });

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
  },
};
