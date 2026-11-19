import { TelegramChat, TelegramUpdate, TelegramUser } from "../../telegram/types";
import {
  trackDestination,
  trackUser,
  trackGroupMember,
  updateChatMemberStatus,
} from "../../database/broadcast-data";

export async function trackIncomingTraffic(
  chat: TelegramChat,
  from: TelegramUser
): Promise<void> {
  await trackDestination(chat);
  if (chat.type === "private") {
    await trackUser(from);
  } else {
    await trackGroupMember(chat.id, from);
  }
}

export async function handleChatMemberUpdated(update: TelegramUpdate): Promise<void> {
  const myChatMember = update.my_chat_member;
  if (!myChatMember) return;

  const chat = myChatMember.chat;
  if (!chat || chat.type === "private") return;

  const newStatus = myChatMember.new_chat_member?.status;
  const canSend = ["member", "administrator", "creator"].includes(newStatus) ? 1 : 0;
  const canPin = myChatMember.new_chat_member?.can_pin_messages ? 1 : 0;

  await updateChatMemberStatus(chat, canSend, canPin);
}
