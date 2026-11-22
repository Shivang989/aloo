import { BotContext, CommandHandler } from "../../types/bot";
import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import { getTopPlayers, syncUserFirstName } from "../../database/users";
import { getTopWealthLeaderboard } from "../../database/investments-and-bank";
import { getChat, getChatMember } from "../../telegram/chats";
import { escapeHtml } from "../../ui/fancy-text";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
} from "../../telegram/messages";

const RANK_SYMBOLS = ["🥇", "🥈", "🥉", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
const NAME_COLUMN_WIDTH = 15;

/**
 * Formats amounts using the Indian Numbering System:
 * - Below ₹1,00,000 (1 Lakh): exact rupee amount (e.g., ₹85400, ₹12500, ₹900)
 * - ₹1,00,000+ : Indian units only (Lakh, Crore, Arab, Kharab)
 */
export function formatIndianLeaderboardWealth(amount: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));

  if (safe < 100_000) {
    return `₹${safe}`;
  }

  const units: Array<{ divisor: number; label: string }> = [
    { divisor: 100_000_000_000, label: "Kharab" }, // 10^11
    { divisor: 1_000_000_000, label: "Arab" },     // 10^9
    { divisor: 10_000_000, label: "Crore" },       // 10^7
    { divisor: 100_000, label: "Lakh" },           // 10^5
  ];

  for (const u of units) {
    if (safe >= u.divisor) {
      const scaled = Number((safe / u.divisor).toFixed(2));
      return `₹${scaled} ${u.label}`;
    }
  }

  return `₹${safe}`;
}

function getCharDisplayWidth(ch: string): number {
  if (/\p{M}/u.test(ch)) {
    return 0;
  }
  const cp = ch.codePointAt(0) ?? 0;
  if (
    cp >= 0x1f300 ||
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x9fff) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xff01 && cp <= 0xff60)
  ) {
    return 2;
  }
  return 1;
}

/**
 * Truncates display names to max 15 display columns (using "..." when truncated)
 * and pads with spaces to a compact fixed width so mobile rows never wrap.
 */
export function formatFixedWidthName(rawName: string, maxCols: number = NAME_COLUMN_WIDTH): string {
  const clean = (rawName || "Player").replace(/[\r\n\t]+/g, " ").trim() || "Player";
  const chars = Array.from(clean);

  let totalCols = 0;
  for (const ch of chars) {
    totalCols += getCharDisplayWidth(ch);
  }

  if (totalCols <= maxCols) {
    return clean + " ".repeat(maxCols - totalCols);
  }

  const targetCols = maxCols - 3; // Reserve 3 columns for "..."
  let acc = "";
  let usedCols = 0;
  for (const ch of chars) {
    const w = getCharDisplayWidth(ch);
    if (usedCols + w > targetCols) break;
    acc += ch;
    usedCols += w;
  }

  const truncated = `${acc}...`;
  const finalCols = usedCols + 3;
  return truncated + " ".repeat(Math.max(0, maxCols - finalCols));
}

async function resolveRawPlayerName(
  env: RuntimeEnv,
  userId: number,
  storedFirstName: string | null | undefined,
  chatId?: number
): Promise<string> {
  let rawName: string | undefined = storedFirstName?.trim() || undefined;

  if (!rawName && chatId && chatId < 0) {
    const member = await getChatMember(env.BOT_TOKEN, chatId, userId);
    if (member.ok && member.firstName) {
      rawName = member.firstName;
    }
  }

  if (!rawName) {
    const chat = await getChat(env.BOT_TOKEN, userId);
    if (chat.ok && chat.first_name) {
      rawName = chat.first_name;
    }
  }

  if (rawName && !storedFirstName) {
    try {
      await syncUserFirstName(userId, rawName);
    } catch {
      // Ignore non-critical backfill error
    }
  }

  return (rawName || "Player").trim();
}

export interface LeaderboardEntry {
  userId: number;
  rawName: string;
  amount: number;
}

