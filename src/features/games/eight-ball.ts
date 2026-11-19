import { BotContext, CommandHandler } from "../../types/bot";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";

export const eightBallHandlers: Record<string, CommandHandler> = {
  "/8ball": async (ctx: BotContext) => {
    const question = ctx.args.join(" ").trim();
    if (!question) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ <b>Usage:</b> Ask a question: <code>/8ball Will we take the bounty?</code>"
      );
      return;
    }

    const responses = [
      "Definitely yes.",
      "Without a doubt.",
      "Outlook looks bright.",
      "Ask again after the next heist.",
      "Signals are hazy, try later.",
      "Do not count on it.",
      "My sources say negative.",
      "High probability of failure.",
    ];

    const reply = responses[Math.floor(Math.random() * responses.length)];

    const card = createStatusCard({
      title: "🎱 UNDERWORLD ORACLE",
      rows: [
        { label: "❓ QUERY", value: question.slice(0, 16) },
        { label: "🔮 ORACLE", value: reply.slice(0, 16) },
      ],
      footer: `Question: "${question}"`,
    });

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
  },
};
