import {
  getAudienceCounts,
  getRunningCampaignCount,
  resolveEligibleAudience,
} from "../../database/broadcast-data";
import { sendMessage, editMessageText } from "../../telegram/messages";
import { AudienceTarget, BroadcastDraft } from "./types";

export function formatTargetLabel(target: AudienceTarget): string {
  if (target === "dm") return "👤 DM Only (Users)";
  if (target === "groups") return "👥 Groups Only";
  return "🌐 Groups + DM (Everywhere)";
}

export async function renderDashboard(
  botToken: string,
  chatId: number,
  messageId?: number
): Promise<void> {
  const counts = await getAudienceCounts();
  const total = counts.dmCount + counts.groupCount;
  const activeCount = await getRunningCampaignCount();

  const text =
    `📢 <b>ALOO BROADCAST PANEL</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Users (DM):</b> <code>${counts.dmCount}</code>\n` +
    `👥 <b>Groups:</b> <code>${counts.groupCount}</code>\n` +
    `🌐 <b>Total (Groups + DM):</b> <code>${total}</code>\n` +
    `⚡ <b>Active Campaigns:</b> <code>${activeCount}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👇 <b>Choose where to send your broadcast:</b>`;

  const kb = {
    inline_keyboard: [
      [
        { text: `👤 DM Only (${counts.dmCount})`, callback_data: "bc:target:dm" },
        { text: `👥 Groups Only (${counts.groupCount})`, callback_data: "bc:target:groups" },
      ],
      [{ text: `🌐 Groups + DM (${total})`, callback_data: "bc:target:all" }],
      [
        { text: "📊 Active", callback_data: "bc:active" },
        { text: "📜 History", callback_data: "bc:hist" },
        { text: "🔄 Refresh", callback_data: "bc:dash" },
      ],
    ],
  };

  if (messageId) {
    await editMessageText(botToken, chatId, messageId, text, kb);
  } else {
    await sendMessage(botToken, chatId, text, kb);
  }
}

export async function renderOptionsStep(
  botToken: string,
  chatId: number,
  draft: BroadcastDraft,
  messageId?: number
): Promise<void> {
  const pinDisplay =
    draft.pinMode === "none" ? "OFF" : draft.pinMode === "quiet" ? "QUIET" : "LOUD 🔔";
  const tagDisplay = draft.tagAllEnabled ? "ON ✅" : "OFF";
  const silentDisplay = draft.isSilent ? "YES 🔕" : "NO 🔔";
  const contentTypeLabel = (draft.items[0]?.type || "message").toUpperCase();

  const audience = await resolveEligibleAudience(draft.audienceFilter);
  const includesGroups = draft.audienceFilter === "groups" || draft.audienceFilter === "all";

  const text =
    `⚙️ <b>CONFIRM BROADCAST SETTINGS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 <b>Target:</b> ${formatTargetLabel(draft.audienceFilter)}\n` +
    `📨 <b>Recipients:</b> <code>${audience.length}</code>\n` +
    `📦 <b>Content Type:</b> <code>${contentTypeLabel}</code>\n` +
    `🔄 <b>Send Mode:</b> <code>${draft.mode.toUpperCase()}</code>\n` +
    `📌 <b>Pin Message:</b> <code>${pinDisplay}</code>\n` +
    (includesGroups ? `📢 <b>Tag All (Groups):</b> <code>${tagDisplay}</code>\n` : "") +
    `🔕 <b>Silent Mode:</b> <code>${silentDisplay}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Configure options below or tap <b>Confirm & Broadcast</b>:`;

  const row2 = [];
  if (includesGroups) {
    row2.push({ text: `📢 Tag All: ${tagDisplay}`, callback_data: "bc:toggle_opt:tag" });
  }
  row2.push({ text: `🔕 Silent: ${silentDisplay}`, callback_data: "bc:toggle_opt:silent" });

  const kb = {
    inline_keyboard: [
      [
        {
          text: `🔄 Mode: ${draft.mode.toUpperCase()}`,
          callback_data: `bc:set_mode:${draft.mode === "copy" ? "forward" : "copy"}`,
        },
        { text: `📌 Pin: ${pinDisplay}`, callback_data: "bc:toggle_opt:pin" },
      ],
      row2,
      [{ text: "👁 Send Test to My DM", callback_data: "bc:test_send" }],
      [
        { text: "🚀 Confirm & Broadcast", callback_data: "bc:confirm_run" },
        { text: "❌ Cancel", callback_data: "bc:dash" },
      ],
    ],
  };

  if (messageId) {
    await editMessageText(botToken, chatId, messageId, text, kb);
  } else {
    await sendMessage(botToken, chatId, text, kb);
  }
}
