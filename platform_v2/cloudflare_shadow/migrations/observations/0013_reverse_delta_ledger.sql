CREATE TABLE IF NOT EXISTS rollback_write_ledger (
  ledger_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  partition_month TEXT,
  source_endpoint TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  replay_sql TEXT NOT NULL,
  replay_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rollback_write_ledger_target
  ON rollback_write_ledger (target_id, event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_rollback_write_ledger_pending
  ON rollback_write_ledger (replay_status, created_at);
