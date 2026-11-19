import { BotContext, CommandHandler } from "../../types/bot";
import { getAdmin, setAdmin } from "../../database/admins";
import { promoteChatMember, setChatAdministratorCustomTitle } from "../../telegram/chats";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";
import { verifyHighAdmin, resolveAdminTarget } from "./promote";

export const adminTitleHandlers: Record<string, CommandHandler> = {
  "/title": async (ctx: BotContext) => {
    if (!(await verifyHighAdmin(ctx))) return;

    let titleName = ctx.args.filter((a: string) => isNaN(parseInt(a, 10)) || a.length < 7).join(" ");
    const { targetUserId, targetName } = resolveAdminTarget(ctx);

    if (!targetUserId || !titleName.trim()) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ <b>Usage:</b> Reply to an admin with <code>/title [Custom Title]</code> or <code>/title [Custom Title] [id]</code>"
      );
      return;
    }

    titleName = titleName.trim().slice(0, 16);

    await promoteChatMember(ctx.env.BOT_TOKEN, {
      chat_id: ctx.chatId,
      user_id: targetUserId,
      can_manage_chat: true,
    });

    const titleData = await setChatAdministratorCustomTitle(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      targetUserId,
      titleName
    );

    if (!titleData.ok) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `❌ <b>Telegram Error:</b> ${titleData.description}\n<i>(Bot needs 'Add Admins' right!)</i>`
      );
      return;
    }

    const existingAdmin = await getAdmin(ctx.chatId, targetUserId);
    const currentLevel = existingAdmin ? existingAdmin.level : 1;
    await setAdmin(ctx.chatId, targetUserId, currentLevel, titleName);

    const card = createStatusCard({
      title: "🏷️ TITLE UPDATED",
      rows: [
        { label: "👤 TARGET", value: targetName },
        { label: "🆔 UID", value: targetUserId },
        { label: "🏷️ TITLE", value: titleName },
        { label: "👮 UPDATER", value: ctx.message.from?.first_name || "Admin" },
      ],
      footer: "⚡ Custom badge updated in Telegram chat header.",
    });

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
  },
};
