-- Aloo Core Migration 0002: Hybrid Economy, Bank, Assets, Missions, Gender & Owner Audit

ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profession TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_work_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_job_change_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_freelance_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_delivery_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_active_earned BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_active_date TEXT;

CREATE TABLE IF NOT EXISTS delivery_orders (
  order_id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  delivery_type TEXT NOT NULL,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  base_reward BIGINT NOT NULL,
  vehicle_bonus BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'offered',
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  completed_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_user_status
  ON delivery_orders(user_id, status, expires_at DESC);

CREATE TABLE IF NOT EXISTS freelance_tasks (
  task_id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  reward BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  completed_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_freelance_tasks_user_status
  ON freelance_tasks(user_id, status, expires_at DESC);

CREATE TABLE IF NOT EXISTS mission_progress (
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  period_type TEXT NOT NULL,
  period_key TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  target INTEGER NOT NULL,
  reward BIGINT NOT NULL,
  claimed INTEGER NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, period_type, period_key, mission_id)
);

CREATE INDEX IF NOT EXISTS idx_mission_progress_lookup
  ON mission_progress(user_id, period_type, period_key);

CREATE TABLE IF NOT EXISTS user_businesses (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  business_type TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  last_collected_at BIGINT NOT NULL,
  total_earned BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_businesses_user
  ON user_businesses(user_id);

CREATE TABLE IF NOT EXISTS user_properties (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  property_type TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  last_rent_collected_at BIGINT NOT NULL,
  total_rent_earned BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_properties_user
  ON user_properties(user_id);

CREATE TABLE IF NOT EXISTS bank_accounts (
  user_id BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  balance BIGINT NOT NULL DEFAULT 0,
  last_interest_at BIGINT NOT NULL,
  total_interest_earned BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS owner_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL,
  target_user_id BIGINT NOT NULL,
  action TEXT NOT NULL,
  amount BIGINT,
  before_value TEXT,
  after_value TEXT,
  reference_id TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_owner_audit_logs_target
  ON owner_audit_logs(target_user_id, created_at DESC);
