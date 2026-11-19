import { getOpsDb, withOpsTransaction } from "./index";
export type AudienceTarget = "dm" | "groups" | "all";
export type BroadcastDeliveryMode = "copy" | "forward";
export type BroadcastContentType = "single" | "sequence" | "album";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "cancelled";
export type JobStatus = "pending" | "processing" | "sent" | "retry_wait" | "failed" | "skipped";

export interface BroadcastContentItem {
  message_id: number;
  from_chat_id: number;
  type:
    | "text"
    | "photo"
    | "video"
    | "document"
    | "audio"
    | "voice"
    | "video_note"
    | "sticker"
    | "animation"
    | "poll";
  text?: string;
  caption?: string;
}

export interface BroadcastDraft {
  campaignId: string;
  name: string;
  audienceFilter: AudienceTarget;
  mode: BroadcastDeliveryMode;
  contentType: BroadcastContentType;
  items: BroadcastContentItem[];
  buttons: any[][];
  pinMode: "none" | "quiet" | "loud";
  pinItemIndex: number;
  tagAllEnabled: boolean;
  isSilent: boolean;
  protectContent: boolean;
  disableLinkPreview: boolean;
  scheduledAt?: number;
}

export interface BroadcastJobRow {
  id: string;
  campaign_id: string;
  destination_id: number;
  destination_type: string;
  item_index: number;
  status: string;
  attempts: number;
  worker_lease: number;
  retry_after: number;
}

export interface BroadcastCampaignRow {
  id: string;
  name: string;
  scope: string;
  mode: string;
  content_type: string;
  content_payload: any;
  button_payload: any;
  audience_filter: string;
  pin_mode: string;
  pin_destination: string;
  pin_item_index: number;
  tag_all_enabled: number;
  is_silent: number;
  protect_content: number;
  disable_link_preview: number;
  status: string;
  owner_id: number;
  created_at: number;
}

export async function trackDestination(chat: {
  id: number;
  type: string;
  title?: string;
}): Promise<void> {
  if (!chat || chat.type === "private" || chat.id > 0) return;
  try {
    const now = Math.floor(Date.now() / 1000);
    await getOpsDb().query(
      `INSERT INTO broadcast_chat_registry (chat_id, chat_type, title, can_send, allow_broadcast, allow_tag_all, updated_at)
       VALUES ($1, $2, $3, 1, 1, 1, $4)
       ON CONFLICT (chat_id) DO UPDATE SET
         chat_type = EXCLUDED.chat_type,
         title = COALESCE(EXCLUDED.title, broadcast_chat_registry.title),
         can_send = 1,
         updated_at = EXCLUDED.updated_at`,
      [chat.id, chat.type, chat.title || null, now]
    );
  } catch (err) {
    console.error("Non-fatal registry trackDestination error:", err);
  }
}

export async function trackUser(from: {
  id: number;
  first_name?: string;
  username?: string;
  is_bot?: boolean;
}): Promise<void> {
  if (!from || from.is_bot || from.id <= 0) return;
  try {
    const now = Math.floor(Date.now() / 1000);
    await getOpsDb().query(
      `INSERT INTO broadcast_user_registry (user_id, first_name, username, is_opted_out, is_blocked, last_interaction)
       VALUES ($1, $2, $3, 0, 0, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         username = EXCLUDED.username,
         is_blocked = 0,
         last_interaction = EXCLUDED.last_interaction`,
      [from.id, from.first_name || "User", from.username || null, now]
    );
  } catch (err) {
    console.error("Non-fatal registry trackUser error:", err);
  }
}

export async function trackGroupMember(
  chatId: number,
  from: { id: number; first_name: string; username?: string; is_bot?: boolean }
): Promise<void> {
  if (!from || from.is_bot || chatId >= 0) return;
  try {
    const now = Math.floor(Date.now() / 1000);
    await getOpsDb().query(
      `INSERT INTO broadcast_group_members (chat_id, user_id, first_name, username, last_seen)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (chat_id, user_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         username = EXCLUDED.username,
         last_seen = EXCLUDED.last_seen`,
      [chatId, from.id, from.first_name || "Member", from.username || null, now]
    );
  } catch (err) {
    console.error("Non-fatal registry trackGroupMember error:", err);
  }
}

