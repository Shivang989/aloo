import { BotContext, CommandHandler } from "../../types/bot";
import { removeAdmin } from "../../database/admins";
import { promoteChatMember } from "../../telegram/chats";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";
import { verifyHighAdmin, resolveAdminTarget } from "./promote";

export const demoteHandlers: Record<string, CommandHandler> = {
  "/demote": async (ctx: BotContext) => {
    if (!(await verifyHighAdmin(ctx))) return;

    const { targetUserId, targetName } = resolveAdminTarget(ctx);
    if (!targetUserId) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ <b>Usage:</b> Reply to a user with <code>/demote</code> or specify <code>/demote [id]</code>"
      );
      return;
    }

    const data = await promoteChatMember(ctx.env.BOT_TOKEN, {
      chat_id: ctx.chatId,
      user_id: targetUserId,
      can_manage_chat: false,
      can_change_info: false,
      can_delete_messages: false,
      can_invite_users: false,
      can_restrict_members: false,
      can_pin_messages: false,
      can_promote_members: false,
      can_manage_video_chats: false,
      is_anonymous: false,
    });

    if (!data.ok) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `❌ <b>Telegram Error:</b> ${data.description}\n<i>(Ensure the bot has permission to manage administrators!)</i>`
      );
      return;
    }

    await removeAdmin(ctx.chatId, targetUserId);

    const card = createStatusCard({
      title: "🛡️ ADMIN DEMOTED",
      rows: [
        { label: "👤 TARGET", value: targetName },
        { label: "🆔 UID", value: targetUserId },
        { label: "🎖️ RANK", value: "Revoked" },
        { label: "👮 DEMOTER", value: ctx.message.from?.first_name || "Admin" },
      ],
      footer: "⚡ Privileges stripped and administrative credentials cleared.",
    });

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
  },
};
