CREATE TABLE IF NOT EXISTS place_brief_pilots (
  place_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'suppressed', 'archived')),
  place_name TEXT NOT NULL,
  place_type TEXT NOT NULL,
  public_cell TEXT NOT NULL,
  location_label TEXT NOT NULL,
  brief_json TEXT NOT NULL DEFAULT '{}',
  evidence_contract_json TEXT NOT NULL DEFAULT '{}',
  generation_method TEXT NOT NULL DEFAULT 'manual_pilot'
    CHECK (generation_method IN ('manual_pilot', 'semiautomated_pilot')),
  generation_run_id TEXT,
  policy_version TEXT NOT NULL DEFAULT 'manual_place_brief_pilot_v1',
  created_by TEXT NOT NULL DEFAULT 'site_intelligence_p0',
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_place_brief_pilots_status_cell
  ON place_brief_pilots(status, public_cell);

INSERT INTO place_brief_pilots (
  place_id, status, place_name, place_type, public_cell, location_label,
  brief_json, evidence_contract_json, generation_method, generation_run_id,
  policy_version, created_by, generated_at, updated_at
) VALUES
(
  'pilot-hamamatsu-east-waterside-edge',
  'published',
  '浜松東部の水辺・緑地境界',
  'waterside_green_edge',
  '34.71,137.81',
  '浜松市東部の粗い公開セル',
  '{"hypothesis":{"label":"水辺と緑地の境目を読む場所","confidence":0.68},"reasons":["水路、草地、街路樹が近く、季節の変化を比較しやすい公開範囲です。","少数記録を断定せず、次に観察すべき環境手がかりだけを示します。"],"checks":["水際、草地の縁、日陰、舗装のすき間を分けて見る。","同じ場所で晴天後と雨後を比べる。"],"captureHints":["広い景色を1枚、気になった生きものや痕跡を1枚残す。","水音、鳥の声、草刈り跡などの環境メモを添える。"],"environmentEvidence":[{"label":"環境タイプ","value":"水辺・草地・市街地の境界","source":"manual_place_brief_pilot","limitation":"現地確認と公開記録が増えるまで断定しません。"}],"limitations":["exact pin と個別記録は公開しません。","改善余地や管理評価は一般公開で断定しません。"]}',
  '{"contractVersion":"manual_place_brief_pilot_v1","claimLevel":"place_context_brief","exactCoordinatesExposed":false,"sourceTypes":["manual_pilot","public_area_context"],"limitations":["exact pin と個別記録を使わない手作業の検証用 brief です。"]}',
  'manual_pilot',
  'manual-place-brief-pilot-20260703',
  'manual_place_brief_pilot_v1',
  'site_intelligence_p0',
  '2026-07-03T00:00:00.000Z',
  '2026-07-03T00:00:00.000Z'
),
(
  'pilot-sanaruko-park-edge',
  'published',
  '佐鳴湖周辺の水辺プロフィール',
  'lake_park_edge',
  '34.72,137.70',
  '佐鳴湖周辺の粗い公開セル',
  '{"hypothesis":{"label":"湖岸の季節変化を読む場所","confidence":0.7},"reasons":["湖岸、樹林、開けた草地を同じ公開範囲で比較できます。"],"checks":["水鳥、岸辺の植物、日陰の昆虫を分けて見る。"],"captureHints":["湖面を含む景色と、岸辺の近景を分けて残す。"],"environmentEvidence":[{"label":"環境タイプ","value":"湖岸・樹林・草地","source":"manual_place_brief_pilot","limitation":"公開記録の集約条件を満たすまでは傾向を断定しません。"}],"limitations":["exact pin と個別記録は公開しません。"]}',
  '{"contractVersion":"manual_place_brief_pilot_v1","claimLevel":"place_context_brief","exactCoordinatesExposed":false,"sourceTypes":["manual_pilot","public_area_context"],"limitations":["手作業の検証用 brief です。"]}',
  'manual_pilot',
  'manual-place-brief-pilot-20260703',
  'manual_place_brief_pilot_v1',
  'site_intelligence_p0',
  '2026-07-03T00:00:00.000Z',
  '2026-07-03T00:00:00.000Z'
),
(
  'pilot-shijimizuka-heritage-green',
  'published',
  '蜆塚周辺の緑地プロフィール',
  'heritage_green_edge',
  '34.71,137.72',
  '蜆塚周辺の粗い公開セル',
  '{"hypothesis":{"label":"緑地と生活道路の境目を読む場所","confidence":0.64},"reasons":["まとまった緑と生活道路が近く、身近な生きものの通り道を見比べやすい場所です。"],"checks":["樹木の根元、草地の縁、石や壁の周辺を見る。"],"captureHints":["全体の環境写真と、見つけた痕跡の近景を分けて残す。"],"environmentEvidence":[{"label":"環境タイプ","value":"緑地・生活道路・文化施設周辺","source":"manual_place_brief_pilot","limitation":"管理評価や改善余地は公開断定しません。"}],"limitations":["exact pin と個別記録は公開しません。"]}',
  '{"contractVersion":"manual_place_brief_pilot_v1","claimLevel":"place_context_brief","exactCoordinatesExposed":false,"sourceTypes":["manual_pilot","public_area_context"],"limitations":["手作業の検証用 brief です。"]}',
  'manual_pilot',
  'manual-place-brief-pilot-20260703',
  'manual_place_brief_pilot_v1',
  'site_intelligence_p0',
  '2026-07-03T00:00:00.000Z',
  '2026-07-03T00:00:00.000Z'
)
ON CONFLICT(place_id) DO UPDATE SET
  status = excluded.status,
  place_name = excluded.place_name,
  place_type = excluded.place_type,
  public_cell = excluded.public_cell,
  location_label = excluded.location_label,
  brief_json = excluded.brief_json,
  evidence_contract_json = excluded.evidence_contract_json,
  generation_method = excluded.generation_method,
  generation_run_id = excluded.generation_run_id,
  policy_version = excluded.policy_version,
  updated_at = excluded.updated_at;