export async function updateChatMemberStatus(
  chat: { id: number; type: string; title?: string },
  canSend: number,
  canPin: number
): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000);
    await getOpsDb().query(
      `INSERT INTO broadcast_chat_registry (chat_id, chat_type, title, can_send, can_pin, allow_broadcast, allow_tag_all, updated_at)
       VALUES ($1, $2, $3, $4, $5, 1, 1, $6)
       ON CONFLICT (chat_id) DO UPDATE SET
         chat_type = EXCLUDED.chat_type,
         title = COALESCE(EXCLUDED.title, broadcast_chat_registry.title),
         can_send = EXCLUDED.can_send,
         can_pin = EXCLUDED.can_pin,
         updated_at = EXCLUDED.updated_at`,
      [chat.id, chat.type, chat.title || null, canSend, canPin, now]
    );
  } catch (err) {
    console.error("Non-fatal updateChatMemberStatus error:", err);
  }
}

export async function setBroadcastOptOut(userId: number, optOut: boolean): Promise<void> {
  await getOpsDb().query(
    "UPDATE broadcast_user_registry SET is_opted_out = $1 WHERE user_id = $2",
    [optOut ? 1 : 0, userId]
  );
}

export async function getAudienceCounts(): Promise<{ dmCount: number; groupCount: number }> {
  try {
    const db = getOpsDb();
    const dmRes = await db.query(
      `SELECT COUNT(*) AS c FROM (
         SELECT user_id AS id FROM broadcast_user_registry WHERE user_id > 0 AND is_opted_out = 0 AND is_blocked = 0
         UNION
         SELECT chat_id AS id FROM broadcast_chat_registry WHERE chat_id > 0 AND chat_type = 'private' AND can_send = 1
       ) sub`
    );
    const grpRes = await db.query(
      `SELECT COUNT(*) AS c FROM broadcast_chat_registry
       WHERE chat_id < 0 AND chat_type IN ('group', 'supergroup') AND can_send = 1 AND allow_broadcast = 1`
    );
    return {
      dmCount: Number(dmRes.rows[0]?.c || 0),
      groupCount: Number(grpRes.rows[0]?.c || 0),
    };
  } catch (err) {
    console.error("Error fetching audience counts:", err);
    return { dmCount: 0, groupCount: 0 };
  }
}

export async function resolveEligibleAudience(
  target: AudienceTarget
): Promise<Array<{ id: number; type: string }>> {
  const db = getOpsDb();
  const results: Array<{ id: number; type: string }> = [];

  if (target === "dm" || target === "all") {
    const users = await db.query(
      `SELECT user_id AS id FROM broadcast_user_registry
       WHERE user_id > 0 AND is_opted_out = 0 AND is_blocked = 0
       UNION
       SELECT chat_id AS id FROM broadcast_chat_registry
       WHERE chat_id > 0 AND chat_type = 'private' AND can_send = 1`
    );
    for (const row of users.rows) {
      results.push({ id: Number(row.id), type: "private" });
    }
  }

  if (target === "groups" || target === "all") {
    const groups = await db.query(
      `SELECT chat_id AS id, chat_type AS type
       FROM broadcast_chat_registry
       WHERE chat_id < 0 AND chat_type IN ('group', 'supergroup') AND can_send = 1 AND allow_broadcast = 1`
    );
    for (const row of groups.rows) {
      results.push({ id: Number(row.id), type: String(row.type) });
    }
  }

  return results;
}

export async function getRunningCampaignCount(): Promise<number> {
  const res = await getOpsDb().query(
    "SELECT COUNT(*) AS c FROM broadcast_campaigns WHERE status = 'running'"
  );
  return Number(res.rows[0]?.c || 0);
}

export async function clearBroadcastWizard(ownerId: number): Promise<void> {
  await getOpsDb().query("DELETE FROM broadcast_wizards WHERE owner_id = $1", [ownerId]);
}

export async function upsertBroadcastWizard(
  ownerId: number,
  step: string,
  campaignId: string,
  draft: BroadcastDraft
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await getOpsDb().query(
    `INSERT INTO broadcast_wizards (owner_id, step, campaign_id, session_data, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (owner_id) DO UPDATE SET
       step = EXCLUDED.step,
       campaign_id = EXCLUDED.campaign_id,
       session_data = EXCLUDED.session_data,
       updated_at = EXCLUDED.updated_at`,
    [ownerId, step, campaignId, JSON.stringify(draft), now]
  );
}

