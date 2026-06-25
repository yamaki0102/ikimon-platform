CREATE TABLE IF NOT EXISTS public_map_snapshot_meta (
  snapshot_key TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  source_sample_size INTEGER NOT NULL DEFAULT 0,
  public_record_count INTEGER NOT NULL DEFAULT 0,
  refreshed_by TEXT,
  policy_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public_map_snapshot_records_v1 (
  snapshot_key TEXT NOT NULL,
  occurrence_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  observed_year INTEGER NOT NULL,
  taxon_group TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_ai_candidate INTEGER NOT NULL DEFAULT 0,
  is_awaiting_id INTEGER NOT NULL DEFAULT 0,
  locality_label TEXT NOT NULL DEFAULT '位置をぼかしています',
  locality_scope TEXT NOT NULL DEFAULT 'blurred',
  municipality TEXT,
  prefecture TEXT,
  photo_url TEXT,
  source_kind TEXT,
  session_mode TEXT,
  visit_mode TEXT,
  quality_grade TEXT,
  public_coord_mode TEXT,
  public_coord_reason TEXT,
  cell_1000 TEXT NOT NULL,
  cell_3000 TEXT NOT NULL,
  cell_10000 TEXT NOT NULL,
  asset_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (snapshot_key, occurrence_id)
);

CREATE INDEX IF NOT EXISTS idx_public_map_snapshot_records_observed
  ON public_map_snapshot_records_v1 (snapshot_key, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_map_snapshot_records_cell_1000
  ON public_map_snapshot_records_v1 (snapshot_key, cell_1000, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_map_snapshot_records_cell_3000
  ON public_map_snapshot_records_v1 (snapshot_key, cell_3000, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_map_snapshot_records_cell_10000
  ON public_map_snapshot_records_v1 (snapshot_key, cell_10000, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_map_snapshot_records_year_group
  ON public_map_snapshot_records_v1 (snapshot_key, observed_year, taxon_group);

INSERT OR REPLACE INTO public_map_snapshot_meta (
  snapshot_key, generated_at, source_sample_size, public_record_count, refreshed_by, policy_json
)
SELECT
  'public-map:v1:global',
  CURRENT_TIMESTAMP,
  COUNT(*),
  COUNT(*),
  'd1_migration_0017',
  '{"minCellRecords":3,"sensitiveMinCellMeters":5000,"municipalityMinCellMeters":20000,"bboxScope":"fixed_public_cell_cover","policy":"k_anonymous_cell_aggregate","exposesSuppressedCounts":false}'
FROM readmodel_public_observations;

INSERT OR IGNORE INTO public_map_snapshot_records_v1 (
  snapshot_key,
  occurrence_id,
  visit_id,
  observed_at,
  observed_year,
  taxon_group,
  display_name,
  is_ai_candidate,
  is_awaiting_id,
  locality_label,
  locality_scope,
  cell_1000,
  cell_3000,
  cell_10000,
  asset_count
)
SELECT
  'public-map:v1:global',
  'occ:' || observation_id || ':0',
  observation_id,
  observed_at,
  CAST(substr(observed_at, 1, 4) AS INTEGER),
  'other',
  COALESCE(NULLIF(taxon_label, ''), '同定待ち'),
  0,
  CASE
    WHEN taxon_label IS NULL OR taxon_label = '' OR lower(taxon_label) IN ('unidentified', 'unknown', 'unresolved', 'awaiting id') OR taxon_label = '同定待ち' OR taxon_label = '不明'
    THEN 1
    ELSE 0
  END,
  '位置をぼかしています',
  'blurred',
  public_cell,
  public_cell,
  public_cell,
  asset_count
FROM readmodel_public_observations;
