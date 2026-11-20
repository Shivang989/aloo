import { BotContext } from "../types/bot";
import { RuntimeEnv } from "../types/environment";
import { TelegramUpdate } from "../telegram/types";
import { answerCallbackQuery, sendMessage } from "../telegram/messages";
import { ensureUserExists, syncUserFirstName } from "../database/users";
import { checkRateLimit } from "../database/cache";
import { handleGroupWelcome } from "../features/start/group-welcome";
import { handleSafeCallback } from "../features/money/protection";
import { handleMarketCallback } from "../features/money/market";
import { handleWorkCallback } from "../features/money/work";
import { handleDeliveryCallback } from "../features/money/delivery";
import { handleFreelanceCallback } from "../features/money/freelance";
import { handleMissionCallback } from "../features/money/missions";
import { handleBusinessCallback } from "../features/money/business";
import { handlePropertyCallback } from "../features/money/property";
import { handleBankCallback } from "../features/money/bank";
import { handleEconomyCallback } from "../features/money/economy-dashboard";
import { handleGenderCallback } from "../features/money/gender";
import { handleDMUICallback } from "../features/dm-menu/callbacks";
import { handleDMUITextInput } from "../features/dm-menu/text-input";
import { handleDMUIMediaInput } from "../features/dm-menu/media-input";
import {
  trackIncomingTraffic,
  handleChatMemberUpdated,
} from "../features/broadcast/recipient-tracking";
import { handleBroadcastCallback } from "../features/broadcast/callbacks";
import { handleBroadcastMessageInput } from "../features/broadcast/message-input";
import { handleForceSubCheck } from "../features/force-join/membership-check";
import { handleJoinRequest } from "../features/force-join/join-requests";
import { COMMAND_REGISTRY } from "./command-list";

export async function routeTelegramUpdate(
  update: TelegramUpdate,
  env: RuntimeEnv
): Promise<void> {
  // 1. Bot membership changes in groups and channels
  if (update.my_chat_member) {
    await handleChatMemberUpdated(update);
    return;
  }

  // 2. Track Join Requests for Force Join verification
  if (update.chat_join_request) {
    await handleJoinRequest(update);
    return;
  }

  // 3. Callback Queries from inline buttons
  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data || "";

    if (data.startsWith("dm_cmd:")) {
      const cmd = data.replace("dm_cmd:", "");
      const handler = COMMAND_REGISTRY[cmd];
      await answerCallbackQuery(env.BOT_TOKEN, cq.id);
      if (handler && cq.message && cq.from) {
        const ctx: BotContext = {
          env,
          update,
          message: { ...cq.message, from: cq.from },
          chatId: cq.message.chat.id,
          userId: cq.from.id,
          text: cmd,
          command: cmd,
          args: [],
        };
        await handler(ctx);
      }
      return;
    }

    if (await handleBroadcastCallback(env, cq)) return;
    if (await handleDMUICallback(env, cq)) return;
    if (await handleSafeCallback(env, cq)) return;
    if (await handleMarketCallback(env, cq)) return;
    if (await handleWorkCallback(env, cq)) return;
    if (await handleDeliveryCallback(env, cq)) return;
    if (await handleFreelanceCallback(env, cq)) return;
    if (await handleMissionCallback(env, cq)) return;
    if (await handleBusinessCallback(env, cq)) return;
    if (await handlePropertyCallback(env, cq)) return;
    if (await handleBankCallback(env, cq)) return;
    if (await handleEconomyCallback(env, cq)) return;
    if (await handleGenderCallback(env, cq)) return;
    return;
  }

  // 4. Message validation & extraction
  const message = update.message;
  if (!message || !message.from) return;

  const chatId = message.chat.id;
  const userId = message.from.id;

  // 5. Track chat & user in aloo_ops for broadcasts
  await trackIncomingTraffic(message.chat, message.from);

  // 6. Ensure user exists in aloo_core & keep first_name synced
  await ensureUserExists(userId, message.from.first_name);

  if (
    message.reply_to_message?.from &&
    !message.reply_to_message.from.is_bot &&
    message.reply_to_message.from.first_name
  ) {
    await syncUserFirstName(
      message.reply_to_message.from.id,
      message.reply_to_message.from.first_name
    );
  }

  // 7. Welcome new members in groups
  const newMembers =
    message.new_chat_members ||
    (message.new_chat_participant ? [message.new_chat_participant] : []);
  if (newMembers.length > 0) {
    await handleGroupWelcome(env, message, newMembers);
    return;
  }

  const ctx: BotContext = {
    env,
    update,
    message,
    chatId,
    userId,
    text: message.text || message.caption || "",
    command: "",
    args: [],
    reply: message.reply_to_message,
  };

  // 8. Force-Join Interceptor (bypass setup commands)
  const cleanText = (ctx.text || "").trim().toLowerCase();
  const isSetupCommand =
    cleanText.startsWith("/add") ||
    cleanText.startsWith("/approved") ||
    cleanText.startsWith("/empty");

  if (!isSetupCommand) {
    if (await handleForceSubCheck(ctx)) return;
  }

  // 9. Intercept owner inputs for broadcast content creation
  if (await handleBroadcastMessageInput(ctx)) return;

  // 10. Intercept media inputs for DMUI
  const rawMsg = message as any;
  const isGifDocument =
    rawMsg.document &&
    (rawMsg.document.mime_type === "image/gif" ||
      (rawMsg.document.file_name && rawMsg.document.file_name.toLowerCase().endsWith(".gif")));

  if (rawMsg.photo || rawMsg.video || rawMsg.animation || isGifDocument) {
    if (await handleDMUIMediaInput(ctx)) return;
  }

  const rawText = message.text?.trim();
  if (!rawText) return;

  // 11. Intercept DMUI text setup
  if (await handleDMUITextInput(ctx)) return;

  // 12. Command Dispatcher with Redis rate-limit protection
  if (rawText.startsWith("/")) {
    const parts = rawText.split(/\s+/);
    const command = parts[0].toLowerCase().split("@")[0];
    const args = parts.slice(1);

    ctx.command = command;
    ctx.args = args;

    const handler = COMMAND_REGISTRY[command];
    if (handler) {
      const isOwner = String(userId).trim() === String(env.OWNER_ID).trim();
      if (!isOwner) {
        const rate = await checkRateLimit(`rl:cmd:${userId}`, 8, 10);
        if (!rate.allowed) {
          await sendMessage(
            env.BOT_TOKEN,
            chatId,
            "⏳ <b>Slow down!</b> Please wait a few seconds before sending more commands.",
            undefined,
            message.message_id
          );
          return;
        }
      }

      try {
        await handler(ctx);
      } catch (error) {
        console.error(`Command execution failure on ${command}:`, error);
      }
    }
  }
}
