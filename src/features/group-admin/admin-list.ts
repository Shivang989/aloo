import { BotContext, CommandHandler } from "../../types/bot";
import { getAllAdmins } from "../../database/admins";
import { createStatusCard } from "../../ui/status-card";
import { sendMessage } from "../../telegram/messages";

export const adminListHandlers: Record<string, CommandHandler> = {
  "/admins": async (ctx: BotContext) => {
    const admins = await getAllAdmins(ctx.chatId);

    if (!admins || admins.length === 0) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "📋 <b>No custom admins registered in database for this chat.</b>"
      );
      return;
    }

    const rows = admins.slice(0, 6).map((a) => ({
      label: `L${a.level} ${a.title ?? "Admin"}`.slice(0, 10),
      value: `UID: ${a.user_id}`,
    }));

    const card = createStatusCard({
      title: "📋 CHAT ADMINISTRATORS",
      rows,
      footer: `Total Active Staff: ${admins.length}`,
    });

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, card);
  },
};
