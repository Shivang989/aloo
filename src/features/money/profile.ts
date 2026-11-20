import { BotContext, CommandHandler } from "../../types/bot";
import { ensureUserExists, getUser } from "../../database/users";
import { formatGenderLabel } from "../../database/profile-admin";
import { getPlayerNetWorth } from "../../database/investments-and-bank";
import { formatRupees } from "./market-pricing";
import { escapeHtml } from "../../ui/fancy-text";
import { sendMessage } from "../../telegram/messages";

const handleProfile: CommandHandler = async (ctx: BotContext) => {
  const targetUser = ctx.reply?.from && !ctx.reply.from.is_bot ? ctx.reply.from : ctx.message.from;
  if (!targetUser || !targetUser.id) return;

  await ensureUserExists(targetUser.id, targetUser.first_name);
  const [user, nw] = await Promise.all([
    getUser(targetUser.id),
    getPlayerNetWorth(targetUser.id),
  ]);

  if (!user) return;

  const now = Math.floor(Date.now() / 1000);
  const safeActive = user.protected_until > now;
  const displayName = escapeHtml(targetUser.first_name || user.first_name || "Player");
  const genderLabel = formatGenderLabel(user.gender);

  const identityLines = [`Name: <b>${displayName}</b>`];
  if (genderLabel) {
    identityLines.push(`Gender: <b>${escapeHtml(genderLabel)}</b>`);
  }

  const text =
    `👤 <b>PLAYER PROFILE</b>\n\n` +
    `${identityLines.join("\n")}\n\n` +
    `Balance: <b>${formatRupees(user.balance)}</b>\n` +
    `Bank Savings: <b>${formatRupees(nw.bankSavings)}</b>\n` +
    `Net Worth: <b>${formatRupees(nw.netWorth)}</b> (${nw.rank.emoji} ${nw.rank.name})\n` +
    `Kills: <b>${user.kills}</b> • Ammo: <b>${user.ammo}</b>\n` +
    `Status: ${user.is_alive ? "❤️ Alive" : "💀 Dead"} • Safe: ${
      safeActive ? "🛡️ Protected" : "⚠️ Exposed"
    }`;

  await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, text, undefined, ctx.message?.message_id);
};

export const profileHandlers: Record<string, CommandHandler> = {
  "/me": handleProfile,
  "/profile": handleProfile,
};
