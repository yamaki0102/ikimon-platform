CREATE TABLE IF NOT EXISTS gbif_japanese_name_display_audit (
  audit_key TEXT PRIMARY KEY,
  taxon_key INTEGER NOT NULL,
  cell_id TEXT NOT NULL,
  query_cell_id TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  canonical_name TEXT,
  rank TEXT NOT NULL DEFAULT 'SPECIES',
  taxon_group TEXT NOT NULL DEFAULT 'other',
  display_name_ja TEXT NOT NULL,
  common_name_ja TEXT,
  common_name_source TEXT NOT NULL DEFAULT 'none'
    CHECK (common_name_source IN ('gbif_vernacular', 'approved_override', 'none')),
  name_status TEXT NOT NULL
    CHECK (name_status IN ('japanese_common_name', 'scientific_name_only')),
  override_status TEXT,
  override_source_kind TEXT,
  override_reviewed_by TEXT,
  override_reviewed_at TEXT,
  decision_reason TEXT NOT NULL,
  policy_version TEXT NOT NULL DEFAULT 'gbif_name_governance_v1',
  source_url TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  seen_count INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gbif_japanese_name_display_audit_source
  ON gbif_japanese_name_display_audit(common_name_source, name_status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_gbif_japanese_name_display_audit_taxon
  ON gbif_japanese_name_display_audit(taxon_key, last_seen_at DESC);