export async function getBroadcastWizard(
  ownerId: number
): Promise<{ step: string; draft: BroadcastDraft } | null> {
  const res = await getOpsDb().query(
    "SELECT step, session_data FROM broadcast_wizards WHERE owner_id = $1",
    [ownerId]
  );
  if (res.rows.length === 0) return null;
  const raw = res.rows[0].session_data;
  const draft: BroadcastDraft = typeof raw === "string" ? JSON.parse(raw) : raw;
  return { step: String(res.rows[0].step), draft };
}

export async function updateBroadcastWizardDraft(
  ownerId: number,
  draft: BroadcastDraft,
  step?: string
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  if (step) {
    await getOpsDb().query(
      "UPDATE broadcast_wizards SET step = $1, session_data = $2::jsonb, updated_at = $3 WHERE owner_id = $4",
      [step, JSON.stringify(draft), now, ownerId]
    );
  } else {
    await getOpsDb().query(
      "UPDATE broadcast_wizards SET session_data = $1::jsonb, updated_at = $2 WHERE owner_id = $3",
      [JSON.stringify(draft), now, ownerId]
    );
  }
}

export async function launchCampaignTx(
  ownerId: number,
  draft: BroadcastDraft,
  audience: Array<{ id: number; type: string }>
): Promise<void> {
  await withOpsTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);
    const scopeValue = draft.audienceFilter === "dm" ? "dm_only" : "global";

    await client.query(
      `INSERT INTO broadcast_campaigns (
        id, name, scope, mode, content_type, content_payload, button_payload, audience_filter,
        pin_mode, pin_destination, pin_item_index, tag_all_enabled, is_silent, protect_content,
        disable_link_preview, status, owner_id, created_at, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, 'all', $10, $11, $12, $13, $14, 'running', $15, $16, $16)`,
      [
        draft.campaignId,
        draft.name,
        scopeValue,
        draft.mode,
        draft.contentType,
        JSON.stringify(draft.items),
        draft.buttons.length > 0 ? JSON.stringify(draft.buttons) : null,
        draft.audienceFilter,
        draft.pinMode,
        draft.pinItemIndex,
        draft.tagAllEnabled ? 1 : 0,
        draft.isSilent ? 1 : 0,
        draft.protectContent ? 1 : 0,
        draft.disableLinkPreview ? 1 : 0,
        ownerId,
        now,
      ]
    );

    for (let i = 0; i < audience.length; i += 200) {
      const chunk = audience.slice(i, i + 200);
      const recValues: any[] = [];
      const recPlaceholders: string[] = [];
      const jobValues: any[] = [];
      const jobPlaceholders: string[] = [];

      chunk.forEach((target, idx) => {
        const rBase = idx * 3;
        recPlaceholders.push(`($${rBase + 1}, $${rBase + 2}, $${rBase + 3}, 'pending')`);
        recValues.push(draft.campaignId, target.id, target.type);

        const jBase = idx * 5;
        jobPlaceholders.push(
          `($${jBase + 1}, $${jBase + 2}, $${jBase + 3}, $${jBase + 4}, 0, 'pending', $${jBase + 5})`
        );
        jobValues.push(
          `${draft.campaignId}_${target.id}_0`,
          draft.campaignId,
          target.id,
          target.type,
          now
        );
      });

      await client.query(
        `INSERT INTO broadcast_recipients (campaign_id, destination_id, destination_type, status)
         VALUES ${recPlaceholders.join(", ")}
         ON CONFLICT (campaign_id, destination_id) DO NOTHING`,
        recValues
      );

      await client.query(
        `INSERT INTO broadcast_jobs (id, campaign_id, destination_id, destination_type, item_index, status, updated_at)
         VALUES ${jobPlaceholders.join(", ")}
         ON CONFLICT (id) DO NOTHING`,
        jobValues
      );
    }

    await client.query("DELETE FROM broadcast_wizards WHERE owner_id = $1", [ownerId]);
  });
}

