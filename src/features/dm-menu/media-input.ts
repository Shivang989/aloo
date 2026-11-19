import { BotContext } from "../../types/bot";
import { getSetting, setSetting } from "../../database/saved-settings";
import { sendMessage } from "../../telegram/messages";
import { DMUIConfig, DMUI_CONFIG_KEY, DMUI_STATE_KEY } from "./types";
import { isBotOwner } from "./menu-command";

export async function handleDMUIMediaInput(ctx: BotContext): Promise<boolean> {
  if (!isBotOwner(ctx.userId, ctx.env.OWNER_ID)) return false;

  try {
    const state = await getSetting<string>(DMUI_STATE_KEY);
    if (state !== "AWAIT_MEDIA") return false;

    const msg = ctx.message as any;
    let mediaType: "photo" | "video" | "animation" | null = null;
    let fileId: string | null = null;

    if (msg.animation) {
      mediaType = "animation";
      fileId = msg.animation.file_id;
    } else if (
      msg.document &&
      (msg.document.mime_type === "image/gif" ||
        (msg.document.file_name && msg.document.file_name.toLowerCase().endsWith(".gif")))
    ) {
      mediaType = "animation";
      fileId = msg.document.file_id;
    } else if (msg.photo && msg.photo.length > 0) {
      mediaType = "photo";
      fileId = msg.photo[msg.photo.length - 1].file_id;
    } else if (msg.video) {
      mediaType = "video";
      fileId = msg.video.file_id;
    }

    if (!mediaType || !fileId) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ Unsupported media format. Please send a <b>Photo</b>, <b>Video</b>, or <b>GIF</b>."
      );
      return true;
    }

    const config = (await getSetting<DMUIConfig>(DMUI_CONFIG_KEY)) || {};
    config.mediaType = mediaType;
    config.mediaFileId = fileId;

    await setSetting(DMUI_CONFIG_KEY, config);
    await setSetting(DMUI_STATE_KEY, "IDLE");

    const mediaLabel = mediaType === "animation" ? "GIF Animation" : mediaType.toUpperCase();
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      `✅ <b>Media Updated!</b>\n\n` +
        `• <b>Type:</b> <code>${mediaLabel}</code>\n` +
        `• <b>File ID:</b> <code>${fileId.slice(0, 20)}...</code>\n\n` +
        `Your DM panel will now display this ${mediaLabel}.`,
      {
        inline_keyboard: [
          [{ text: "👁 Preview DMUI", callback_data: "dmui:preview" }],
          [{ text: "🔙 Return to /dmui", callback_data: "dmui:root" }],
        ],
      }
    );

    return true;
  } catch (err) {
    console.error("Non-fatal handleDMUIMediaInput error:", err);
    return false;
  }
}
