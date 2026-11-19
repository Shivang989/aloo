import { BotContext, CommandHandler } from "../../types/bot";
import {
  isForceJoinModerator,
  authorizeForceJoinModerator,
  upsertForceJoinRule,
  deleteForceJoinRule,
} from "../../database/force-join-data";
import { getChat } from "../../telegram/chats";
import { sendMessage } from "../../telegram/messages";
import { escapeHtml } from "../../ui/fancy-text";
import { ParsedAddCommand, ResolvedTargetChat } from "./types";
import { clearGroupVerifiedCache } from "./membership-check";

function isOwner(userId: number, ownerId: number): boolean {
  return String(userId).trim() === String(ownerId).trim();
}

function parseAddArguments(rawText: string): ParsedAddCommand | null {
  const text = rawText.trim();
  const urlMatch = text.match(/(https?:\/\/[^\s]+|t\.me\/[^\s]+)/i);
  if (!urlMatch || urlMatch.index === undefined) return null;

  const link = urlMatch[0].trim();
  const buttonName = text.slice(0, urlMatch.index).trim();
  const afterLink = text.slice(urlMatch.index + link.length).trim();

  if (!buttonName) return null;

  return {
    buttonName,
    link,
    explicitTarget: afterLink || undefined,
  };
}

function resolveTargetChat(link: string, explicitTarget?: string): ResolvedTargetChat {
  if (explicitTarget) {
    let clean = explicitTarget.trim();
    if (/^-?\d+$/.test(clean)) {
      const rawDigits = clean.replace(/^-/, "");
      if (!clean.startsWith("-100")) {
        clean = `-100${rawDigits}`;
      }
    } else if (!clean.startsWith("@")) {
      clean = `@${clean}`;
    }
    return { targetChat: clean, isPrivateLink: false };
  }

  const isPrivate = link.includes("/+") || link.includes("/joinchat/");
  const match = link.match(/(?:t\.me\/|telegram\.me\/|@)([a-zA-Z0-9_]+)/i);

  if (match && !isPrivate) {
    return { targetChat: `@${match[1]}`, isPrivateLink: false };
  }

  return { targetChat: link, isPrivateLink: isPrivate };
}

