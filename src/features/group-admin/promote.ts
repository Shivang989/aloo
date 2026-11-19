import { BotContext, CommandHandler } from "../../types/bot";
import { getAdmin, setAdmin } from "../../database/admins";
import { promoteChatMember } from "../../telegram/chats";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";

export async function verifyHighAdmin(ctx: BotContext): Promise<boolean> {
  const isOwner = ctx.userId === Number(ctx.env.OWNER_ID);
  if (isOwner) return true;
  const callerAdmin = await getAdmin(ctx.chatId, ctx.userId);
  return callerAdmin !== null && callerAdmin.level >= 3;
}

export function resolveAdminTarget(ctx: BotContext): {
  targetUserId: number | null;
  targetName: string;
} {
  if (ctx.reply && ctx.reply.from) {
    return {
      targetUserId: ctx.reply.from.id,
      targetName: ctx.reply.from.first_name,
    };
  }

  const idArg = ctx.args.find((a: string) => !isNaN(parseInt(a, 10)) && a.length > 7);
  if (idArg) {
    return {
      targetUserId: parseInt(idArg, 10),
      targetName: `User (${idArg})`,
    };
  }

  return { targetUserId: null, targetName: "Player" };
}

export const promoteHandlers: Record<string, CommandHandler> = {
  "/promote": async (ctx: BotContext) => {
    if (!(await verifyHighAdmin(ctx))) return;

    const lvlArg = ctx.args.find((a: string) => ["1", "2", "3"].includes(a));
    const level = lvlArg ? parseInt(lvlArg, 10) : 1;
    const { targetUserId, targetName } = resolveAdminTarget(ctx);

    if (!targetUserId) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ <b>Usage:</b> Reply to a user with <code>/promote [level 1-3]</code> or <code>/promote [id] [level]</code>"
      );
      return;
    }

    const data = await promoteChatMember(ctx.env.BOT_TOKEN, {
      chat_id: ctx.chatId,
      user_id: targetUserId,
      can_manage_chat: true,
      can_change_info: level >= 2,
      can_delete_messages: true,
      can_invite_users: true,
      can_restrict_members: level >= 2,
      can_pin_messages: true,
      can_promote_members: level >= 3,
      can_manage_video_chats: true,
      is_anonymous: false,
    });

    if (!data.ok) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `❌ <b>Telegram Error:</b> ${data.description}\n<i>(Ensure the bot has "Add New Admins" rights!)</i>`
      );
      return;
    }

    const title = level === 3 ? "Underboss" : level === 2 ? "Capo" : "Soldier";
    await setAdmin(ctx.chatId, targetUserId, level, title);

    const card = createStatusCard({
      title: "🛡️ ADMIN PROMOTED",
      rows: [
        { label: "👤 TARGET", value: targetName },
        { label: "🆔 UID", value: targetUserId },
        { label: "🎖️ RANK", value: `Level ${level} (${title})` },
        { label: "👮 PROMOTER", value: ctx.message.from?.first_name || "Admin" },
      ],
      footer: "⚡ Admin privileges granted and synced to database.",
    });

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
  },
};
