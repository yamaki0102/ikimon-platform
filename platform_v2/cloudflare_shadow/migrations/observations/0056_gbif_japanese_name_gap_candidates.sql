CREATE TABLE IF NOT EXISTS gbif_japanese_name_gap_candidates (
  taxon_key INTEGER PRIMARY KEY,
  scientific_name TEXT NOT NULL,
  canonical_name TEXT,
  rank TEXT NOT NULL DEFAULT 'SPECIES',
  taxon_group TEXT NOT NULL DEFAULT 'other',
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  seen_count INTEGER NOT NULL DEFAULT 0,
  record_count_total INTEGER NOT NULL DEFAULT 0,
  example_cell_id TEXT,
  example_query_cell_id TEXT,
  source_url TEXT,
  review_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_state IN ('pending', 'reviewing', 'resolved', 'ignored')),
  resolved_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gbif_japanese_name_gap_candidates_review
  ON gbif_japanese_name_gap_candidates(review_state, record_count_total DESC, seen_count DESC, last_seen_at DESC);
