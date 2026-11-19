import { TelegramResponse } from "./types";

export async function callTelegram<T = any>(
  botToken: string,
  endpoint: string,
  payload: Record<string, any> = {}
): Promise<TelegramResponse<T>> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await response.json()) as TelegramResponse<T>;
  } catch (err: any) {
    return {
      ok: false,
      description: err?.message || "Telegram API network failure",
    };
  }
}
