import { BotContext, CommandHandler } from "../../types/bot";
import { ensureUserExists, getUser } from "../../database/users";
import { toFancy, escapeHtml } from "../../ui/fancy-text";
import { sendMessage } from "../../telegram/messages";

const handleBalance: CommandHandler = async (ctx: BotContext) => {
  try {
    const reply = ctx.reply;

    if (reply) {
      if (!reply.from || reply.from.is_bot) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "❌ Unable to identify this player.",
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      const targetId = reply.from.id;

      if (targetId !== ctx.userId) {
        const targetUser = await getUser(targetId);

        if (!targetUser) {
          await sendMessage(
            ctx.env.BOT_TOKEN,
            ctx.chatId,
            "❌ Player profile not found.",
            undefined,
            ctx.message?.message_id
          );
          return;
        }

        const targetName = escapeHtml(reply.from.first_name || "Player");
        const targetMention = `<a href="tg://user?id=${targetId}">${targetName}</a>`;
        const isAlive = (targetUser.is_alive ?? 1) !== 0;
        const status = toFancy(isAlive ? "(Alive)" : "(Dead)");

        const balance = toFancy(`₹${targetUser.balance ?? 0}`);
        const kills = toFancy(String(targetUser.kills ?? 0));

        const text =
          `👤 ${targetMention} ${status}\n` +
          `💵 ${toFancy("Balance:")} ${balance}\n` +
          `☠️ ${toFancy("Kills:")} ${kills}`;

        await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, text, undefined, ctx.message?.message_id);
        return;
      }
    }

    await ensureUserExists(ctx.userId);
    const user = await getUser(ctx.userId);

    const senderName = escapeHtml(ctx.message.from?.first_name || "Player");
    const mention = `<a href="tg://user?id=${ctx.userId}">${senderName}</a>`;
    const isAlive = (user?.is_alive ?? 1) !== 0;
    const status = toFancy(isAlive ? "(Alive)" : "(Dead)");

    const balance = toFancy(`₹${user?.balance ?? 0}`);
    const kills = toFancy(String(user?.kills ?? 0));
    const bullets = toFancy(String(user?.ammo ?? 0));

    const text =
      `👤 ${mention} ${status}\n` +
      `💵 ${toFancy("Balance:")} ${balance}\n` +
      `☠️ ${toFancy("Kills:")} ${kills}\n` +
      `🔫 ${toFancy("Bullets:")} ${bullets}`;

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, text, undefined, ctx.message?.message_id);
  } catch (err: any) {
    console.error("Error executing /bal:", err);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      `⚠️ <code>${err?.message || "Execution error"}</code>`,
      undefined,
      ctx.message?.message_id
    );
  }
};

export const balanceHandlers: Record<string, CommandHandler> = {
  "/bal": handleBalance,
  "/balance": handleBalance,
};
