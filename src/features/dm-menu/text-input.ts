import { BotContext } from "../../types/bot";
import { getSetting, setSetting } from "../../database/saved-settings";
import { sendMessage } from "../../telegram/messages";
import { DMUIConfig, DMUI_CONFIG_KEY, DMUI_STATE_KEY } from "./types";
import { getDefaultButtons, compileInlineKeyboard } from "./button-layout";
import { parseButtonRows } from "./button-editor";
import { renderCustomTemplate } from "./template-renderer";
import { isBotOwner } from "./menu-command";

export async function handleDMUITextInput(ctx: BotContext): Promise<boolean> {
  if (!isBotOwner(ctx.userId, ctx.env.OWNER_ID)) return false;

  const state = await getSetting<string>(DMUI_STATE_KEY);
  if (!state || state === "IDLE") return false;

  const input = ctx.text.trim();
  const config = (await getSetting<DMUIConfig>(DMUI_CONFIG_KEY)) || {};

  if (state === "AWAIT_TEXT") {
    if (input === "/default") {
      delete config.customText;
    } else {
      config.customText = input;
    }

    await setSetting(DMUI_CONFIG_KEY, config);
    await setSetting(DMUI_STATE_KEY, "IDLE");

    const preview = renderCustomTemplate(config.customText || "Hey, 💕 {first_name}!", {
      id: ctx.userId,
      first_name: ctx.message.from?.first_name || "Owner",
      balance: 1000,
      kills: 5,
    });

    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      `✅ <b>Message Text Saved!</b>\n\n<b>Preview:</b>\n${preview}`,
      { inline_keyboard: [[{ text: "🔙 Return to /dmui", callback_data: "dmui:root" }]] }
    );
    return true;
  }

  if (state === "AWAIT_BUTTONS") {
    if (input === "/default") {
      delete config.buttonRows;
      delete config.rawButtonsText;
      delete config.alerts;
    } else {
      const { rows, alerts } = parseButtonRows(input);
      if (rows.length === 0) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          `⚠️ <b>No valid buttons detected.</b>\n` +
            `Make sure to use the format:\n<code>Button Title - https://link.com</code>\nor\n<code>Btn 1 - link1 && Btn 2 - link2</code>`
        );
        return true;
      }
      config.buttonRows = rows;
      config.rawButtonsText = input;
      config.alerts = alerts;
    }

    await setSetting(DMUI_CONFIG_KEY, config);
    await setSetting(DMUI_STATE_KEY, "IDLE");

    const kb = compileInlineKeyboard(config.buttonRows || getDefaultButtons());

    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      `✅ <b>Buttons Updated Successfully!</b>\nHere is how they look:`,
      kb
    );
    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, `Ready to test in /start.`, {
      inline_keyboard: [[{ text: "🔙 Return to /dmui", callback_data: "dmui:root" }]],
    });
    return true;
  }

  if (state === "AWAIT_MEDIA" && input === "/empty") {
    config.mediaType = "none";
    config.mediaFileId = undefined;
    await setSetting(DMUI_CONFIG_KEY, config);
    await setSetting(DMUI_STATE_KEY, "IDLE");

    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      `✅ <b>Media Cleared:</b> /start set to text-only mode.`,
      { inline_keyboard: [[{ text: "🔙 Return to /dmui", callback_data: "dmui:root" }]] }
    );
    return true;
  }

  return false;
}
