import crypto from "crypto";
import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import { ECONOMY_LIMITS, FREELANCE_TEMPLATES } from "../../settings/economy-config";
import {
  completeFreelanceTaskTx,
  createFreelanceTask,
  FreelanceTaskRow,
  getFreelanceState,
} from "../../database/active-income";
import { ensureUserExists } from "../../database/users";
import { formatRupees } from "./market-pricing";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
} from "../../telegram/messages";

function formatDurationCompact(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${rem}s`;
  return `${rem}s`;
}

function buildFreelanceCard(
  ownerId: number,
  task: FreelanceTaskRow,
  now: number
): { text: string; replyMarkup: { inline_keyboard: any[][] } } {
  const remainingSec = Math.max(0, task.expires_at - now);
  const text =
    `💻 <b>FREELANCE CONTRACT</b>\n\n` +
    `Task ID: <code>${task.task_id}</code>\n` +
    `Category: <b>${task.category}</b>\n` +
    `Brief: ${task.title}\n\n` +
    `Payout: <b>${formatRupees(task.reward)}</b>\n` +
    `Expires in: <b>${formatDurationCompact(remainingSec)}</b>`;

  return {
    text,
    replyMarkup: {
      inline_keyboard: [
        [{ text: "✅ Complete Task", callback_data: `frl:${ownerId}:done:${task.task_id}` }],
      ],
    },
  };
}

async function generateOrResumeFreelance(
  ownerId: number
): Promise<{ text: string; replyMarkup?: { inline_keyboard: any[][] } }> {
  const now = Math.floor(Date.now() / 1000);
  const state = await getFreelanceState(ownerId, now);

  if (state.openTask) {
    return buildFreelanceCard(ownerId, state.openTask, now);
  }

  const elapsed = now - state.lastFreelanceAt;
  if (state.lastFreelanceAt > 0 && elapsed < ECONOMY_LIMITS.FREELANCE_COOLDOWN_SEC) {
    const waitSec = ECONOMY_LIMITS.FREELANCE_COOLDOWN_SEC - elapsed;
    return {
      text:
        `💻 <b>FREELANCE BOARD</b>\n\n` +
        `You have completed your recent contract.\n` +
        `Next freelance contract available in <b>${formatDurationCompact(waitSec)}</b>.`,
    };
  }

  const tpl = FREELANCE_TEMPLATES[Math.floor(Math.random() * FREELANCE_TEMPLATES.length)];
  const rawReward =
    tpl.minReward + Math.floor(Math.random() * (tpl.maxReward - tpl.minReward + 1));
  const reward = Math.round(rawReward / 100) * 100;

  const taskId = `frl_${crypto.randomBytes(5).toString("hex")}`;
  const created = await createFreelanceTask({
    task_id: taskId,
    user_id: ownerId,
    title: tpl.title,
    category: tpl.category,
    reward,
    expires_at: now + ECONOMY_LIMITS.FREELANCE_EXPIRY_SEC,
    created_at: now,
  });

  return buildFreelanceCard(ownerId, created, now);
}

export async function handleFreelanceCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (!data.startsWith("frl:")) return false;

  const clickerId = cq.from?.id;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  if (!clickerId || !chatId) return false;

  const parts = data.split(":");
  const ownerId = Number(parts[1]);
  const action = parts[2];
  const taskId = parts[3] || "";

  if (!Number.isInteger(ownerId) || ownerId <= 0 || action !== "done" || !taskId) {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid or expired contract.", true);
    return true;
  }

  if (clickerId !== ownerId) {
    await answerCallbackQuery(
      env.BOT_TOKEN,
      cq.id,
      "⚠️ This freelance task belongs to another player. Send /freelance to get yours!",
      true
    );
    return true;
  }

  try {
    await ensureUserExists(clickerId, cq.from?.first_name);
    const res = await completeFreelanceTaskTx(ownerId, taskId, `frl_cq_${cq.id}`);

    if (res.status === "duplicate" || res.status === "already_completed") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Contract already completed.");
      return true;
    }

    if (res.status === "cooldown") {
      await answerCallbackQuery(
        env.BOT_TOKEN,
        cq.id,
        `⏳ Next freelance contract available in ${formatDurationCompact(res.remainingSec)}.`,
        true
      );
      return true;
    }

    if (res.status === "expired_or_invalid") {
      await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Contract expired or invalid.", true);
      return true;
    }

    if (res.status === "daily_cap_reached") {
      await answerCallbackQuery(
        env.BOT_TOKEN,
        cq.id,
        `⚠️ Daily active income cap (${formatRupees(res.cap)}) reached!`,
        true
      );
      return true;
    }

    await answerCallbackQuery(env.BOT_TOKEN, cq.id, `✅ Earned ${formatRupees(res.earned)}!`);

    const receipt =
      `✅ <b>FREELANCE TASK COMPLETED</b>\n\n` +
      `Category: <b>${res.category}</b>\n` +
      `Task: ${res.title}\n` +
      `Payout: <b>${formatRupees(res.earned)}</b>\n\n` +
      `Wallet: <b>${formatRupees(res.newBalance)}</b>\n\n` +
      `Next freelance contract available in 2 hours.`;

    if (messageId) {
      await editMessageText(env.BOT_TOKEN, chatId, messageId, receipt);
    } else {
      await sendMessage(env.BOT_TOKEN, chatId, receipt);
    }
    return true;
  } catch (err) {
    console.error("Freelance callback error:", err);
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Freelance error.", true);
    return true;
  }
}

export const freelanceHandlers: Record<string, CommandHandler> = {
  "/freelance": async (ctx: BotContext) => {
    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const view = await generateOrResumeFreelance(ctx.userId);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      view.text,
      view.replyMarkup,
      ctx.message?.message_id
    );
  },
};
