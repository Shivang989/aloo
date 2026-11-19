CREATE TABLE IF NOT EXISTS broadcast_chat_registry (
  chat_id BIGINT PRIMARY KEY,
  chat_type TEXT NOT NULL,
  title TEXT,
  can_send SMALLINT NOT NULL DEFAULT 1,
  can_pin SMALLINT NOT NULL DEFAULT 0,
  allow_broadcast SMALLINT NOT NULL DEFAULT 1,
  allow_tag_all SMALLINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS broadcast_user_registry (
  user_id BIGINT PRIMARY KEY,
  first_name TEXT,
  username TEXT,
  is_opted_out SMALLINT NOT NULL DEFAULT 0,
  is_blocked SMALLINT NOT NULL DEFAULT 0,
  last_interaction BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS broadcast_group_members (
  chat_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  first_name TEXT NOT NULL,
  username TEXT,
  last_seen BIGINT NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,
  mode TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_payload JSONB NOT NULL,
  button_payload JSONB,
  audience_filter TEXT NOT NULL,
  pin_mode TEXT NOT NULL DEFAULT 'none',
  pin_destination TEXT NOT NULL DEFAULT 'all',
  pin_item_index INTEGER NOT NULL DEFAULT 0,
  tag_all_enabled SMALLINT NOT NULL DEFAULT 0,
  tag_all_groups JSONB,
  is_silent SMALLINT NOT NULL DEFAULT 0,
  protect_content SMALLINT NOT NULL DEFAULT 0,
  disable_link_preview SMALLINT NOT NULL DEFAULT 0,
  scheduled_at BIGINT,
  status TEXT NOT NULL,
  owner_id BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  started_at BIGINT,
  completed_at BIGINT
);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  campaign_id TEXT NOT NULL,
  destination_id BIGINT NOT NULL,
  destination_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  exclusion_reason TEXT,
  PRIMARY KEY (campaign_id, destination_id)
);

CREATE TABLE IF NOT EXISTS broadcast_jobs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  destination_id BIGINT NOT NULL,
  destination_type TEXT NOT NULL,
  item_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  worker_lease BIGINT NOT NULL DEFAULT 0,
  retry_after BIGINT NOT NULL DEFAULT 0,
  sent_message_id BIGINT,
  pinned_message_id BIGINT,
  last_error TEXT,
  updated_at BIGINT NOT NULL,
  UNIQUE (campaign_id, destination_id, item_index)
);

CREATE TABLE IF NOT EXISTS broadcast_wizards (
  owner_id BIGINT PRIMARY KEY,
  step TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  session_data JSONB NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS broadcast_logs (
  id BIGSERIAL PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  destination_id BIGINT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_b_jobs_claim ON broadcast_jobs (status, worker_lease, retry_after);
CREATE INDEX IF NOT EXISTS idx_b_recipients ON broadcast_recipients (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_b_group_members ON broadcast_group_members (chat_id);
