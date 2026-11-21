import crypto from "crypto";
import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import { DELIVERY_TIERS, ECONOMY_LIMITS } from "../../settings/economy-config";
import {
  acceptDeliveryOrder,
  completeDeliveryOrderTx,
  createDeliveryOrder,
  DeliveryOrderRow,
  getDeliveryState,
  skipDeliveryOrder,
} from "../../database/active-income";
import { getInventory } from "../../database/inventory";
import { ensureUserExists } from "../../database/users";
import { formatRupees, getShopItemById } from "./market-pricing";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
} from "../../telegram/messages";

function formatDurationCompact(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m > 0) return `${m}m ${rem}s`;
  return `${rem}s`;
}

async function userOwnsVehicle(userId: number): Promise<boolean> {
  const inv = await getInventory(userId);
  for (const entry of inv) {
    if (entry.quantity <= 0) continue;
    const item = getShopItemById(entry.item_name);
    if (item && (item.category === "cars" || item.category === "bikes")) {
      return true;
    }
  }
  return false;
}

function buildOrderCard(
  ownerId: number,
  order: DeliveryOrderRow,
  hasVehicle: boolean,
  now: number
): { text: string; replyMarkup: { inline_keyboard: any[][] } } {
  const remainingSec = Math.max(0, order.expires_at - now);
  const totalReward = order.base_reward + order.vehicle_bonus;
  const bonusLine =
    order.vehicle_bonus > 0
      ? `\nVehicle bonus (+15%): <b>+${formatRupees(order.vehicle_bonus)}</b>`
      : "";
  const reqVehicleText = hasVehicle ? "Active (+15% Speed Bonus)" : "Standard (None required)";

  if (order.status === "accepted") {
    const text =
      `🚚 <b>DELIVERY IN PROGRESS</b>\n\n` +
      `Order: <b>${order.title}</b>\n` +
      `Destination: <b>${order.destination}</b>\n` +
      `Total payout: <b>${formatRupees(totalReward)}</b>${bonusLine}\n\n` +
      `Expires in: <b>${formatDurationCompact(remainingSec)}</b>`;

    return {
      text,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: "🏁 Complete Delivery", callback_data: `del:${ownerId}:done:${order.order_id}` },
            { text: "❌ Cancel", callback_data: `del:${ownerId}:skip:${order.order_id}` },
          ],
        ],
      },
    };
  }

  const text =
    `📦 <b>DELIVERY AVAILABLE</b>\n\n` +
    `Order: <b>${order.title}</b>\n` +
    `Destination: <b>${order.destination}</b>\n\n` +
    `Vehicle status: ${reqVehicleText}\n` +
    `Reward: <b>${formatRupees(totalReward)}</b>${bonusLine}\n` +
    `Expires in: <b>${formatDurationCompact(remainingSec)}</b>`;

  return {
    text,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "✅ Accept Order", callback_data: `del:${ownerId}:accept:${order.order_id}` },
          { text: "❌ Skip", callback_data: `del:${ownerId}:skip:${order.order_id}` },
        ],
      ],
    },
  };
}

async function generateOrResumeDelivery(
  ownerId: number
): Promise<{ text: string; replyMarkup?: { inline_keyboard: any[][] } }> {
  const now = Math.floor(Date.now() / 1000);
  const state = await getDeliveryState(ownerId, now);
  const hasVehicle = await userOwnsVehicle(ownerId);

  if (state.activeOrder) {
    return buildOrderCard(ownerId, state.activeOrder, hasVehicle, now);
  }

  const elapsed = now - state.lastDeliveryAt;
  if (state.lastDeliveryAt > 0 && elapsed < ECONOMY_LIMITS.DELIVERY_COOLDOWN_SEC) {
    const waitSec = ECONOMY_LIMITS.DELIVERY_COOLDOWN_SEC - elapsed;
    return {
      text:
        `📦 <b>DELIVERY DISPATCH</b>\n\n` +
        `No new orders right now.\n` +
        `Next dispatch available in <b>${formatDurationCompact(waitSec)}</b>.`,
    };
  }

  const eligibleTiers = DELIVERY_TIERS.filter((t) => !t.requiresVehicle || hasVehicle);
  const chosen = eligibleTiers[Math.floor(Math.random() * eligibleTiers.length)];
  const destination =
    chosen.destinations[Math.floor(Math.random() * chosen.destinations.length)];
  const vehicleBonus = hasVehicle
    ? Math.floor(chosen.baseReward * ECONOMY_LIMITS.DELIVERY_VEHICLE_BONUS_RATE)
    : 0;

  const orderId = `ord_${crypto.randomBytes(5).toString("hex")}`;
  const created = await createDeliveryOrder({
    order_id: orderId,
    user_id: ownerId,
    delivery_type: chosen.id,
    title: chosen.title,
    destination,
    base_reward: chosen.baseReward,
    vehicle_bonus: vehicleBonus,
    expires_at: now + ECONOMY_LIMITS.DELIVERY_EXPIRY_SEC,
    created_at: now,
  });

  return buildOrderCard(ownerId, created, hasVehicle, now);
}

