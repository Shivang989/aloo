export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  is_bot?: boolean;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
}

export interface TelegramChatMember {
  status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked" | string;
  user?: TelegramUser;
  is_anonymous?: boolean;
  custom_title?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  chat: TelegramChat;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  video?: TelegramVideo;
  document?: any;
  audio?: any;
  voice?: any;
  video_note?: any;
  sticker?: any;
  animation?: any;
  poll?: any;
  reply_to_message?: TelegramMessage;
  new_chat_members?: TelegramUser[];
  new_chat_participant?: TelegramUser;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  my_chat_member?: any;
  chat_member?: any;
  chat_join_request?: any;
}

export interface TelegramResponse<T = any> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    retry_after?: number;
    migrate_to_chat_id?: number;
  };
}
