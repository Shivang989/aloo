import { BotContext, CommandHandler } from "../../types/bot";
import { ensureUserExists, getUser } from "../../database/users";
import { toFancy, escapeHtml } from "../../ui/fancy-text";
import { sendMessage } from "../../telegram/messages";

function formatBalanceCard(params: {
  userId: number;
  rawName: string;
  isAlive: boolean;
  balance: number;
  kills: number;
  ammo: number;
}): string {
  const safeName = escapeHtml(params.rawName || "Player");
  const mention = `<a href="tg://user?id=${params.userId}">${safeName}</a>`;
  const statusFancy = toFancy(params.isAlive ? "Alive" : "Dead");

  return (
    `🥰 ${mention} (${statusFancy})\n` +
    `💸 𝐁αᥣα𐓣𝖼𝖾: ₹${params.balance}\n` +
    `☠️ 𝐊𝗂ᥣᥣ𝗌: ${params.kills}\n` +
    `🔫 𝐀ꭑꭑⱺ: ${params.ammo}\n` +
    `||▄︻ ┻ ═━=||`
  );
}

const handleBalance: CommandHandler = async (ctx: BotContext) => {
  try {
    const reply = ctx.reply;

    if (reply && reply.from && reply.from.id !== ctx.userId) {
      if (reply.from.is_bot) {
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

      const text = formatBalanceCard({
        userId: targetId,
        rawName: reply.from.first_name || targetUser.first_name || "Player",
        isAlive: (targetUser.is_alive ?? 1) !== 0,
        balance: targetUser.balance ?? 0,
        kills: targetUser.kills ?? 0,
        ammo: targetUser.ammo ?? 0,
      });

      await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, text, undefined, ctx.message?.message_id);
      return;
    }

    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const user = await getUser(ctx.userId);

    const text = formatBalanceCard({
      userId: ctx.userId,
      rawName: ctx.message.from?.first_name || user?.first_name || "Player",
      isAlive: (user?.is_alive ?? 1) !== 0,
      balance: user?.balance ?? 0,
      kills: user?.kills ?? 0,
      ammo: user?.ammo ?? 0,
    });

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
