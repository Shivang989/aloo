-- Drop any legacy CHECK constraint on economy_transactions.tx_type so all hybrid economy transaction types succeed
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'economy_transactions'::regclass
      AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE economy_transactions DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Ensure reference_id accepts text identifiers (profession IDs, order IDs, task IDs)
ALTER TABLE economy_transactions
  ALTER COLUMN reference_id TYPE TEXT USING reference_id::TEXT;

-- Re-verify Phase 2-6 columns & tables exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profession TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_work_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_job_change_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_freelance_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_delivery_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_active_earned BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_active_date TEXT;

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
