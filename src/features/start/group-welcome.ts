import { RuntimeEnv } from "../../types/environment";
import { TelegramMessage, TelegramUser } from "../../telegram/types";
import { ensureUserExists } from "../../database/users";
import { escapeHtml } from "../../ui/fancy-text";
import { sendMessage } from "../../telegram/messages";

export async function handleGroupWelcome(
  env: RuntimeEnv,
  message: TelegramMessage,
  members?: TelegramUser[]
): Promise<void> {
  const memberList = members || message.new_chat_members || [];
  if (memberList.length === 0) return;

  for (const member of memberList) {
    if (member.is_bot) continue;

    await ensureUserExists(member.id, member.first_name);

    const safeName = escapeHtml(member.first_name?.trim() || "Member");
    const mention = `<a href="tg://user?id=${member.id}">${safeName}</a>`;

    await sendMessage(
      env.BOT_TOKEN,
      message.chat.id,
      `Welcome, ${mention}\n\nType /help to explore.`
    );
  }
}
