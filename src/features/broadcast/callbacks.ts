import { RuntimeEnv } from "../../types/environment";
import { TelegramCallbackQuery } from "../../telegram/types";
import {
  clearBroadcastWizard,
  upsertBroadcastWizard,
  getBroadcastWizard,
  updateBroadcastWizardDraft,
  resolveEligibleAudience,
  launchCampaignTx,
  listCampaignsByStatuses,
  getCampaignById,
  getCampaignStats,
  setCampaignStatus,
  cancelCampaignJobs,
} from "../../database/broadcast-data";
import {
  editMessageText,
  answerCallbackQuery,
  copyMessage,
  forwardMessage,
} from "../../telegram/messages";
import { AudienceTarget, BroadcastDraft } from "./types";
import { renderDashboard, renderOptionsStep, formatTargetLabel } from "./dashboard";
import { isBroadcastOwner } from "./commands";
import { wakeBroadcastWorker } from "../../workers/broadcast-worker";

export async function handleBroadcastCallback(
  env: RuntimeEnv,
  cq: TelegramCallbackQuery
): Promise<boolean> {
  const data = cq.data || "";
  if (!data.startsWith("bc:")) return false;

  const userId = cq.from?.id;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;

  if (!userId || !chatId || !isBroadcastOwner(userId, env.OWNER_ID)) {
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⛔ Owner authorization required.", true);
    return true;
  }

  if (!messageId) return true;

  const parts = data.split(":");
  const action = parts[1];

  if (action === "dash") {
    await clearBroadcastWizard(userId);
    await answerCallbackQuery(env.BOT_TOKEN, cq.id);
    await renderDashboard(env.BOT_TOKEN, chatId, messageId);
    return true;
  }

  if (action === "target") {
    const selectedTarget = (parts[2] as AudienceTarget) || "all";
    const campaignId = `bc_${Date.now().toString(36)}`;

    const draft: BroadcastDraft = {
      campaignId,
      name: `Broadcast ${new Date().toISOString().slice(0, 10)}`,
      audienceFilter: selectedTarget,
      mode: "copy",
      contentType: "single",
      items: [],
      buttons: [],
      pinMode: "none",
      pinItemIndex: 0,
      tagAllEnabled: false,
      isSilent: false,
      protectContent: false,
      disableLinkPreview: false,
    };

    await upsertBroadcastWizard(userId, "AWAIT_CONTENT", campaignId, draft);
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, `Selected: ${formatTargetLabel(selectedTarget)}`);
    await editMessageText(
      env.BOT_TOKEN,
      chatId,
      messageId,
      `📤 <b>SEND BROADCAST MESSAGE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🎯 <b>Target:</b> ${formatTargetLabel(selectedTarget)}\n\n` +
        `Now <b>send or forward</b> the message you want to broadcast into this chat.\n\n` +
        `<i>Supported: Text, Photo, Video, Sticker, GIF, Audio, Voice, Document, or Poll.</i>`,
      {
        inline_keyboard: [[{ text: "🔙 Change Target / Cancel", callback_data: "bc:dash" }]],
      }
    );
    return true;
  }

  if (action === "set_mode") {
    const selectedMode = parts[2] as "copy" | "forward";
    const wiz = await getBroadcastWizard(userId);
    if (!wiz) return true;

    wiz.draft.mode = selectedMode;
    await updateBroadcastWizardDraft(userId, wiz.draft);

    await answerCallbackQuery(env.BOT_TOKEN, cq.id, `Mode: ${selectedMode.toUpperCase()}`);
    await renderOptionsStep(env.BOT_TOKEN, chatId, wiz.draft, messageId);
    return true;
  }

  if (action === "toggle_opt") {
    const opt = parts[2];
    const wiz = await getBroadcastWizard(userId);
    if (!wiz) return true;

    if (opt === "pin") {
      wiz.draft.pinMode =
        wiz.draft.pinMode === "none" ? "quiet" : wiz.draft.pinMode === "quiet" ? "loud" : "none";
    } else if (opt === "tag") {
      wiz.draft.tagAllEnabled = !wiz.draft.tagAllEnabled;
    } else if (opt === "silent") {
      wiz.draft.isSilent = !wiz.draft.isSilent;
    }

    await updateBroadcastWizardDraft(userId, wiz.draft);
    await answerCallbackQuery(env.BOT_TOKEN, cq.id);
    await renderOptionsStep(env.BOT_TOKEN, chatId, wiz.draft, messageId);
    return true;
  }

  if (action === "test_send") {
    const wiz = await getBroadcastWizard(userId);
    if (!wiz) return true;

    for (const item of wiz.draft.items) {
      if (wiz.draft.mode === "forward" || item.type === "poll") {
        await forwardMessage(env.BOT_TOKEN, {
          chat_id: userId,
          from_chat_id: item.from_chat_id,
          message_id: item.message_id,
        });
      } else {
        await copyMessage(env.BOT_TOKEN, {
          chat_id: userId,
          from_chat_id: item.from_chat_id,
          message_id: item.message_id,
          reply_markup:
            wiz.draft.buttons.length > 0 ? { inline_keyboard: wiz.draft.buttons } : undefined,
        });
      }
    }
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "✅ Test preview sent!", true);
    return true;
  }

  if (action === "confirm_run") {
    const wiz = await getBroadcastWizard(userId);
    if (!wiz) return true;

    const audience = await resolveEligibleAudience(wiz.draft.audienceFilter);
    if (audience.length === 0) {
      await answerCallbackQuery(
        env.BOT_TOKEN,
        cq.id,
        "⚠️ No eligible recipients found for this target!",
        true
      );
      return true;
    }

    await launchCampaignTx(userId, wiz.draft, audience);
    wakeBroadcastWorker();

    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "🚀 Broadcast started!");
    await editMessageText(
      env.BOT_TOKEN,
      chatId,
      messageId,
      `🚀 <b>BROADCAST LAUNCHED</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• <b>Target:</b> ${formatTargetLabel(wiz.draft.audienceFilter)}\n` +
        `• <b>Total Recipients:</b> <code>${audience.length}</code>\n` +
        `• <b>Pin Mode:</b> <code>${wiz.draft.pinMode.toUpperCase()}</code>\n` +
        `• <b>Tag All:</b> <code>${wiz.draft.tagAllEnabled ? "ON" : "OFF"}</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Background delivery worker started...</i>`,
      {
        inline_keyboard: [
          [{ text: "📊 View Live Progress", callback_data: `bc:view:${wiz.draft.campaignId}` }],
          [{ text: "🔙 Main Panel", callback_data: "bc:dash" }],
        ],
      }
    );
    return true;
  }

  if (action === "active") {
    const list = await listCampaignsByStatuses(["running", "paused"], 10);
    await answerCallbackQuery(env.BOT_TOKEN, cq.id);

    if (list.length === 0) {
      await editMessageText(
        env.BOT_TOKEN,
        chatId,
        messageId,
        `📊 <b>ACTIVE CAMPAIGNS</b>\n\nNo campaigns are currently running or paused.`,
        { inline_keyboard: [[{ text: "🔙 Back", callback_data: "bc:dash" }]] }
      );
      return true;
    }

    const kbRows = list.map((c) => [
      {
        text: `${c.status === "paused" ? "⏸" : "▶️"} ${c.name} (${c.id})`,
        callback_data: `bc:view:${c.id}`,
      },
    ]);
    kbRows.push([{ text: "🔙 Back", callback_data: "bc:dash" }]);

    await editMessageText(
      env.BOT_TOKEN,
      chatId,
      messageId,
      `📊 <b>ACTIVE CAMPAIGNS (${list.length})</b>\n\nSelect a campaign to inspect:`,
      { inline_keyboard: kbRows }
    );
    return true;
  }

  if (action === "hist") {
    const list = await listCampaignsByStatuses(["completed", "cancelled"], 8);
    await answerCallbackQuery(env.BOT_TOKEN, cq.id);

    if (list.length === 0) {
      await editMessageText(
        env.BOT_TOKEN,
        chatId,
        messageId,
        `📜 <b>CAMPAIGN HISTORY</b>\n\nNo completed or cancelled campaigns yet.`,
        { inline_keyboard: [[{ text: "🔙 Back", callback_data: "bc:dash" }]] }
      );
      return true;
    }

    const kbRows = list.map((c) => [
      {
        text: `${c.status === "completed" ? "✅" : "🛑"} ${c.name} (${c.id})`,
        callback_data: `bc:view:${c.id}`,
      },
    ]);
    kbRows.push([{ text: "🔙 Back", callback_data: "bc:dash" }]);

    await editMessageText(
      env.BOT_TOKEN,
      chatId,
      messageId,
      `📜 <b>CAMPAIGN HISTORY</b>\n\nSelect a campaign to view report:`,
      { inline_keyboard: kbRows }
    );
    return true;
  }

  if (action === "view") {
    const cId = parts[2];
    const camp = await getCampaignById(cId);
    if (!camp) return true;

    const stats = await getCampaignStats(cId);
    const targetLabel = formatTargetLabel((camp.audience_filter as AudienceTarget) || "all");

    const text =
      `📊 <b>CAMPAIGN STATUS: ${camp.name}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `• <b>Status:</b> <code>${camp.status.toUpperCase()}</code>\n` +
      `• <b>Target:</b> ${targetLabel}\n` +
      `• <b>Total Targets:</b> <code>${stats.total}</code>\n` +
      `• <b>Sent Successfully:</b> <code>${stats.sent}</code>\n` +
      `• <b>Pending / Sending:</b> <code>${stats.pending}</code>\n` +
      `• <b>Retrying:</b> <code>${stats.retrying}</code>\n` +
      `• <b>Failed:</b> <code>${stats.failed}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    const controlRow = [];
    if (camp.status === "running") {
      controlRow.push({ text: "⏸ Pause", callback_data: `bc:pause:${cId}` });
      controlRow.push({ text: "🛑 Cancel", callback_data: `bc:cancel:${cId}` });
    } else if (camp.status === "paused") {
      controlRow.push({ text: "▶️ Resume", callback_data: `bc:resume:${cId}` });
      controlRow.push({ text: "🛑 Cancel", callback_data: `bc:cancel:${cId}` });
    }

    const kb: { inline_keyboard: any[][] } = { inline_keyboard: [] };
    if (controlRow.length > 0) kb.inline_keyboard.push(controlRow);
    kb.inline_keyboard.push([{ text: "🔄 Refresh Status", callback_data: `bc:view:${cId}` }]);
    kb.inline_keyboard.push([{ text: "🔙 Main Panel", callback_data: "bc:dash" }]);

    await answerCallbackQuery(env.BOT_TOKEN, cq.id);
    await editMessageText(env.BOT_TOKEN, chatId, messageId, text, kb);
    return true;
  }

  if (action === "pause") {
    const cId = parts[2];
    await setCampaignStatus(cId, "paused");
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "⏸ Broadcast paused.");
    await handleBroadcastCallback(env, { ...cq, data: `bc:view:${cId}` });
    return true;
  }

  if (action === "resume") {
    const cId = parts[2];
    await setCampaignStatus(cId, "running");
    wakeBroadcastWorker();
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "▶️ Broadcast resumed.");
    await handleBroadcastCallback(env, { ...cq, data: `bc:view:${cId}` });
    return true;
  }

  if (action === "cancel") {
    const cId = parts[2];
    await cancelCampaignJobs(cId);
    await answerCallbackQuery(env.BOT_TOKEN, cq.id, "🛑 Broadcast cancelled.");
    await handleBroadcastCallback(env, { ...cq, data: `bc:view:${cId}` });
    return true;
  }

  return false;
}
