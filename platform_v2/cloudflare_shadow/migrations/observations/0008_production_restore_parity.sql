CREATE TABLE IF NOT EXISTS production_restore_parity_runs (
  run_id TEXT PRIMARY KEY,
  source_db TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  table_count INTEGER NOT NULL,
  critical_json TEXT NOT NULL,
  orphan_json TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS production_restore_parity_metrics (
  run_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  metric_value TEXT NOT NULL,
  detail_json TEXT,
  PRIMARY KEY (run_id, metric_type, metric_key),
  FOREIGN KEY (run_id) REFERENCES production_restore_parity_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_production_restore_parity_metric_type
  ON production_restore_parity_metrics (metric_type, metric_key);
