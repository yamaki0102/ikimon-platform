CREATE TABLE IF NOT EXISTS durable_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK (count >= 0),
  reset_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_durable_rate_limits_reset_at
  ON durable_rate_limits(reset_at_ms);
