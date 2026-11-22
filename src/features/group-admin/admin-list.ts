import { BotContext, CommandHandler } from "../../types/bot";
import { TelegramChatMember } from "../../telegram/types";
import { getChatAdministrators } from "../../telegram/chats";
import { sendMessage } from "../../telegram/messages";
import { escapeHtml } from "../../ui/fancy-text";

function formatAdminMention(member: TelegramChatMember): string {
  const user = member.user;
  if (!user || !user.id) {
    const fallbackLabel = member.custom_title?.trim() || "Anonymous Admin";
    return escapeHtml(fallbackLabel);
  }

  if (user.username && user.username.trim().length > 0) {
    const cleanUsername = user.username.trim().replace(/^@+/, "");
    return `@${escapeHtml(cleanUsername)}`;
  }

  const rawName = user.first_name?.trim() || member.custom_title?.trim() || "Anonymous Admin";
  const safeName = escapeHtml(rawName);
  return `<a href="tg://user?id=${user.id}">${safeName}</a>`;
}

export const adminListHandlers: Record<string, CommandHandler> = {
  "/admins": async (ctx: BotContext) => {
    if (ctx.message.chat.type === "private" || ctx.chatId > 0) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ This command can only be used inside groups and supergroups.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const res = await getChatAdministrators(ctx.env.BOT_TOKEN, ctx.chatId);

    if (!res.ok || !res.administrators) {
      const reason = escapeHtml(res.error || "Telegram API error");
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `❌ <b>Unable to fetch group administrators:</b> ${reason}`,
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    if (res.administrators.length === 0) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ No administrators were returned for this group.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const seenUserIds = new Set<number>();
    let ownerEntry: string | null = null;
    const adminEntries: string[] = [];

    for (const member of res.administrators) {
      const uid = member.user?.id;
      if (uid !== undefined && uid !== null) {
        if (seenUserIds.has(uid)) continue;
        seenUserIds.add(uid);
      }

      const formatted = formatAdminMention(member);
      if (member.status === "creator" && !ownerEntry) {
        ownerEntry = formatted;
      } else {
        adminEntries.push(formatted);
      }
    }

    const sections: string[] = [];

    if (ownerEntry) {
      sections.push(`👑 <b>𝐆𝗋ⱺυρ 𝐎ω𐓣𝖾𝗋</b>\n──────────\n1. ${ownerEntry}`);
    }

    if (adminEntries.length > 0) {
      const numberedAdmins = adminEntries
        .map((entry, index) => `${index + 1}. ${entry}`)
        .join("\n");
      sections.push(`🤝 <b>𝐂υ𝗍𝖾 𝐀ᑯꭑ𝗂𐓣𝗌</b>🫶\n──────────\n${numberedAdmins}`);
    }

    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      sections.join("\n\n"),
      undefined,
      ctx.message?.message_id
    );
  },
};
