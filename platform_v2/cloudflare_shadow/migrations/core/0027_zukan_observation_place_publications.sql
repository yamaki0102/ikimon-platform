-- Additive-only publication mapping keyed by (user_id, observation_id) with optional place_id,
-- replacing string-only date+place_name bundle keys while keeping legacy zukan_book_publications intact.

CREATE TABLE IF NOT EXISTS zukan_book_publications (
  group_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  observation_ids_json TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS zukan_observation_publications (
  user_id TEXT NOT NULL,
  observation_id TEXT NOT NULL,
  place_id TEXT,
  legacy_group_key TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, observation_id)
);

CREATE INDEX IF NOT EXISTS idx_zukan_observation_publications_user_pub
  ON zukan_observation_publications(user_id, published, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_zukan_observation_publications_place
  ON zukan_observation_publications(place_id, published);

-- Safe additive backfill from existing zukan_book_publications rows (handles 0 rows cleanly).
INSERT OR IGNORE INTO zukan_observation_publications (
  user_id,
  observation_id,
  place_id,
  legacy_group_key,
  published,
  updated_at
)
SELECT
  bp.user_id,
  CAST(je.value AS TEXT),
  NULL,
  bp.group_key,
  bp.published,
  bp.updated_at
FROM zukan_book_publications AS bp
JOIN json_each(bp.observation_ids_json) AS je
WHERE json_valid(bp.observation_ids_json) = 1
  AND typeof(je.value) = 'text'
  AND length(trim(CAST(je.value AS TEXT))) > 0;
