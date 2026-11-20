import { callTelegram } from "./client";
import { TelegramResponse } from "./types";

export async function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: Record<string, any>,
  replyToMessageId?: number,
  disableNotification?: boolean
): Promise<TelegramResponse<{ message_id: number }>> {
  const payload: Record<string, any> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  if (replyToMessageId) payload.reply_parameters = { message_id: replyToMessageId };
  if (disableNotification !== undefined) payload.disable_notification = disableNotification;

  return callTelegram(botToken, "sendMessage", payload);
}

export async function editMessageText(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: Record<string, any>
): Promise<TelegramResponse> {
  const payload: Record<string, any> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  return callTelegram(botToken, "editMessageText", payload);
}

export async function editMessageCaption(
  botToken: string,
  chatId: number,
  messageId: number,
  caption: string,
  replyMarkup?: Record<string, any>
): Promise<TelegramResponse> {
  const payload: Record<string, any> = {
    chat_id: chatId,
    message_id: messageId,
    caption,
    parse_mode: "HTML",
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  return callTelegram(botToken, "editMessageCaption", payload);
}

export async function editMessageReplyMarkup(
  botToken: string,
  chatId: number,
  messageId: number,
  replyMarkup?: Record<string, any>
): Promise<TelegramResponse> {
  return callTelegram(botToken, "editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
}

export async function sendPhoto(
  botToken: string,
  chatId: number,
  photoFileId: string,
  caption?: string,
  replyMarkup?: Record<string, any>
): Promise<TelegramResponse<{ message_id: number }>> {
  const payload: Record<string, any> = {
    chat_id: chatId,
    photo: photoFileId,
    parse_mode: "HTML",
  };
  if (caption) payload.caption = caption;
  if (replyMarkup) payload.reply_markup = replyMarkup;

  return callTelegram(botToken, "sendPhoto", payload);
}

export async function sendVideo(
  botToken: string,
  chatId: number,
  videoFileId: string,
  caption?: string,
  replyMarkup?: Record<string, any>
): Promise<TelegramResponse<{ message_id: number }>> {
  const payload: Record<string, any> = {
    chat_id: chatId,
    video: videoFileId,
    parse_mode: "HTML",
  };
  if (caption) payload.caption = caption;
  if (replyMarkup) payload.reply_markup = replyMarkup;

  return callTelegram(botToken, "sendVideo", payload);
}

export async function sendAnimation(
  botToken: string,
  chatId: number,
  animationFileId: string,
  caption?: string,
  replyMarkup?: Record<string, any>
): Promise<TelegramResponse<{ message_id: number; animation?: { file_id: string }; document?: { file_id: string } }>> {
  const payload: Record<string, any> = {
    chat_id: chatId,
    animation: animationFileId,
    parse_mode: "HTML",
  };
  if (caption) payload.caption = caption;
  if (replyMarkup) payload.reply_markup = replyMarkup;

  return callTelegram(botToken, "sendAnimation", payload);
}

export async function sendAnimationBuffer(
  botToken: string,
  chatId: number,
  gifBuffer: Buffer,
  fileName: string,
  caption?: string,
  replyMarkup?: Record<string, any>
): Promise<TelegramResponse<{ message_id: number; animation?: { file_id: string }; document?: { file_id: string } }>> {
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("animation", new Blob([new Uint8Array(gifBuffer)], { type: "image/gif" }), fileName);
    if (caption) {
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
    }
    if (replyMarkup) {
      form.append("reply_markup", JSON.stringify(replyMarkup));
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendAnimation`, {
      method: "POST",
      body: form,
    });
    return (await response.json()) as TelegramResponse<{
      message_id: number;
      animation?: { file_id: string };
      document?: { file_id: string };
    }>;
  } catch (err: any) {
    return {
      ok: false,
      description: err?.message || "Telegram animation upload failure",
    };
  }
}

export async function deleteMessage(
  botToken: string,
  chatId: number,
  messageId: number
): Promise<boolean> {
  const res = await callTelegram(botToken, "deleteMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
  return res.ok;
}

export async function copyMessage(
  botToken: string,
  params: {
    chat_id: number;
    from_chat_id: number;
    message_id: number;
    reply_markup?: any;
    disable_notification?: boolean;
    protect_content?: boolean;
  }
): Promise<TelegramResponse<{ message_id: number }>> {
  return callTelegram(botToken, "copyMessage", params);
}

export async function forwardMessage(
  botToken: string,
  params: {
    chat_id: number;
    from_chat_id: number;
    message_id: number;
    disable_notification?: boolean;
    protect_content?: boolean;
  }
): Promise<TelegramResponse<{ message_id: number }>> {
  return callTelegram(botToken, "forwardMessage", params);
}

export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
): Promise<TelegramResponse<boolean>> {
  return callTelegram(botToken, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}
