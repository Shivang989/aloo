import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import { getSetting, setSetting } from "../../database/saved-settings";
import {
  sendMessage,
  sendPhoto,
  sendVideo,
  sendAnimation,
  editMessageText,
  answerCallbackQuery,
} from "../../telegram/messages";
import { DMUIConfig, DMUI_CONFIG_KEY, DMUI_STATE_KEY } from "./types";
import { getDefaultButtons, compileInlineKeyboard } from "./button-layout";
import { renderCustomTemplate } from "./template-renderer";
import { isBotOwner } from "./menu-command";

export async function handleDMUICallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const userId = cq.from?.id;

  if (!chatId || !userId) return false;

  if (data.startsWith("dm_alt:")) {
    const key = data.replace("dm_alt:", "");
    const config = (await getSetting<DMUIConfig>(DMUI_CONFIG_KEY)) || {};
    const alertMsg = (config.alerts && config.alerts[key]) || key || "Notice";
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, alertMsg, true);
    return true;
  }

  if (data === "dm_none") {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id);
    return true;
  }

  if (!data.startsWith("dmui:")) return false;

  if (!isBotOwner(userId, env.OWNER_ID)) {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⛔ Unauthorized.", true);
    return true;
  }

  if (!messageId) return true;
  const action = data.replace("dmui:", "");

  if (action === "root") {
    await setSetting(DMUI_STATE_KEY, "IDLE");
    await answerCallbackQuery(env.BOT_TOKEN, cq.id);
    await editMessageText(
      env.BOT_TOKEN,
      chatId,
      messageId,
      `⚙️ <b>ALOO DM "/start" CONFIGURATION</b>\n\nChoose a component to configure:`,
      {
        inline_keyboard: [
          [
            { text: "📝 Text", callback_data: "dmui:ask_text" },
            { text: "🖼 Media", callback_data: "dmui:ask_media" },
          ],
          [{ text: "👁 Live Preview", callback_data: "dmui:preview" }],
        ],
      }
    );
    return true;
  }

  if (action === "ask_text") {
    await setSetting(DMUI_STATE_KEY, "AWAIT_TEXT");
    await answerCallbackQuery(env.BOT_TOKEN, cq.id);
    const msg =
      `📝 <b>SET DM "/start" MESSAGE TEXT</b>\n\n` +
      `Send the exact text to display. Supported tags:\n` +
      `• <code>{mention}</code> — User mention\n` +
      `• <code>{first_name}</code> — First name\n` +
      `• <code>{balance}</code> — Cash balance\n` +
      `• <code>{kills}</code> — Kill count\n` +
      `• <code>{b}text{/b}</code> — <b>Bold</b>\n` +
      `• <code>{c}text{/c}</code> — <code>Monospace / Copyable</code>\n` +
      `• <code>{q}text{/q}</code> — Blockquote\n\n` +
      `<i>Send your text now, or send <code>/default</code> to restore the default greeting.</i>`;

    await editMessageText(env.BOT_TOKEN, chatId, messageId, msg, {
      inline_keyboard: [[{ text: "🔙 Cancel", callback_data: "dmui:root" }]],
    });
    return true;
  }

  if (action === "ask_media") {
    await setSetting(DMUI_STATE_KEY, "AWAIT_MEDIA");
    await answerCallbackQuery(env.BOT_TOKEN, cq.id);

    const config = (await getSetting<DMUIConfig>(DMUI_CONFIG_KEY)) || {};
    const status =
      config.mediaType && config.mediaType !== "none"
        ? `Active Media: <b>${
            config.mediaType === "animation" ? "GIF ANIMATION" : config.mediaType.toUpperCase()
          }</b>`
        : "Active Media: <b>None (Text-only)</b>";

    const prompt =
      `🖼 <b>SET DM "/start" MEDIA</b>\n\n` +
      `${status}\n\n` +
      `• Send any <b>Photo</b>, <b>Video</b>, or <b>GIF Animation</b> directly in this chat to attach it.\n` +
      `• Send <code>/empty</code> or click below to remove media and use text-only.`;

    await editMessageText(env.BOT_TOKEN, chatId, messageId, prompt, {
      inline_keyboard: [
        [{ text: "🗑 Clear Media (/empty)", callback_data: "dmui:clear_media" }],
        [{ text: "🔙 Cancel", callback_data: "dmui:root" }],
      ],
    });
    return true;
  }

  if (action === "clear_media") {
    const config = (await getSetting<DMUIConfig>(DMUI_CONFIG_KEY)) || {};
    config.mediaType = "none";
    config.mediaFileId = undefined;
    await setSetting(DMUI_CONFIG_KEY, config);
    await setSetting(DMUI_STATE_KEY, "IDLE");

    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "Media removed.");
    await editMessageText(
      env.BOT_TOKEN,
      chatId,
      messageId,
      "✅ <b>Media Cleared:</b> /start is now text-only.",
      {
        inline_keyboard: [[{ text: "🔙 Main Menu", callback_data: "dmui:root" }]],
      }
    );
    return true;
  }

  if (action === "preview") {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id);
    const config = (await getSetting<DMUIConfig>(DMUI_CONFIG_KEY)) || {};
    const template = config.customText || "Hey, 💕 {first_name}!";
    const text = renderCustomTemplate(template, {
      id: userId,
      first_name: cq.from?.first_name || "Owner",
      balance: 1000,
      kills: 5,
    });
    const kb = compileInlineKeyboard(config.buttonRows || getDefaultButtons());

    let sent = false;
    if (config.mediaFileId && config.mediaType && config.mediaType !== "none") {
      if (config.mediaType === "animation") {
        const res = await sendAnimation(env.BOT_TOKEN, chatId, config.mediaFileId, text, kb);
        sent = res.ok;
      } else if (config.mediaType === "video") {
        const res = await sendVideo(env.BOT_TOKEN, chatId, config.mediaFileId, text, kb);
        sent = res.ok;
      } else if (config.mediaType === "photo") {
        const res = await sendPhoto(env.BOT_TOKEN, chatId, config.mediaFileId, text, kb);
        sent = res.ok;
      }
    }

    if (!sent) {
      await sendMessage(env.BOT_TOKEN, chatId, text, kb);
    }

    await sendMessage(env.BOT_TOKEN, chatId, "👆 <b>DMUI Live Preview</b>", {
      inline_keyboard: [[{ text: "🔙 Return to /dmui", callback_data: "dmui:root" }]],
    });
    return true;
  }

  return false;
}
