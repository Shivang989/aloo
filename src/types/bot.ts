import { RuntimeEnv } from "./environment";
import { TelegramMessage, TelegramUpdate } from "../telegram/types";

export interface BotContext {
  env: RuntimeEnv;
  update: TelegramUpdate;
  message: TelegramMessage;
  chatId: number;
  userId: number;
  text: string;
  command: string;
  args: string[];
  reply?: TelegramMessage;
}

export type CommandHandler = (ctx: BotContext) => Promise<void>;