export function renderLeaderboardMessage(
  mode: "richest" | "networth",
  entries: LeaderboardEntry[]
): { text: string; replyMarkup: { inline_keyboard: any[][] } } {
  const heading =
    mode === "richest"
      ? "🏆𝐖ⱺ𝗋ᥣᑯ 𝐓ⱺρ 𝐑𝗂𝖼ɦ𝖾𝗌𝗍 :"
      : "🌍𝐖ⱺ𝗋ᥣᑯ 𝐓ⱺρ 𝐍𝖾𝗍 𝐖ⱺ𝗋𝗍ɦ :";

  const toggleButton =
    mode === "richest"
      ? { text: "🌍 World Top Net Worth", callback_data: "lb:net" }
      : { text: "🏆 World Top Richest", callback_data: "lb:rich" };

  const replyMarkup = {
    inline_keyboard: [[toggleButton]],
  };

  if (entries.length === 0) {
    const text =
      `${heading}\n\n` +
      `★━━══━━── • ──━━══━━★\n\n` +
      `No players registered yet.\n\n` +
      `★━━══━━── • ──━━══━━★`;
    return { text, replyMarkup };
  }

  const rows: string[] = [];

  entries.forEach((entry, idx) => {
    const rankSymbol = RANK_SYMBOLS[idx] || `${idx + 1}.`;
    const paddedName = formatFixedWidthName(entry.rawName, NAME_COLUMN_WIDTH);
    const safeName = escapeHtml(paddedName);
    const formattedWealth = formatIndianLeaderboardWealth(entry.amount);

    // Keep <code> inside <a> so Telegram renders both clickable mention and monospace alignment
    rows.push(
      `<code>${rankSymbol} </code><a href="tg://user?id=${entry.userId}"><code>${safeName}</code></a><code> ➤ ${formattedWealth}</code>`
    );

    // Exclusive decorative bottom lining ONLY for 1st and 2nd positions
    if (idx === 0 || idx === 1) {
      rows.push("╰────────────────");
    }
  });

  const text =
    `${heading}\n\n` +
    `★━━══━━── • ──━━══━━★\n\n` +
    `${rows.join("\n")}\n\n` +
    `★━━══━━── • ──━━══━━★`;

  return { text, replyMarkup };
}

export async function buildWorldRichestView(
  env: RuntimeEnv,
  chatId?: number
): Promise<{ text: string; replyMarkup: { inline_keyboard: any[][] } }> {
  const topPlayers = await getTopPlayers(5);
  const entries: LeaderboardEntry[] = await Promise.all(
    topPlayers.map(async (p) => ({
      userId: p.user_id,
      rawName: await resolveRawPlayerName(env, p.user_id, p.first_name, chatId),
      amount: p.balance ?? 0,
    }))
  );
  return renderLeaderboardMessage("richest", entries);
}

export async function buildWorldNetWorthView(
  env: RuntimeEnv,
  chatId?: number
): Promise<{ text: string; replyMarkup: { inline_keyboard: any[][] } }> {
  const topNetWorth = await getTopWealthLeaderboard(5);
  const entries: LeaderboardEntry[] = await Promise.all(
    topNetWorth.map(async (p) => ({
      userId: p.user_id,
      rawName: await resolveRawPlayerName(env, p.user_id, p.first_name, chatId),
      amount: p.net_worth ?? 0,
    }))
  );
  return renderLeaderboardMessage("networth", entries);
}

export async function handleLeaderboardCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (data !== "lb:net" && data !== "lb:rich") return false;

  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  if (!chatId) return false;

  try {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id);

    const view =
      data === "lb:net"
        ? await buildWorldNetWorthView(env, chatId)
        : await buildWorldRichestView(env, chatId);

    if (messageId) {
      await editMessageText(env.BOT_TOKEN, chatId, messageId, view.text, view.replyMarkup);
    } else {
      await sendMessage(env.BOT_TOKEN, chatId, view.text, view.replyMarkup);
    }
    return true;
  } catch (err) {
    console.error("Leaderboard toggle callback error:", err);
    return true;
  }
}

const handleRichestLeaderboard: CommandHandler = async (ctx: BotContext) => {
  const view = await buildWorldRichestView(ctx.env, ctx.chatId);
  await sendMessage(
    ctx.env.BOT_TOKEN,
    ctx.chatId,
    view.text,
    view.replyMarkup,
    ctx.message?.message_id
  );
};

const handleNetWorthLeaderboard: CommandHandler = async (ctx: BotContext) => {
  const view = await buildWorldNetWorthView(ctx.env, ctx.chatId);
  await sendMessage(
    ctx.env.BOT_TOKEN,
    ctx.chatId,
    view.text,
    view.replyMarkup,
    ctx.message?.message_id
  );
};

export const leaderboardHandlers: Record<string, CommandHandler> = {
  "/top": handleRichestLeaderboard,
  "/leaderboard": handleRichestLeaderboard,
  "/net": handleNetWorthLeaderboard,
};
