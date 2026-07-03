CREATE TABLE IF NOT EXISTS gbif_area_summary_cache (
  cell_id TEXT PRIMARY KEY,
  query_cell_id TEXT NOT NULL,
  query_grid_m INTEGER NOT NULL,
  source_url TEXT NOT NULL,
  license_scope TEXT NOT NULL DEFAULT 'CC0_1_0,CC_BY_4_0',
  total_records INTEGER NOT NULL DEFAULT 0,
  top_taxa_json TEXT NOT NULL DEFAULT '[]',
  latest_year INTEGER,
  citation_text TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  refresh_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_gbif_area_summary_cache_expires_at
  ON gbif_area_summary_cache(expires_at);

CREATE TABLE IF NOT EXISTS gbif_area_summary_state (
  state_key TEXT PRIMARY KEY,
  state_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