export async function listCampaignsByStatuses(
  statuses: string[],
  limit: number
): Promise<Array<{ id: string; name: string; status: string }>> {
  const res = await getOpsDb().query(
    `SELECT id, name, status FROM broadcast_campaigns
     WHERE status = ANY($1::text[])
     ORDER BY created_at DESC LIMIT $2`,
    [statuses, limit]
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    status: String(r.status),
  }));
}

export async function getCampaignById(campaignId: string): Promise<BroadcastCampaignRow | null> {
  const res = await getOpsDb().query("SELECT * FROM broadcast_campaigns WHERE id = $1", [
    campaignId,
  ]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    ...r,
    content_payload:
      typeof r.content_payload === "string" ? JSON.parse(r.content_payload) : r.content_payload,
    button_payload:
      typeof r.button_payload === "string" ? JSON.parse(r.button_payload) : r.button_payload,
    pin_item_index: Number(r.pin_item_index ?? 0),
    tag_all_enabled: Number(r.tag_all_enabled ?? 0),
    is_silent: Number(r.is_silent ?? 0),
    protect_content: Number(r.protect_content ?? 0),
    disable_link_preview: Number(r.disable_link_preview ?? 0),
    owner_id: Number(r.owner_id),
    created_at: Number(r.created_at),
  };
}

