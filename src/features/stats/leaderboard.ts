import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { UserData } from "../../types/player";
import { getTopPlayers, syncUserFirstName } from "../../database/users";
import { getChat, getChatMember } from "../../telegram/chats";
import { escapeHtml } from "../../ui/fancy-text";
import { sendMessage } from "../../telegram/messages";

async function resolvePlayerName(
  env: RuntimeEnv,
  player: UserData,
  chatId?: number
): Promise<string> {
  let rawName: string | undefined = player.first_name || undefined;

  if (!rawName && chatId && chatId < 0) {
    const member = await getChatMember(env.BOT_TOKEN, chatId, player.user_id);
    if (member.ok && member.firstName) {
      rawName = member.firstName;
    }
  }

  if (!rawName) {
    const chat = await getChat(env.BOT_TOKEN, player.user_id);
    if (chat.ok && chat.first_name) {
      rawName = chat.first_name;
    }
  }

  if (rawName && !player.first_name) {
    try {
      await syncUserFirstName(player.user_id, rawName);
    } catch {
      // Ignore non-critical backfill error
    }
  }

  return escapeHtml((rawName || "Player").trim());
}

const handleLeaderboard: CommandHandler = async (ctx: BotContext) => {
  const topPlayers = await getTopPlayers(5);
  if (!topPlayers || topPlayers.length === 0) {
    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, "🏆 <b>No players registered yet.</b>");
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = await Promise.all(
    topPlayers.map(async (p, idx) => {
      const name = await resolvePlayerName(ctx.env, p, ctx.chatId);
      const rank = medals[idx] || `${idx + 1}.`;
      const mention = `<a href="tg://user?id=${p.user_id}">${name}</a>`;
      return `${rank} ${mention} — ₹${p.balance ?? 0}`;
    })
  );

  const report = `🏆 <b>LEADERBOARD</b>\n\n${lines.join("\n")}`;
  await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, report, undefined, ctx.message?.message_id);
};

export const leaderboardHandlers: Record<string, CommandHandler> = {
  "/top": handleLeaderboard,
  "/leaderboard": handleLeaderboard,
};
