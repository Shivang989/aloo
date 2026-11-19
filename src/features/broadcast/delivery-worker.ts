import {
  claimBatchJobs,
  getCampaignById,
  updateBroadcastJob,
  migrateSupergroupDestination,
  disableBlockedDestination,
  completeFinishedCampaigns,
  countPendingJobs,
  getRecentGroupMembers,
  BroadcastCampaignRow,
} from "../../database/broadcast-data";
import { copyMessage, forwardMessage, sendMessage } from "../../telegram/messages";
import { pinChatMessage } from "../../telegram/chats";
import { escapeHtml } from "../../ui/fancy-text";
import { BroadcastContentItem } from "./types";

async function dispatchGroupMentions(botToken: string, chatId: number): Promise<void> {
  try {
    const members = await getRecentGroupMembers(chatId, 50);
    if (members.length === 0) return;

    for (let i = 0; i < members.length; i += 5) {
      const chunk = members.slice(i, i + 5);
      const mentions = chunk
        .map((m) => `<a href="tg://user?id=${m.user_id}">${escapeHtml(m.first_name)}</a>`)
        .join(" ");

      await sendMessage(botToken, chatId, `📢 ${mentions}`, undefined, undefined, false);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  } catch (err) {
    console.error("Non-fatal Tag All error:", err);
  }
}

export async function processBroadcastBatch(
  botToken: string,
  batchSize: number = 25
): Promise<{ processed: number; remaining: number }> {
  const jobs = await claimBatchJobs(batchSize);
  if (jobs.length === 0) {
    return { processed: 0, remaining: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  const campaignMap = new Map<string, BroadcastCampaignRow | null>();

  for (const job of jobs) {
    if (!campaignMap.has(job.campaign_id)) {
      const camp = await getCampaignById(job.campaign_id);
      campaignMap.set(job.campaign_id, camp);
    }

    const campaign = campaignMap.get(job.campaign_id);
    if (!campaign || campaign.status !== "running") {
      await updateBroadcastJob(job.id, { status: "skipped", worker_lease: 0 });
      continue;
    }

    const items: BroadcastContentItem[] = Array.isArray(campaign.content_payload)
      ? campaign.content_payload
      : [];
    const buttons: any[][] | undefined = Array.isArray(campaign.button_payload)
      ? campaign.button_payload
      : undefined;
    const currentItem = items[job.item_index];

    if (!currentItem) {
      await updateBroadcastJob(job.id, { status: "skipped", worker_lease: 0 });
      continue;
    }

    let sendRes: any;
    try {
      if (campaign.mode === "forward" || currentItem.type === "poll") {
        sendRes = await forwardMessage(botToken, {
          chat_id: job.destination_id,
          from_chat_id: currentItem.from_chat_id,
          message_id: currentItem.message_id,
          disable_notification: campaign.is_silent === 1,
          protect_content: campaign.protect_content === 1,
        });
      } else {
        sendRes = await copyMessage(botToken, {
          chat_id: job.destination_id,
          from_chat_id: currentItem.from_chat_id,
          message_id: currentItem.message_id,
          reply_markup:
            job.item_index === items.length - 1 && buttons && buttons.length > 0
              ? { inline_keyboard: buttons }
              : undefined,
          disable_notification: campaign.is_silent === 1,
          protect_content: campaign.protect_content === 1,
        });

        if (!sendRes.ok && sendRes.description?.includes("can't be copied")) {
          sendRes = await forwardMessage(botToken, {
            chat_id: job.destination_id,
            from_chat_id: currentItem.from_chat_id,
            message_id: currentItem.message_id,
            disable_notification: campaign.is_silent === 1,
            protect_content: campaign.protect_content === 1,
          });
        }
      }
    } catch (err: any) {
      sendRes = { ok: false, description: err?.message || "Network error" };
    }

    if (sendRes.ok && sendRes.result) {
      const sentId = Number(sendRes.result.message_id);

      if (campaign.pin_mode !== "none" && job.item_index === campaign.pin_item_index) {
        try {
          await pinChatMessage(
            botToken,
            job.destination_id,
            sentId,
            campaign.pin_mode === "quiet"
          );
        } catch {
          // Ignore missing pin permission
        }
      }

      if (job.item_index < items.length - 1) {
        await updateBroadcastJob(job.id, {
          item_index: job.item_index + 1,
          status: "pending",
          worker_lease: 0,
          sent_message_id: sentId,
        });
      } else {
        await updateBroadcastJob(job.id, {
          status: "sent",
          worker_lease: 0,
          sent_message_id: sentId,
        });

        if (campaign.tag_all_enabled === 1 && job.destination_id < 0) {
          await dispatchGroupMentions(botToken, job.destination_id);
        }
      }
    } else {
      const desc = sendRes.description || "Unknown error";
      const retryAfterSec = sendRes.parameters?.retry_after;
      const migrateId = sendRes.parameters?.migrate_to_chat_id;

      if (migrateId) {
        await migrateSupergroupDestination(job.destination_id, Number(migrateId), job.id);
        continue;
      }

      if (retryAfterSec) {
        await updateBroadcastJob(job.id, {
          status: "retry_wait",
          retry_after: now + Number(retryAfterSec),
          worker_lease: 0,
          last_error: desc,
        });
        continue;
      }

      const isKickedOrBlocked =
        desc.includes("bot was blocked") ||
        desc.includes("user is deactivated") ||
        desc.includes("chat not found") ||
        desc.includes("bot was kicked") ||
        desc.includes("bot is not a member") ||
        desc.includes("group chat was deactivated") ||
        desc.includes("can't initiate conversation");

      const isMediaRestricted = desc.includes("not enough rights");

      if (isKickedOrBlocked || isMediaRestricted) {
        await updateBroadcastJob(job.id, {
          status: "failed",
          worker_lease: 0,
          last_error: desc,
        });

        if (isKickedOrBlocked) {
          await disableBlockedDestination(job.destination_id);
        }
      } else if (job.attempts >= 3) {
        await updateBroadcastJob(job.id, {
          status: "failed",
          worker_lease: 0,
          last_error: desc,
        });
      } else {
        const backoff = Math.pow(2, job.attempts) * 5;
        await updateBroadcastJob(job.id, {
          status: "retry_wait",
          retry_after: now + backoff,
          worker_lease: 0,
          last_error: desc,
        });
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  await completeFinishedCampaigns(Array.from(campaignMap.keys()));
  const remaining = await countPendingJobs();
  return { processed: jobs.length, remaining };
}
