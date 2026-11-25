CREATE TABLE IF NOT EXISTS record_vocabulary_terms (
  vocab_version TEXT NOT NULL,
  slot TEXT NOT NULL,
  code TEXT NOT NULL CHECK (code <> ''),
  label_ja TEXT NOT NULL,
  definition_ja TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  replaced_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (vocab_version, slot, code)
);

CREATE TABLE IF NOT EXISTS record_media_order (
  record_runtime TEXT NOT NULL DEFAULT 'cloudflare_d1' CHECK (record_runtime IN ('postgresql', 'cloudflare_d1', 'import')),
  record_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (record_runtime, record_id, asset_id),
  UNIQUE (record_runtime, record_id, position)
);

CREATE TABLE IF NOT EXISTS record_reading_items (
  item_id TEXT PRIMARY KEY CHECK (length(item_id) = 36),
  record_runtime TEXT NOT NULL DEFAULT 'cloudflare_d1' CHECK (record_runtime IN ('postgresql', 'cloudflare_d1', 'import')),
  record_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('organism', 'feature', 'place_field')),
  slot TEXT NOT NULL,
  source_key TEXT NOT NULL,
  observation_id TEXT REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
  anchor_asset_id TEXT,
  anchor_locator_key TEXT NOT NULL DEFAULT 'full',
  anchor_locator_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(anchor_locator_json) AND length(anchor_locator_json) <= 4096),
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded')),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (record_runtime, record_id, source_key),
  CHECK ((kind = 'organism') = (observation_id IS NOT NULL)),
  CHECK (kind <> 'organism' OR slot = 'organism'),
  CHECK (kind <> 'feature' OR slot = 'feature_kind'),
  CHECK (kind <> 'place_field' OR slot IN ('place_type', 'contact_surface', 'surrounding_cover', 'environment_condition', 'human_change'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_organism_once ON record_reading_items (observation_id) WHERE kind = 'organism';
CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_place_slot_once ON record_reading_items (record_runtime, record_id, COALESCE(anchor_asset_id, ''), anchor_locator_key, slot) WHERE kind = 'place_field';
CREATE INDEX IF NOT EXISTS idx_reading_items_record ON record_reading_items (record_runtime, record_id, status, display_order);

CREATE TABLE IF NOT EXISTS record_reading_revisions (
  revision_id TEXT PRIMARY KEY CHECK (length(revision_id) = 36),
  item_id TEXT NOT NULL REFERENCES record_reading_items(item_id) ON DELETE RESTRICT,
  seq INTEGER NOT NULL CHECK (seq >= 1),
  base_revision_id TEXT REFERENCES record_reading_revisions(revision_id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('read', 'propose', 'agree', 'object', 'set', 'revert', 'remove')),
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('ai', 'owner', 'community', 'curator')),
  actor_id TEXT,
  vocab_version TEXT,
  slot TEXT,
  value_code TEXT,
  value_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(value_json) AND length(value_json) <= 16384),
  assessment_id TEXT,
  suggestion_id TEXT,
  identification_id TEXT,
  reason_code TEXT,
  reverts_revision_id TEXT REFERENCES record_reading_revisions(revision_id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (item_id, seq),
  UNIQUE (item_id, request_id),
  CHECK (actor_kind = 'ai' OR actor_id IS NOT NULL),
  CHECK ((vocab_version IS NULL) = (slot IS NULL)),
  CHECK (action <> 'revert' OR reverts_revision_id IS NOT NULL),
  FOREIGN KEY (vocab_version, slot, value_code) REFERENCES record_vocabulary_terms (vocab_version, slot, code) ON DELETE RESTRICT
);

INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja)
SELECT v.vocab_version, v.slot, v.code, v.label_ja FROM (
SELECT 'place-state/1' AS vocab_version, 'place_type' AS slot, 'urban' AS code, 'まちなか' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'place_type' AS slot, 'grassland_urban_edge' AS code, 'まちの縁の草地' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'place_type' AS slot, 'woodland' AS code, '林・森' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'place_type' AS slot, 'water_edge' AS code, '水辺' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'place_type' AS slot, 'wetland' AS code, '湿地' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'place_type' AS slot, 'coast' AS code, '海岸' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'place_type' AS slot, 'farmland' AS code, '田畑' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'place_type' AS slot, 'indoors' AS code, '屋内' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'place_type' AS slot, 'unknown' AS code, '分からない' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'contact_surface' AS slot, 'soil' AS code, '土' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'contact_surface' AS slot, 'soil_gravel_litter' AS code, '土・砂利・落ち葉が混じる面' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'contact_surface' AS slot, 'sand' AS code, '砂' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'contact_surface' AS slot, 'gravel' AS code, '砂利' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'contact_surface' AS slot, 'leaf_litter' AS code, '落ち葉' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'contact_surface' AS slot, 'rock' AS code, '岩・石' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'contact_surface' AS slot, 'plant' AS code, '植物' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'contact_surface' AS slot, 'water' AS code, '水' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'contact_surface' AS slot, 'artificial' AS code, '人工の面' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'contact_surface' AS slot, 'unknown' AS code, '分からない' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'surrounding_cover' AS slot, 'low_grass' AS code, '低い草' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'surrounding_cover' AS slot, 'trees_shrubs' AS code, '木・低木' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'surrounding_cover' AS slot, 'bare_ground' AS code, '土が出た地面' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'surrounding_cover' AS slot, 'water' AS code, '水面' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'surrounding_cover' AS slot, 'snow' AS code, '雪' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'surrounding_cover' AS slot, 'built_surface' AS code, '建物・舗装' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'surrounding_cover' AS slot, 'mixed_cover' AS code, '複数が同じくらい' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'surrounding_cover' AS slot, 'unknown' AS code, '分からない' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'environment_condition' AS slot, 'sunny' AS code, '日が当たっている' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'environment_condition' AS slot, 'shaded' AS code, '日陰' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'environment_condition' AS slot, 'wet' AS code, '濡れている' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'environment_condition' AS slot, 'flowing' AS code, '水が流れている' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'environment_condition' AS slot, 'open_dry' AS code, '開けて乾いて見える' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'environment_condition' AS slot, 'windy' AS code, '風で揺れている' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'environment_condition' AS slot, 'unknown' AS code, '分からない' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'human_change' AS slot, 'mowing' AS code, '草刈りの跡' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'human_change' AS slot, 'trampling' AS code, '踏み跡' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'human_change' AS slot, 'trampling_mowing' AS code, '踏み跡と草刈りの跡' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'human_change' AS slot, 'planting' AS code, '植えた跡' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'human_change' AS slot, 'construction' AS code, '工事の跡' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'human_change' AS slot, 'litter_visible' AS code, '捨てられた物が見える' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'human_change' AS slot, 'none_visible' AS code, '写っている範囲では見当たらない' AS label_ja
UNION ALL SELECT 'place-state/1' AS vocab_version, 'human_change' AS slot, 'unknown' AS code, '分からない' AS label_ja
UNION ALL SELECT 'feature-kind/1', 'feature_kind', 'building', '建物'
UNION ALL SELECT 'feature-kind/1', 'feature_kind', 'bridge', '橋'
UNION ALL SELECT 'feature-kind/1', 'feature_kind', 'revetment', '護岸'
UNION ALL SELECT 'feature-kind/1', 'feature_kind', 'signboard', '案内板'
UNION ALL SELECT 'feature-kind/1', 'feature_kind', 'pavement', '舗装'
UNION ALL SELECT 'feature-kind/1', 'feature_kind', 'fence', '柵'
UNION ALL SELECT 'feature-kind/1', 'feature_kind', 'artifact', '道具・人工物'
UNION ALL SELECT 'feature-kind/1', 'feature_kind', 'grass_patch', '草むら'
UNION ALL SELECT 'feature-kind/1', 'feature_kind', 'tree_canopy', '木の茂み'
UNION ALL SELECT 'feature-kind/1', 'feature_kind', 'rock', '岩'
UNION ALL SELECT 'feature-kind/1', 'feature_kind', 'water_surface', '水面'
UNION ALL SELECT 'feature-kind/1', 'feature_kind', 'unknown_feature', '種類が分からないもの'

) v
WHERE NOT EXISTS (
  SELECT 1 FROM record_vocabulary_terms t
   WHERE t.vocab_version = v.vocab_version AND t.slot = v.slot AND t.code = v.code
);
