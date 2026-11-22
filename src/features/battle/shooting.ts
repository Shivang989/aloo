import { BotContext, CommandHandler } from "../../types/bot";
import { ensureUserExists, getUser, fireAtTargetTx } from "../../database/users";
import { escapeHtml } from "../../ui/fancy-text";
import { sendMessage } from "../../telegram/messages";

const handleFire: CommandHandler = async (ctx: BotContext) => {
  try {
    const reply = ctx.reply;

    if (!reply) {
      await ensureUserExists(ctx.userId);
      const shooter = await getUser(ctx.userId);
      const bulletsLeft = shooter?.ammo ?? 0;

      const guideText =
        `🔫 <b>Fire</b>\n\n` +
        `Bullets left: ${bulletsLeft}\n\n` +
        `Reply to a player's message with "/fire" to attack and eliminate them.`;

      await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, guideText, undefined, ctx.message?.message_id);
      return;
    }

    if (!reply.from || reply.from.is_bot) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "❌ Unable to identify this player.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const targetId = reply.from.id;

    if (targetId === ctx.userId) {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "❌ You cannot target yourself.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    const targetName = escapeHtml(reply.from.first_name || "Target");
    const attackerName = escapeHtml(ctx.message.from?.first_name || "Attacker");
    const targetMention = `<a href="tg://user?id=${targetId}">${targetName}</a>`;

    const res = await fireAtTargetTx(
      ctx.userId,
      targetId,
      `fire_upd_${ctx.update.update_id}`
    );

    if (res.status === "duplicate") return;

    if (res.status === "no_ammo") {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        '❌ No bullets left. Use "/buy <amount>" to purchase bullets.',
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    if (res.status === "target_not_found") {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        "❌ Player profile not found.",
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    if (res.status === "target_dead") {
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `💔 ${targetMention} , already Dead.`,
        undefined,
        ctx.message?.message_id
      );
      return;
    }

    if (res.status === "target_protected") {
      const protectedText =
        `🛡️ <b>Target Protected</b>\n\n` +
        `Your bullet was used, but protection prevented the elimination.`;

      await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, protectedText, undefined, ctx.message?.message_id);
      return;
    }

    const resultText =
      `ㅤ▄︻̷ ┻ ═━ㅤㅤᴰᵉᵃᵈ\n` +
      `🎯 ${attackerName} ➜ ${targetName} 😭\n` +
      `💰 +₹${res.reward} • 🔫 ${res.remainingBullets} Ammo Left`;

    await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, resultText, undefined, ctx.message?.message_id);
  } catch (err: any) {
    console.error("Fire command error:", err);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      `⚠️ <code>${err?.message || "Execution error"}</code>`,
      undefined,
      ctx.message?.message_id
    );
  }
};

export const shootingHandlers: Record<string, CommandHandler> = {
  "/fire": handleFire,
  "/shoot": handleFire,
};