export async function handleDeliveryCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (!data.startsWith("del:")) return false;

  const clickerId = cq.from?.id;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  if (!clickerId || !chatId) return false;

  const parts = data.split(":");
  const ownerId = Number(parts[1]);
  const action = parts[2];
  const orderId = parts[3] || "";

  if (!Number.isInteger(ownerId) || ownerId <= 0 || !action) {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Expired or invalid delivery.", true);
    return true;
  }

  if (clickerId !== ownerId) {
    await answerCallbackQuery(
      env.BOT_TOKEN,
      cq.id,
      "⚠️ This delivery dispatch belongs to another player. Send /delivery to get yours!",
      true
    );
    return true;
  }

  try {
    await ensureUserExists(clickerId, cq.from?.first_name);
    const now = Math.floor(Date.now() / 1000);

    if (action === "accept") {
      const res = await acceptDeliveryOrder(ownerId, orderId, now);
      if (res.status !== "ok") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ This delivery order has expired.", true);
        return true;
      }

      await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Order accepted! Complete your route.");
      const hasVehicle = await userOwnsVehicle(ownerId);
      const card = buildOrderCard(ownerId, res.order, hasVehicle, now);
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, card.text, card.replyMarkup);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, card.text, card.replyMarkup);
      }
      return true;
    }

    if (action === "skip") {
      await skipDeliveryOrder(ownerId, orderId);
      await answerCallbackQuery(env.BOT_TOKEN, cq.id, "❌ Order skipped.");
      const text =
        `❌ <b>DELIVERY SKIPPED</b>\n\n` +
        `Use <code>/delivery</code> whenever you are ready for another order.`;
      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, text);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, text);
      }
      return true;
    }

    if (action === "done") {
      const res = await completeDeliveryOrderTx(ownerId, orderId, `del_cq_${cq.id}`, now);

      if (res.status === "duplicate" || res.status === "already_completed") {
        await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Delivery already completed.");
        return true;
      }

      if (res.status === "expired_or_invalid") {
        await answerCallbackQuery(
          env.BOT_TOKEN,
          cq.id,
          "⚠️ Order expired or not accepted yet.",
          true
        );
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

      const bonusNote =
        res.vehicleBonus > 0
          ? `\nVehicle bonus: <b>+${formatRupees(res.vehicleBonus)}</b>`
          : "";

      const receipt =
        `✅ <b>DELIVERY COMPLETED</b>\n\n` +
        `Order: <b>${res.title}</b>\n` +
        `Destination: <b>${res.destination}</b>\n` +
        `Reward earned: <b>${formatRupees(res.earned)}</b>${bonusNote}\n\n` +
        `Wallet: <b>${formatRupees(res.newBalance)}</b>\n\n` +
        `Next dispatch available in 30 minutes.`;

      if (messageId) {
        await editMessageText(env.BOT_TOKEN, chatId, messageId, receipt);
      } else {
        await sendMessage(env.BOT_TOKEN, chatId, receipt);
      }
      return true;
    }

    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⚠️ Invalid action.", true);
    return true;
  } catch (err: any) {
    console.error("Delivery callback error:", err?.message || err, err);
    const detail = err?.message ? String(err.message).slice(0, 140) : "Delivery error.";
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, `⚠️ ${detail}`, true);
    return true;
  }
}

export const deliveryHandlers: Record<string, CommandHandler> = {
  "/delivery": async (ctx: BotContext) => {
    await ensureUserExists(ctx.userId, ctx.message.from?.first_name);
    const view = await generateOrResumeDelivery(ctx.userId);
    await sendMessage(
      ctx.env.BOT_TOKEN,
      ctx.chatId,
      view.text,
      view.replyMarkup,
      ctx.message?.message_id
    );
  },
};
