CREATE TABLE IF NOT EXISTS municipal_walk_map_creators (
  creator_id TEXT PRIMARY KEY,
  creator_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  organization_name TEXT,
  official_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  commercial_policy TEXT NOT NULL DEFAULT 'restricted',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS municipal_walk_maps (
  walk_map_id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  municipality_code TEXT NOT NULL,
  municipality TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  theme TEXT NOT NULL,
  publish_mode TEXT NOT NULL,
  route_style TEXT NOT NULL DEFAULT 'loose_stops',
  mobility_modes_json TEXT NOT NULL DEFAULT '[]',
  source_references_json TEXT NOT NULL DEFAULT '[]',
  area_hint_json TEXT NOT NULL,
  stop_count INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 100,
  source_license_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES municipal_walk_map_creators (creator_id)
);

CREATE INDEX IF NOT EXISTS idx_municipal_walk_maps_municipality
  ON municipal_walk_maps (municipality_code, publish_mode, display_order);

CREATE TABLE IF NOT EXISTS municipal_walk_map_stops (
  stop_id TEXT PRIMARY KEY,
  walk_map_id TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  area_hint_json TEXT NOT NULL,
  safety_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (walk_map_id) REFERENCES municipal_walk_maps (walk_map_id)
);

CREATE INDEX IF NOT EXISTS idx_municipal_walk_map_stops_map_order
  ON municipal_walk_map_stops (walk_map_id, display_order);

CREATE TABLE IF NOT EXISTS municipal_walk_map_audit (
  audit_id TEXT PRIMARY KEY,
  walk_map_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_label TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO municipal_walk_map_creators (
  creator_id, creator_type, display_name, organization_name, official_url, verification_status, commercial_policy
) VALUES (
  'creator-shizuoka-city-official-sample',
  'municipality',
  '静岡市',
  '静岡市',
  'https://www.city.shizuoka.lg.jp/s6347/s001494.html',
  'official_source_referenced',
  'restricted'
);

INSERT OR IGNORE INTO municipal_walk_maps (
  walk_map_id, creator_id, municipality_code, municipality, title, summary, theme, publish_mode,
  route_style, mobility_modes_json, source_references_json, area_hint_json, stop_count, display_order, source_license_note
) VALUES
(
  'jp-shizuoka-yatsuyama-sample-v0',
  'creator-shizuoka-city-official-sample',
  '22100',
  '静岡市',
  '八ツ山周辺を歩くサンプル',
  '静岡市公式資料を出典として、公開範囲で木陰、足元の草地、鳥の声を軽く残すために再構成したサンプルです。',
  'satoyama',
  'public_preview',
  'loose_stops',
  '["walk","bike","public_transport"]',
  '[{"label":"静岡市 いきもの散策マップ","url":"https://www.city.shizuoka.lg.jp/s6347/s001494.html","note":"静岡市公式ページを出典として表示します。"}]',
  '{"lat":34.986,"lng":138.407,"label":"谷津山周辺","precision":"area_hint","source":"official_source_sample"}',
  2,
  10,
  '公式ページURLと出典を表示し、ikimon上では公開範囲のサンプルとして再構成します。'
),
(
  'jp-shizuoka-asahata-waterfront-sample-v0',
  'creator-shizuoka-city-official-sample',
  '22100',
  '静岡市',
  '麻機の水辺を歩くサンプル',
  '静岡市公式資料を出典として、水辺を安全に見ながら、鳥の声、水面、草地の変化を残すサンプルです。',
  'waterfront',
  'public_preview',
  'loose_stops',
  '["walk","bike","public_transport"]',
  '[{"label":"静岡市 いきもの散策マップ","url":"https://www.city.shizuoka.lg.jp/s6347/s001494.html","note":"静岡市公式ページを出典として表示します。"}]',
  '{"lat":35.015,"lng":138.389,"label":"麻機の水辺","precision":"area_hint","source":"official_source_sample"}',
  2,
  20,
  '公式ページURLと出典を表示し、ikimon上では公開範囲のサンプルとして再構成します。'
),
(
  'jp-shizuoka-mariko-waterfront-sample-v0',
  'creator-shizuoka-city-official-sample',
  '22100',
  '静岡市',
  '丸子川・広野海岸公園周辺サンプル',
  '静岡市公式資料を出典として、川と海岸公園の公開範囲で、水辺の様子や鳥の声を残すサンプルです。',
  'waterfront',
  'public_preview',
  'loose_stops',
  '["walk","bike","car","public_transport"]',
  '[{"label":"静岡市 いきもの散策マップ","url":"https://www.city.shizuoka.lg.jp/s6347/s001494.html","note":"静岡市公式ページを出典として表示します。"}]',
  '{"lat":34.925,"lng":138.379,"label":"丸子川・広野海岸公園周辺","precision":"area_hint","source":"official_source_sample"}',
  2,
  30,
  '公式ページURLと出典を表示し、ikimon上では公開範囲のサンプルとして再構成します。'
);

INSERT OR IGNORE INTO municipal_walk_map_stops (
  stop_id, walk_map_id, display_order, title, note, area_hint_json, safety_note
) VALUES
(
  'stop-jp-shizuoka-yatsuyama-01',
  'jp-shizuoka-yatsuyama-sample-v0',
  10,
  '谷津山のふもと',
  '木陰や足元の草地をゆっくり見られる範囲です。',
  '{"lat":34.986,"lng":138.407,"precision":"area_hint","source":"official_source_sample"}',
  '立入可能な道から観察します。'
),
(
  'stop-jp-shizuoka-yatsuyama-02',
  'jp-shizuoka-yatsuyama-sample-v0',
  20,
  '周辺の緑地',
  '鳥の声や季節の植物を軽く記録する立ち寄り先です。',
  '{"lat":34.986,"lng":138.407,"precision":"area_hint","source":"official_source_sample"}',
  '私有地や学校敷地には入らない前提です。'
),
(
  'stop-jp-shizuoka-asahata-01',
  'jp-shizuoka-asahata-waterfront-sample-v0',
  10,
  '麻機の水辺',
  '水面、草地、鳥の動きを見やすい範囲です。',
  '{"lat":35.015,"lng":138.389,"precision":"area_hint","source":"official_source_sample"}',
  '水辺に近づきすぎず、足元を確認します。'
),
(
  'stop-jp-shizuoka-asahata-02',
  'jp-shizuoka-asahata-waterfront-sample-v0',
  20,
  '周辺の草地',
  '季節で変わる草地の様子を残しやすい立ち寄り先です。',
  '{"lat":35.015,"lng":138.389,"precision":"area_hint","source":"official_source_sample"}',
  '案内がある範囲で観察します。'
),
(
  'stop-jp-shizuoka-mariko-01',
  'jp-shizuoka-mariko-waterfront-sample-v0',
  10,
  '丸子川周辺',
  '川沿いの水辺や鳥の気配を見やすい範囲です。',
  '{"lat":34.925,"lng":138.379,"precision":"area_hint","source":"official_source_sample"}',
  '車道と水辺に注意します。'
),
(
  'stop-jp-shizuoka-mariko-02',
  'jp-shizuoka-mariko-waterfront-sample-v0',
  20,
  '広野海岸公園周辺',
  '海岸公園の公開範囲で風景と生きものの気配を残す立ち寄り先です。',
  '{"lat":34.925,"lng":138.379,"precision":"area_hint","source":"official_source_sample"}',
  '公園の案内に従って観察します。'
);
