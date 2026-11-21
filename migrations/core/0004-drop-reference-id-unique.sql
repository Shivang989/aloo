ALTER TABLE economy_transactions
  DROP CONSTRAINT IF EXISTS economy_transactions_reference_id_key;

DROP INDEX IF EXISTS economy_transactions_reference_id_key;

CREATE INDEX IF NOT EXISTS idx_economy_transactions_reference_id
  ON economy_transactions(reference_id);
