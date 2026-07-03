CREATE TABLE IF NOT EXISTS gbif_japanese_name_overrides (
  taxon_key INTEGER PRIMARY KEY,
  name_ja TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate', 'approved', 'rejected', 'retired')),
  source_kind TEXT NOT NULL DEFAULT 'manual_review'
    CHECK (source_kind IN ('manual_review', 'curated_source', 'operator_import', 'gbif_gap_review')),
  source_note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gbif_japanese_name_overrides_status
  ON gbif_japanese_name_overrides(status, taxon_key);
