CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT PRIMARY KEY,
  first_name TEXT,
  balance BIGINT NOT NULL DEFAULT 1000,
  ammo INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  is_alive SMALLINT NOT NULL DEFAULT 1,
  protected_until BIGINT NOT NULL DEFAULT 0,
  last_daily BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_users_balance_desc ON users (balance DESC);

CREATE TABLE IF NOT EXISTS inventory (
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_name)
);

CREATE TABLE IF NOT EXISTS admins (
  chat_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT 'Admin',
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE TABLE IF NOT EXISTS economy_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  tx_type TEXT NOT NULL,
  amount BIGINT NOT NULL,
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  reference_id TEXT UNIQUE,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_econ_tx_user ON economy_transactions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  processed_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events (status, id) WHERE status = 'pending';
