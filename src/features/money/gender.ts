import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import { ensureUserExists, getUser } from "../../database/users";
import {
  formatGenderLabel,
  GenderCode,
  isValidGenderCode,
  ownerSetPlayerGenderTx,
  setPlayerGenderOnceTx,
} from "../../database/profile-admin";
import { escapeHtml } from "../../ui/fancy-text";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
} from "../../telegram/messages";

export function buildGenderSelectionView(ownerId: number): {
  text: string;
  replyMarkup: { inline_keyboard: any[][] };
} {
  const text =
    `👤 <b>SELECT YOUR GENDER</b>\n\n` +
    `Choose your gender.\n` +
    `Your selection will be saved to your profile.`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "Male", callback_data: `gdr:${ownerId}:set:male` },
        { text: "Female", callback_data: `gdr:${ownerId}:set:female` },
      ],
      [
        { text: "Other", callback_data: `gdr:${ownerId}:set:other` },
        { text: "Prefer not to say", callback_data: `gdr:${ownerId}:set:prefer_not_to_say` },
      ],
    ],
  };

  return { text, replyMarkup };
}

export async function handleGenderCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (!data.startsWith("gdr:")) return false;

  const clickerId = cq.from?.id;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  if (!clickerId || !chatId) return false;

  const parts = data.split(":");
  const ownerId = Number(parts[1]);
  const action = parts[2];
  const rawCode = (parts[3] || "").toLowerCase();

  if (!Number.isInteger(ownerId) || ownerId <= 0 || action !== "set") {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid selection.", true);
    return true;
  }

  if (clickerId !== ownerId) {
    await answerCallbackQuery(
      env.BOT_TOKEN,
      cq.id,
      "⚠️ This gender menu belongs to another player. Send /gender to set yours!",
      true
    );
    return true;
  }

  if (!isValidGenderCode(rawCode)) {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid gender option.", true);
    return true;
  }

  try {
    await ensureUserExists(clickerId, cq.from?.first_name);
    const res = await setPlayerGenderOnceTx(ownerId, rawCode);

    if (res.status === "already_set") {
      const savedLabel = formatGenderLabel(res.existingGender) || res.existingGender;
      await answerCallbackQuery(
        env.BOT_TOKEN,
        cq.id,
        `ℹ️ Gender is already set to ${savedLabel}. Only the bot owner can change it.`,
        true
      );
      const lockedText =
        `👤 <b>PROFILE GENDER</b>\n\n` +
        `Saved Gender: <b>${escapeHtml(savedLabel)}</b>\n\n` +
        `<i>Your gender is locked once selected and can only be changed by the bot owner.</i>`;

      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, lockedText);
      }
      return true;
    }

    const label = formatGenderLabel(res.gender)!;
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, `✅ Gender saved: ${label}`);

    const savedText =
      `✅ <b>GENDER SAVED</b>\n\n` +
      `Selected Gender: <b>${escapeHtml(label)}</b>\n\n` +
      `Your profile has been updated. Use <code>/profile</code> to view it.`;

    if (messageId) {
      await editMessageText(env.BOT_TOKEN, chatId, messageId, savedText);
    } else {
      await sendMessage(env.BOT_TOKEN, chatId, savedText);
    }
    return true;
  } catch (err) {
    console.error("Gender callback error:", err);
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Unable to save gender.", true);
    return true;
  }
}

export const genderHandlers: Record<string, CommandHandler> = {
  "/gender": async (ctx: BotContext) => {
    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const user = await getUser(ctx.userId);

    if (user?.gender) {
      const label = formatGenderLabel(user.gender) || user.gender;
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `👤 <b>PROFILE GENDER</b>\n\n` +
          `Saved Gender: <b>${escapeHtml(label)}</b>\n\n` +
          `<i>Your gender selection is already saved and can only be changed by the bot owner.</i>`,
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const view = buildGenderSelectionView(ctx.userId);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      view.text,
      view.replyMarkup,
      ctx.message?.message_id
    );
  },

  "/setgender": async (ctx: BotContext) => {
    const isOwner = String(ctx.userId).trim() === String(ctx.env.OWNER_ID).trim();
    if (!isOwner) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "❌ <b>Access Denied:</b> Only the bot owner can use <code>/setgender</code>.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const targetUser = ctx.reply?.from;
    if (!targetUser || !targetUser.id) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ <b>Reply Required</b>\n\n" +
          "Reply to a user's message with:\n" +
          "<code>/setgender &lt;male | female | other | prefer_not_to_say | none&gt;</code>",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    if (targetUser.is_bot) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "❌ Cannot set profile gender for a bot account.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const rawArg = ctx.args.join("_").toLowerCase().trim();
    let nextGender: GenderCode | null;

    if (rawArg === "none" || rawArg === "clear" || rawArg === "unset") {
      nextGender = null;
    } else if (isValidGenderCode(rawArg)) {
      nextGender = rawArg;
    } else {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "⚠️ <b>Invalid Gender Value</b>\n\n" +
          "Allowed values: <code>male</code>, <code>female</code>, <code>other</code>, <code>prefer_not_to_say</code>, or <code>none</code>.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const res = await ownerSetPlayerGenderTx({
      ownerId: ctx.userId,
      targetUserId: targetUser.id,
      targetFirstName: targetUser.first_name,
      newGender: nextGender,
      idempotencyKey: `setgender_upd_${ctx.update.update_id}`,
    });

    if (res.status === "duplicate") return;

    const targetName = escapeHtml(targetUser.first_name || "Player");
    const targetMention = `<a href="tg://user?id=${targetUser.id}">${targetName}</a>`;
    const newLabel = nextGender ? formatGenderLabel(nextGender)! : "Unselected (Removed)";

    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      `✅ <b>PROFILE GENDER UPDATED</b>\n\n` +
        `Player: ${targetMention}\n` +
        `Updated Gender: <b>${escapeHtml(newLabel)}</b>\n\n` +
        `<i>${targetMention}, your profile gender was updated by the bot owner.</i>`,
      undefined,
      ctx.message?.message_id
    );
  },
};