export const forceJoinHandlers: Record<string, CommandHandler> = {
  "/add": async (ctx: BotContext) => {
    try {
      if (ctx.chatId > 0) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "⚠️ This command can only be used inside groups.",
          undefined,
          ctx.message.message_id
        );
        return;
      }

      const authorized =
        isOwner(ctx.userId, ctx.env.OWNER_ID) ||
        (await isForceJoinModerator(ctx.chatId, ctx.userId));

      if (!authorized) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "⛔ You are not authorized to configure force-join in this group.",
          undefined,
          ctx.message.message_id
        );
        return;
      }

      const argsText = ctx.args.join(" ").trim();
      const parsed = parseAddArguments(argsText);

      if (!parsed) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "ℹ️ <b>Usage:</b>\n" +
            "• <b>Public Channel:</b> <code>/add &lt;Button Name&gt; &lt;Link&gt;</code>\n" +
            "<i>Example:</i> <code>/add Join Channel https://t.me/mychannel</code>\n\n" +
            "• <b>Private Channel:</b> <code>/add &lt;Button Name&gt; &lt;Link&gt; &lt;Chat_ID&gt;</code>\n" +
            "<i>Example:</i> <code>/add Join https://t.me/+AbCdEf -1004367561053</code>",
          undefined,
          ctx.message.message_id
        );
        return;
      }

      const { buttonName, link, explicitTarget } = parsed;
      const { targetChat, isPrivateLink } = resolveTargetChat(link, explicitTarget);

      if (isPrivateLink && !explicitTarget) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "⚠️ <b>Private invite link detected!</b>\n\n" +
            "Please include the numerical <b>Channel ID</b> at the end of the command:\n\n" +
            `<code>/add ${buttonName} ${link} -100xxxxxxxxxx</code>`,
          undefined,
          ctx.message.message_id
        );
        return;
      }

      const chatCheck = await getChat(ctx.env.BOT_TOKEN, targetChat);
      if (!chatCheck.ok) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          `❌ <b>Cannot access target chat:</b> <code>${targetChat}</code>\n` +
            `<i>Reason: ${chatCheck.error}</i>\n\n` +
            `👉 Make sure Aloo is an <b>Administrator</b> in that channel/group with member management permissions.`,
          undefined,
          ctx.message.message_id
        );
        return;
      }

      await upsertForceJoinRule(ctx.chatId, buttonName, link, targetChat);
      clearGroupVerifiedCache(ctx.chatId);

      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `✅ <b>Force Join Configured!</b>\n\n` +
          `• <b>Button:</b> ${buttonName}\n` +
          `• <b>Link:</b> ${link}\n` +
          `• <b>Target Chat:</b> <code>${targetChat}</code> (${chatCheck.title || "Verified"})\n\n` +
          `<i>Users must join or request to join before chatting here.</i>`,
        undefined,
        ctx.message.message_id
      );
    } catch (err: any) {
      console.error("Error in /add command:", err);
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `⚠️ <b>Error:</b> <code>${err?.message || "Execution error"}</code>`
      );
    }
  },

  "/approved": async (ctx: BotContext) => {
    try {
      if (!isOwner(ctx.userId, ctx.env.OWNER_ID)) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "⛔ Only the bot owner can approve moderators.",
          undefined,
          ctx.message.message_id
        );
        return;
      }

      if (ctx.chatId > 0) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "⚠️ This command can only be used inside groups.",
          undefined,
          ctx.message.message_id
        );
        return;
      }

      let targetUserId: number | null = null;
      let targetUserName = "User";

      const replyMsg = ctx.message.reply_to_message;
      if (replyMsg && replyMsg.from) {
        if (replyMsg.from.is_bot) {
          await sendMessage(
            ctx.env.BOT_TOKEN,
            ctx.chatId,
            "⚠️ Bots cannot be authorized.",
            undefined,
            ctx.message.message_id
          );
          return;
        }
        targetUserId = replyMsg.from.id;
        targetUserName = escapeHtml(replyMsg.from.first_name || "User");
      } else if (ctx.args.length > 0 && /^\d+$/.test(ctx.args[0])) {
        targetUserId = Number(ctx.args[0]);
        targetUserName = `User (${targetUserId})`;
      } else {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "ℹ️ <b>How to authorize:</b>\n" +
            "1. Reply to the user's message with <code>/approved</code>\n" +
            "2. Or specify their user ID: <code>/approved &lt;user_id&gt;</code>",
          undefined,
          ctx.message.message_id
        );
        return;
      }

      await authorizeForceJoinModerator(ctx.chatId, targetUserId);

      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `✅ <b>Moderator Authorized!</b>\n\n` +
          `• <b>User:</b> <a href="tg://user?id=${targetUserId}">${targetUserName}</a>\n` +
          `• <b>User ID:</b> <code>${targetUserId}</code>\n\n` +
          `This user can now use <code>/add</code> and <code>/empty</code> in this group.`,
        undefined,
        ctx.message.message_id
      );
    } catch (err: any) {
      console.error("Error in /approved command:", err);
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `⚠️ <b>Error:</b> <code>${err?.message || "Execution error"}</code>`
      );
    }
  },

  "/empty": async (ctx: BotContext) => {
    try {
      if (ctx.chatId > 0) return;

      const authorized =
        isOwner(ctx.userId, ctx.env.OWNER_ID) ||
        (await isForceJoinModerator(ctx.chatId, ctx.userId));

      if (!authorized) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          "⛔ You are not authorized to reset settings.",
          undefined,
          ctx.message.message_id
        );
        return;
      }

      await deleteForceJoinRule(ctx.chatId);
      clearGroupVerifiedCache(ctx.chatId);

      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "🗑 <b>Force Join Cleared!</b>\nAll buttons removed. Members can now chat freely.",
        undefined,
        ctx.message.message_id
      );
    } catch (err: any) {
      console.error("Error in /empty command:", err);
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `⚠️ <b>Error:</b> <code>${err?.message || "Execution error"}</code>`
      );
    }
  },
};
