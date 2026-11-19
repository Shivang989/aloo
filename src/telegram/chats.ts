import { callTelegram } from "./client";
import { TelegramResponse } from "./types";

export async function getChat(
  botToken: string,
  chatId: string | number
): Promise<{ ok: boolean; title?: string; first_name?: string; error?: string }> {
  const res = await callTelegram<any>(botToken, "getChat", { chat_id: chatId });
  if (res.ok && res.result) {
    return {
      ok: true,
      title: res.result.title || res.result.username,
      first_name: res.result.first_name,
    };
  }
  return { ok: false, error: res.description || "Chat not found" };
}

export async function getChatMember(
  botToken: string,
  chatId: string | number,
  userId: number
): Promise<{
  ok: boolean;
  status: string | null;
  isMember: boolean;
  firstName?: string;
  error?: string;
}> {
  const res = await callTelegram<{ status: string; is_member?: boolean; user?: { first_name?: string } }>(
    botToken,
    "getChatMember",
    { chat_id: chatId, user_id: userId }
  );

  if (!res.ok) {
    return { ok: false, status: null, isMember: false, error: res.description };
  }

  const status = res.result?.status || null;
  const validStatuses = ["creator", "administrator", "member"];
  let isMember = validStatuses.includes(status || "");

  if (status === "restricted") {
    isMember = res.result?.is_member !== false;
  }

  return {
    ok: true,
    status,
    isMember,
    firstName: res.result?.user?.first_name,
  };
}

export async function promoteChatMember(
  botToken: string,
  params: Record<string, any>
): Promise<TelegramResponse<boolean>> {
  return callTelegram(botToken, "promoteChatMember", params);
}

export async function setChatAdministratorCustomTitle(
  botToken: string,
  chatId: number,
  userId: number,
  customTitle: string
): Promise<TelegramResponse<boolean>> {
  return callTelegram(botToken, "setChatAdministratorCustomTitle", {
    chat_id: chatId,
    user_id: userId,
    custom_title: customTitle,
  });
}

export async function pinChatMessage(
  botToken: string,
  chatId: number,
  messageId: number,
  disableNotification: boolean = false
): Promise<TelegramResponse<boolean>> {
  return callTelegram(botToken, "pinChatMessage", {
    chat_id: chatId,
    message_id: messageId,
    disable_notification: disableNotification,
  });
}

export async function unpinChatMessage(
  botToken: string,
  chatId: number,
  messageId: number
): Promise<TelegramResponse<boolean>> {
  return callTelegram(botToken, "unpinChatMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
}
