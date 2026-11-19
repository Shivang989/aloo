import { BotContext, CommandHandler } from "../../types/bot";
import { getUser } from "../../database/users";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";
import { formatRemainingTime } from "./protection";

const handleProfile: CommandHandler = async (ctx: BotContext) => {
  const user = await getUser(ctx.userId);
  if (!user) return;

  const now = Math.floor(Date.now() / 1000);
  const isSafe = user.protected_until && user.protected_until > now;

  const card = createStatusCard({
    title: "👤 UNDERWORLD DOSSIER",
    rows: [
      { label: "👤 PLAYER", value: ctx.message.from?.first_name || "Player" },
      { label: "🆔 UID", value: ctx.userId },
      { label: "💰 CASH", value: `₹${user.balance}` },
      { label: "🔫 AMMO", value: `${user.ammo ?? 0} rounds` },
      { label: "💀 KILLS", value: user.kills ?? 0 },
      {
        label: "🛡️ SAFE VAULT",
        value: isSafe ? formatRemainingTime(user.protected_until - now) : "INACTIVE",
      },
      { label: "❤️ STATUS", value: user.is_alive === 0 ? "ELIMINATED" : "ALIVE" },
    ],
    footer:
      user.is_alive === 0
        ? "💀 STATUS • Knocked out. Use /revive to rejoin."
        : isSafe
        ? "🛡️ STATUS • Safe active. Immune to all /rob attempts."
        : "🟢 STATUS • Operational and armed.",
  });

  await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
};

export const profileHandlers: Record<string, CommandHandler> = {
  "/me": handleProfile,
  "/profile": handleProfile,
};
