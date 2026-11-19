import { BotContext } from "../../types/bot";
import {
  getBroadcastWizard,
  updateBroadcastWizardDraft,
} from "../../database/broadcast-data";
import { isBroadcastOwner } from "./commands";
import { renderOptionsStep } from "./dashboard";

export async function handleBroadcastMessageInput(ctx: BotContext): Promise<boolean> {
  if (!isBroadcastOwner(ctx.userId, ctx.env.OWNER_ID)) return false;

  if (ctx.message.text && ctx.message.text.trim().startsWith("/")) {
    return false;
  }

  try {
    const wiz = await getBroadcastWizard(ctx.userId);
    if (!wiz || wiz.step !== "AWAIT_CONTENT") return false;

    const msg = ctx.message as any;
    const detectedType = msg.sticker
      ? "sticker"
      : msg.photo
      ? "photo"
      : msg.video
      ? "video"
      : msg.animation
      ? "animation"
      : msg.voice
      ? "voice"
      : msg.video_note
      ? "video_note"
      : msg.audio
      ? "audio"
      : msg.document
      ? "document"
      : msg.poll
      ? "poll"
      : "text";

    wiz.draft.items = [
      {
        message_id: msg.message_id,
        from_chat_id: msg.chat.id,
        type: detectedType,
        text: msg.text,
        caption: msg.caption,
      },
    ];

    await updateBroadcastWizardDraft(ctx.userId, wiz.draft, "OPTIONS");
    await renderOptionsStep(ctx.env.BOT_TOKEN, ctx.chatId, wiz.draft);
    return true;
  } catch (err) {
    console.error("Non-fatal broadcast message input error:", err);
    return false;
  }
}
