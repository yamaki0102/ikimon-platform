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

INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'place_type', 'urban', 'まちなか' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'place_type' AND code = 'urban');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'place_type', 'grassland_urban_edge', 'まちの縁の草地' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'place_type' AND code = 'grassland_urban_edge');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'place_type', 'woodland', '林・森' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'place_type' AND code = 'woodland');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'place_type', 'water_edge', '水辺' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'place_type' AND code = 'water_edge');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'place_type', 'wetland', '湿地' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'place_type' AND code = 'wetland');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'place_type', 'coast', '海岸' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'place_type' AND code = 'coast');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'place_type', 'farmland', '田畑' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'place_type' AND code = 'farmland');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'place_type', 'indoors', '屋内' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'place_type' AND code = 'indoors');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'place_type', 'unknown', '分からない' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'place_type' AND code = 'unknown');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'contact_surface', 'soil', '土' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'contact_surface' AND code = 'soil');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'contact_surface', 'soil_gravel_litter', '土・砂利・落ち葉が混じる面' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'contact_surface' AND code = 'soil_gravel_litter');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'contact_surface', 'sand', '砂' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'contact_surface' AND code = 'sand');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'contact_surface', 'gravel', '砂利' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'contact_surface' AND code = 'gravel');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'contact_surface', 'leaf_litter', '落ち葉' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'contact_surface' AND code = 'leaf_litter');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'contact_surface', 'rock', '岩・石' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'contact_surface' AND code = 'rock');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'contact_surface', 'plant', '植物' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'contact_surface' AND code = 'plant');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'contact_surface', 'water', '水' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'contact_surface' AND code = 'water');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'contact_surface', 'artificial', '人工の面' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'contact_surface' AND code = 'artificial');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'contact_surface', 'unknown', '分からない' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'contact_surface' AND code = 'unknown');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'surrounding_cover', 'low_grass', '低い草' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'surrounding_cover' AND code = 'low_grass');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'surrounding_cover', 'trees_shrubs', '木・低木' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'surrounding_cover' AND code = 'trees_shrubs');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'surrounding_cover', 'bare_ground', '土が出た地面' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'surrounding_cover' AND code = 'bare_ground');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'surrounding_cover', 'water', '水面' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'surrounding_cover' AND code = 'water');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'surrounding_cover', 'snow', '雪' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'surrounding_cover' AND code = 'snow');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'surrounding_cover', 'built_surface', '建物・舗装' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'surrounding_cover' AND code = 'built_surface');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'surrounding_cover', 'mixed_cover', '複数が同じくらい' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'surrounding_cover' AND code = 'mixed_cover');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'surrounding_cover', 'unknown', '分からない' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'surrounding_cover' AND code = 'unknown');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'environment_condition', 'sunny', '日が当たっている' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'environment_condition' AND code = 'sunny');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'environment_condition', 'shaded', '日陰' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'environment_condition' AND code = 'shaded');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'environment_condition', 'wet', '濡れている' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'environment_condition' AND code = 'wet');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'environment_condition', 'flowing', '水が流れている' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'environment_condition' AND code = 'flowing');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'environment_condition', 'open_dry', '開けて乾いて見える' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'environment_condition' AND code = 'open_dry');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'environment_condition', 'windy', '風で揺れている' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'environment_condition' AND code = 'windy');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'environment_condition', 'unknown', '分からない' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'environment_condition' AND code = 'unknown');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'human_change', 'mowing', '草刈りの跡' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'human_change' AND code = 'mowing');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'human_change', 'trampling', '踏み跡' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'human_change' AND code = 'trampling');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'human_change', 'trampling_mowing', '踏み跡と草刈りの跡' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'human_change' AND code = 'trampling_mowing');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'human_change', 'planting', '植えた跡' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'human_change' AND code = 'planting');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'human_change', 'construction', '工事の跡' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'human_change' AND code = 'construction');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'human_change', 'litter_visible', '捨てられた物が見える' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'human_change' AND code = 'litter_visible');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'human_change', 'none_visible', '写っている範囲では見当たらない' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'human_change' AND code = 'none_visible');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'place-state/1', 'human_change', 'unknown', '分からない' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'place-state/1' AND slot = 'human_change' AND code = 'unknown');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'feature-kind/1', 'feature_kind', 'building', '建物' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'feature-kind/1' AND slot = 'feature_kind' AND code = 'building');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'feature-kind/1', 'feature_kind', 'bridge', '橋' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'feature-kind/1' AND slot = 'feature_kind' AND code = 'bridge');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'feature-kind/1', 'feature_kind', 'revetment', '護岸' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'feature-kind/1' AND slot = 'feature_kind' AND code = 'revetment');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'feature-kind/1', 'feature_kind', 'signboard', '案内板' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'feature-kind/1' AND slot = 'feature_kind' AND code = 'signboard');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'feature-kind/1', 'feature_kind', 'pavement', '舗装' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'feature-kind/1' AND slot = 'feature_kind' AND code = 'pavement');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'feature-kind/1', 'feature_kind', 'fence', '柵' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'feature-kind/1' AND slot = 'feature_kind' AND code = 'fence');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'feature-kind/1', 'feature_kind', 'artifact', '道具・人工物' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'feature-kind/1' AND slot = 'feature_kind' AND code = 'artifact');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'feature-kind/1', 'feature_kind', 'grass_patch', '草むら' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'feature-kind/1' AND slot = 'feature_kind' AND code = 'grass_patch');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'feature-kind/1', 'feature_kind', 'tree_canopy', '木の茂み' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'feature-kind/1' AND slot = 'feature_kind' AND code = 'tree_canopy');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'feature-kind/1', 'feature_kind', 'rock', '岩' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'feature-kind/1' AND slot = 'feature_kind' AND code = 'rock');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'feature-kind/1', 'feature_kind', 'water_surface', '水面' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'feature-kind/1' AND slot = 'feature_kind' AND code = 'water_surface');
INSERT INTO record_vocabulary_terms (vocab_version, slot, code, label_ja) SELECT 'feature-kind/1', 'feature_kind', 'unknown_feature', '種類が分からないもの' WHERE NOT EXISTS (SELECT 1 FROM record_vocabulary_terms WHERE vocab_version = 'feature-kind/1' AND slot = 'feature_kind' AND code = 'unknown_feature');
