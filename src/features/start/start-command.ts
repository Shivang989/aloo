import { BotContext, CommandHandler } from "../../types/bot";
import { ensureUserExists, getUser } from "../../database/users";
import { getSetting } from "../../database/saved-settings";
import { BOT_SETTINGS } from "../../settings/bot-settings";
import { toCustomFont, escapeHtml } from "../../ui/fancy-text";
import { sendMessage, sendPhoto, sendVideo, sendAnimation } from "../../telegram/messages";
import { DMUIConfig, DMUI_CONFIG_KEY } from "../dm-menu/types";
import { getDefaultButtons, compileInlineKeyboard } from "../dm-menu/button-layout";
import { renderCustomTemplate } from "../dm-menu/template-renderer";

export const startHandlers: Record<string, CommandHandler> = {
  "/start": async (ctx: BotContext) => {
    const isPrivate = ctx.message.chat.type === "private";
    const rawName = ctx.message.from?.first_name?.trim() || "Player";
    const safeName = escapeHtml(rawName);

    if (!isPrivate) {
      const styledName = toCustomFont(safeName);
      const text = `<blockquote>𝙷𝖾ᥣᥣⱺ, ${styledName} 💕\n\n𝚂𝗍α𝗋𝗍 α 𝙳𝙼 𝗍ⱺ υ𝗌𝖾 αᥣᥣ 𝗍ɦ𝖾 𝖿𝖾α𝗍υ𝗋𝖾𝗌.</blockquote>`;
      const groupKb = {
        inline_keyboard: [
          [
            { text: "➕ Add", url: `https://t.me/${BOT_SETTINGS.BOT_USERNAME}?startgroup=true` },
            { text: "💬 Start DM", url: `https://t.me/${BOT_SETTINGS.BOT_USERNAME}?start=true` },
          ],
        ],
      };
      await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, text, groupKb, ctx.message.message_id);
      return;
    }

    await ensureUserExists(ctx.userId, rawName);
    const user = await getUser(ctx.userId);
    const balance = user?.balance ?? BOT_SETTINGS.STARTING_BALANCE;
    const kills = user?.kills ?? 0;

    const liveConfig = (await getSetting<DMUIConfig>(DMUI_CONFIG_KEY)) || {};

    let dmText: string;
    if (liveConfig.customText) {
      dmText = renderCustomTemplate(liveConfig.customText, {
        id: ctx.userId,
        first_name: rawName,
        balance,
        kills,
      });
    } else {
      dmText =
        `Hey, 💕 <b>${safeName}</b>! 👋\n` +
        `I'm Aloo — your gaming partner for managing your balance, earning money, and competing with other players.\n\n` +
        `👤 <b>Your Profile</b>\n\n` +
        `Name: ${safeName}\n` +
        `Balance: ${balance} 💰\n` +
        `Kills: ${kills} ☠️\n\n` +
        `Quick Commands\n\n` +
        `💰 "/bal" — Check your balance\n` +
        `🔫 "/fire" — Fire a bullet\n` +
        `💵 "/rob" — Attempt to steal money\n` +
        `🛡️ "/safe" — Keep your money safe`;
    }

    const buttonRows = liveConfig.buttonRows || getDefaultButtons();
    const dmKeyboard = compileInlineKeyboard(buttonRows);

    if (liveConfig.mediaType === "animation" && liveConfig.mediaFileId) {
      const res = await sendAnimation(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        liveConfig.mediaFileId,
        dmText,
        dmKeyboard
      );
      if (res.ok) return;
    }

    if (liveConfig.mediaType === "photo" && liveConfig.mediaFileId) {
      const res = await sendPhoto(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        liveConfig.mediaFileId,
        dmText,
        dmKeyboard
      );
      if (res.ok) return;
    }

    if (liveConfig.mediaType === "video" && liveConfig.mediaFileId) {
      const res = await sendVideo(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        liveConfig.mediaFileId,
        dmText,
        dmKeyboard
      );
      if (res.ok) return;
    }

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, dmText, dmKeyboard);
  },
};
