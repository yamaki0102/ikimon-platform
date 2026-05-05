CREATE TABLE IF NOT EXISTS osm_area_tile_cache (
  tile_z INTEGER NOT NULL,
  tile_x INTEGER NOT NULL,
  tile_y INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'overpass',
  schema_version TEXT NOT NULL DEFAULT 'osm-area-live-v1',
  status TEXT NOT NULL DEFAULT 'success',
  feature_collection JSONB NOT NULL DEFAULT '{"type":"FeatureCollection","features":[]}'::jsonb,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tile_z, tile_x, tile_y, source, schema_version)
);

CREATE INDEX IF NOT EXISTS idx_osm_area_tile_cache_expires
  ON osm_area_tile_cache (expires_at);

CREATE INDEX IF NOT EXISTS idx_osm_area_tile_cache_status_updated
  ON osm_area_tile_cache (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS osm_area_import_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_key TEXT NOT NULL,
  bbox_hash TEXT NOT NULL,
  bbox JSONB NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'running',
  dry_run BOOLEAN NOT NULL DEFAULT false,
  sweep BOOLEAN NOT NULL DEFAULT false,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  refreshed_count INTEGER NOT NULL DEFAULT 0,
  closed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_osm_area_import_runs_region_started
  ON osm_area_import_runs (region_key, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_osm_area_import_runs_status_started
  ON osm_area_import_runs (status, started_at DESC);