export async function getCampaignStats(campaignId: string): Promise<{
  total: number;
  sent: number;
  pending: number;
  retrying: number;
  failed: number;
}> {
  const res = await getOpsDb().query(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0) AS sent,
       COALESCE(SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END), 0) AS pending,
       COALESCE(SUM(CASE WHEN status = 'retry_wait' THEN 1 ELSE 0 END), 0) AS retrying,
       COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed
     FROM broadcast_jobs WHERE campaign_id = $1`,
    [campaignId]
  );
  const r = res.rows[0] || {};
  return {
    total: Number(r.total || 0),
    sent: Number(r.sent || 0),
    pending: Number(r.pending || 0),
    retrying: Number(r.retrying || 0),
    failed: Number(r.failed || 0),
  };
}

export async function setCampaignStatus(campaignId: string, status: string): Promise<void> {
  await getOpsDb().query("UPDATE broadcast_campaigns SET status = $1 WHERE id = $2", [
    status,
    campaignId,
  ]);
}

export async function cancelCampaignJobs(campaignId: string): Promise<void> {
  await withOpsTransaction(async (client) => {
    await client.query("UPDATE broadcast_campaigns SET status = 'cancelled' WHERE id = $1", [
      campaignId,
    ]);
    await client.query(
      `UPDATE broadcast_jobs SET status = 'skipped'
       WHERE campaign_id = $1 AND status IN ('pending', 'processing', 'retry_wait')`,
      [campaignId]
    );
  });
}

export async function claimBatchJobs(batchSize: number): Promise<BroadcastJobRow[]> {
  return withOpsTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);
    const leaseTime = now + 45;

    await client.query(
      "UPDATE broadcast_jobs SET status = 'pending', worker_lease = 0 WHERE status = 'processing' AND worker_lease < $1",
      [now]
    );
    await client.query(
      "UPDATE broadcast_jobs SET status = 'pending', retry_after = 0 WHERE status = 'retry_wait' AND retry_after <= $1",
      [now]
    );

    const res = await client.query(
      `WITH next_jobs AS (
         SELECT j.id
         FROM broadcast_jobs j
         JOIN broadcast_campaigns c ON j.campaign_id = c.id
         WHERE j.status = 'pending' AND c.status = 'running'
         ORDER BY j.updated_at ASC
         LIMIT $1
         FOR UPDATE OF j SKIP LOCKED
       )
       UPDATE broadcast_jobs j
       SET status = 'processing', worker_lease = $2, attempts = j.attempts + 1, updated_at = $3
       FROM next_jobs
       WHERE j.id = next_jobs.id
       RETURNING j.*`,
      [batchSize, leaseTime, now]
    );

    return res.rows.map((r) => ({
      id: String(r.id),
      campaign_id: String(r.campaign_id),
      destination_id: Number(r.destination_id),
      destination_type: String(r.destination_type),
      item_index: Number(r.item_index ?? 0),
      status: String(r.status),
      attempts: Number(r.attempts ?? 0),
      worker_lease: Number(r.worker_lease ?? 0),
      retry_after: Number(r.retry_after ?? 0),
    }));
  });
}

export async function updateBroadcastJob(
  jobId: string,
  fields: {
    status: string;
    item_index?: number;
    worker_lease?: number;
    retry_after?: number;
    sent_message_id?: number;
    destination_id?: number;
    last_error?: string;
  }
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const sets: string[] = ["status = $1", "updated_at = $2"];
  const params: any[] = [fields.status, now];
  let idx = 3;

  if (fields.item_index !== undefined) {
    sets.push(`item_index = $${idx++}`);
    params.push(fields.item_index);
  }
  if (fields.worker_lease !== undefined) {
    sets.push(`worker_lease = $${idx++}`);
    params.push(fields.worker_lease);
  }
  if (fields.retry_after !== undefined) {
    sets.push(`retry_after = $${idx++}`);
    params.push(fields.retry_after);
  }
  if (fields.sent_message_id !== undefined) {
    sets.push(`sent_message_id = $${idx++}`);
    params.push(fields.sent_message_id);
  }
  if (fields.destination_id !== undefined) {
    sets.push(`destination_id = $${idx++}`);
    params.push(fields.destination_id);
  }
  if (fields.last_error !== undefined) {
    sets.push(`last_error = $${idx++}`);
    params.push(fields.last_error);
  }

  params.push(jobId);
  await getOpsDb().query(`UPDATE broadcast_jobs SET ${sets.join(", ")} WHERE id = $${idx}`, params);
}

export async function migrateSupergroupDestination(
  oldChatId: number,
  newChatId: number,
  jobId: string
): Promise<void> {
  await withOpsTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);
    await client.query(
      `UPDATE broadcast_chat_registry
       SET chat_id = $1, chat_type = 'supergroup', can_send = 1, updated_at = $2
       WHERE chat_id = $3
         AND NOT EXISTS (SELECT 1 FROM broadcast_chat_registry WHERE chat_id = $1)`,
      [newChatId, now, oldChatId]
    );
    await client.query(
      `UPDATE broadcast_jobs
       SET destination_id = $1, status = 'pending', worker_lease = 0, updated_at = $2
       WHERE id = $3`,
      [newChatId, now, jobId]
    );
  });
}

export async function disableBlockedDestination(destinationId: number): Promise<void> {
  const db = getOpsDb();
  if (destinationId > 0) {
    await db.query("UPDATE broadcast_user_registry SET is_blocked = 1 WHERE user_id = $1", [
      destinationId,
    ]);
  }
  await db.query("UPDATE broadcast_chat_registry SET can_send = 0 WHERE chat_id = $1", [
    destinationId,
  ]);
}

export async function completeFinishedCampaigns(campaignIds: string[]): Promise<void> {
  const db = getOpsDb();
  const now = Math.floor(Date.now() / 1000);
  for (const cId of campaignIds) {
    const res = await db.query(
      `SELECT COUNT(*) AS c FROM broadcast_jobs
       WHERE campaign_id = $1 AND status IN ('pending', 'processing', 'retry_wait')`,
      [cId]
    );
    if (Number(res.rows[0]?.c || 0) === 0) {
      await db.query(
        "UPDATE broadcast_campaigns SET status = 'completed', completed_at = $1 WHERE id = $2",
        [now, cId]
      );
    }
  }
}

export async function countPendingJobs(): Promise<number> {
  const res = await getOpsDb().query(
    "SELECT COUNT(*) AS c FROM broadcast_jobs WHERE status IN ('pending', 'processing', 'retry_wait')"
  );
  return Number(res.rows[0]?.c || 0);
}

export async function getRecentGroupMembers(
  chatId: number,
  limit: number = 50
): Promise<Array<{ user_id: number; first_name: string }>> {
  const res = await getOpsDb().query(
    `SELECT user_id, first_name FROM broadcast_group_members
     WHERE chat_id = $1 ORDER BY last_seen DESC LIMIT $2`,
    [chatId, limit]
  );
  return res.rows.map((r) => ({
    user_id: Number(r.user_id),
    first_name: String(r.first_name || "Member"),
  }));
}
