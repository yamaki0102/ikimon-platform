CREATE TABLE IF NOT EXISTS site_brief_generation_runs (
  generation_run_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generated', 'approved', 'suppressed', 'archived')),
  generation_method TEXT NOT NULL DEFAULT 'manual'
    CHECK (generation_method IN ('manual', 'assisted', 'automated')),
  artifact_contract_version TEXT NOT NULL DEFAULT 'site_brief_artifact_v1',
  ruleset_version TEXT NOT NULL DEFAULT 'site_brief_manual_pilot_v1',
  source_summary_json TEXT NOT NULL DEFAULT '{}',
  human_decision_json TEXT NOT NULL DEFAULT '{}',
  suppression_reason TEXT,
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_brief_generation_runs_place
  ON site_brief_generation_runs(place_id, status, updated_at);

CREATE TABLE IF NOT EXISTS site_brief_artifacts (
  artifact_id TEXT PRIMARY KEY,
  generation_run_id TEXT NOT NULL REFERENCES site_brief_generation_runs(generation_run_id),
  place_id TEXT NOT NULL,
  public_cell TEXT NOT NULL,
  artifact_scope TEXT NOT NULL DEFAULT 'internal'
    CHECK (artifact_scope IN ('internal', 'external', 'private_share')),
  artifact_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (artifact_status IN ('draft', 'active', 'suppressed', 'archived')),
  share_token TEXT UNIQUE,
  brief_json TEXT NOT NULL DEFAULT '{}',
  evidence_contract_json TEXT NOT NULL DEFAULT '{}',
  decision_state TEXT NOT NULL DEFAULT 'draft'
    CHECK (decision_state IN ('draft', 'approved_external', 'internal_only', 'suppressed', 'needs_evidence')),
  limitations_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_brief_artifacts_public_cell
  ON site_brief_artifacts(artifact_scope, artifact_status, public_cell, updated_at);

CREATE INDEX IF NOT EXISTS idx_site_brief_artifacts_share_token
  ON site_brief_artifacts(share_token, artifact_status);

CREATE TABLE IF NOT EXISTS site_brief_source_links (
  source_link_id TEXT PRIMARY KEY,
  generation_run_id TEXT NOT NULL REFERENCES site_brief_generation_runs(generation_run_id),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_role TEXT NOT NULL,
  public_safe INTEGER NOT NULL DEFAULT 0 CHECK (public_safe IN (0, 1)),
  source_summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_brief_source_links_run_safe
  ON site_brief_source_links(generation_run_id, public_safe, created_at);

CREATE TABLE IF NOT EXISTS site_brief_feedback_events (
  feedback_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES site_brief_artifacts(artifact_id),
  place_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL
    CHECK (feedback_type IN ('use_case', 'price_signal', 'correction', 'approval', 'internal_only', 'suppress', 'follow_up', 'other')),
  feedback_text TEXT NOT NULL DEFAULT '',
  buyer_segment TEXT,
  use_case TEXT,
  price_signal TEXT,
  contact_intent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_brief_feedback_events_artifact
  ON site_brief_feedback_events(artifact_id, created_at);

INSERT INTO site_brief_generation_runs (
  generation_run_id, place_id, status, generation_method, artifact_contract_version,
  ruleset_version, source_summary_json, human_decision_json, suppression_reason,
  generated_at, updated_at
) VALUES
(
  'site-brief-run-pilot-hamamatsu-east-waterside-edge-20260703',
  'pilot-hamamatsu-east-waterside-edge',
  'approved',
  'manual',
  'site_brief_artifact_v1',
  'site_brief_manual_pilot_v1',
  '{"sourceTypes":["manual_place_brief_pilot","public_area_context"],"sourceRecordExposure":"none","exactLocationExposure":"none"}',
  '{"decision":"approved_external","reviewer":"site_intelligence_p0","note":"手作業Place Briefを営業検証用Site Brief Artifactへ昇格"}',
  NULL,
  '2026-07-03T00:00:00.000Z',
  '2026-07-03T00:00:00.000Z'
),
(
  'site-brief-run-pilot-sanaruko-park-edge-20260703',
  'pilot-sanaruko-park-edge',
  'approved',
  'manual',
  'site_brief_artifact_v1',
  'site_brief_manual_pilot_v1',
  '{"sourceTypes":["manual_place_brief_pilot","public_area_context"],"sourceRecordExposure":"none","exactLocationExposure":"none"}',
  '{"decision":"approved_external","reviewer":"site_intelligence_p0","note":"手作業Place Briefを営業検証用Site Brief Artifactへ昇格"}',
  NULL,
  '2026-07-03T00:00:00.000Z',
  '2026-07-03T00:00:00.000Z'
),
(
  'site-brief-run-pilot-shijimizuka-heritage-green-20260703',
  'pilot-shijimizuka-heritage-green',
  'approved',
  'manual',
  'site_brief_artifact_v1',
  'site_brief_manual_pilot_v1',
  '{"sourceTypes":["manual_place_brief_pilot","public_area_context"],"sourceRecordExposure":"none","exactLocationExposure":"none"}',
  '{"decision":"approved_external","reviewer":"site_intelligence_p0","note":"手作業Place Briefを営業検証用Site Brief Artifactへ昇格"}',
  NULL,
  '2026-07-03T00:00:00.000Z',
  '2026-07-03T00:00:00.000Z'
)
ON CONFLICT(generation_run_id) DO UPDATE SET
  status = excluded.status,
  generation_method = excluded.generation_method,
  artifact_contract_version = excluded.artifact_contract_version,
  ruleset_version = excluded.ruleset_version,
  source_summary_json = excluded.source_summary_json,
  human_decision_json = excluded.human_decision_json,
  suppression_reason = excluded.suppression_reason,
  updated_at = excluded.updated_at;

INSERT INTO site_brief_artifacts (
  artifact_id, generation_run_id, place_id, public_cell, artifact_scope,
  artifact_status, share_token, brief_json, evidence_contract_json, decision_state,
  limitations_json, created_at, updated_at
) VALUES
(
  'site-brief-artifact-pilot-hamamatsu-east-waterside-edge-20260703',
  'site-brief-run-pilot-hamamatsu-east-waterside-edge-20260703',
  'pilot-hamamatsu-east-waterside-edge',
  '34.71,137.81',
  'external',
  'active',
  'share-hamamatsu-east-waterside-edge-20260703',
  '{"hypothesis":{"label":"水辺と緑地の境目を読む場所","confidence":0.68},"placeBrief":{"placeName":"浜松東部の水辺・緑地境界","placeType":"waterside_green_edge","publicLocationMode":"area_or_public_place","locationLabel":"浜松市東部の粗い公開セル","exactLocationExposed":false,"geometryExposed":false},"reasons":["水路、草地、街路樹が近く、季節の変化を比較しやすい公開範囲です。","少数記録を断定せず、次に観察すべき環境手がかりだけを示します。"],"checks":["水際、草地の縁、日陰、舗装のすき間を分けて見る。","同じ場所で晴天後と雨後を比べる。"],"captureHints":["広い景色を1枚、気になった生きものや痕跡を1枚残す。","水音、鳥の声、草刈り跡などの環境メモを添える。"],"environmentEvidence":[{"label":"環境タイプ","value":"水辺・草地・市街地の境界","source":"manual_place_brief_pilot","limitation":"現地確認と公開記録が増えるまで断定しません。"}],"limitations":["exact pin と個別記録は公開しません。","改善余地や管理評価は一般公開で断定しません。"]}',
  '{"contractVersion":"site_brief_artifact_v1","claimLevel":"site_brief","exactCoordinatesExposed":false,"geometryExposed":false,"location":{"exactCoordinatesExposed":false,"geometryExposed":false},"output":{"exactLocationExposed":false},"sourceTypes":["manual_place_brief_pilot","public_area_context"],"limitations":["exact pin と個別記録を公開しない営業検証用Site Briefです。"]}',
  'approved_external',
  '["exact pin と個別記録は公開しません。","改善余地や管理評価は一般公開で断定しません。","公開記録が増えるまで、少数記録由来の傾向は断定しません。"]',
  '2026-07-03T00:00:00.000Z',
  '2026-07-03T00:00:00.000Z'
),
(
  'site-brief-artifact-pilot-sanaruko-park-edge-20260703',
  'site-brief-run-pilot-sanaruko-park-edge-20260703',
  'pilot-sanaruko-park-edge',
  '34.72,137.70',
  'external',
  'active',
  'share-sanaruko-park-edge-20260703',
  '{"hypothesis":{"label":"湖岸の季節変化を読む場所","confidence":0.7},"placeBrief":{"placeName":"佐鳴湖周辺の水辺プロフィール","placeType":"lake_park_edge","publicLocationMode":"area_or_public_place","locationLabel":"佐鳴湖周辺の粗い公開セル","exactLocationExposed":false,"geometryExposed":false},"reasons":["湖岸、樹林、開けた草地を同じ公開範囲で比較できます。"],"checks":["水鳥、岸辺の植物、日陰の昆虫を分けて見る。"],"captureHints":["湖面を含む景色と、岸辺の近景を分けて残す。"],"environmentEvidence":[{"label":"環境タイプ","value":"湖岸・樹林・草地","source":"manual_place_brief_pilot","limitation":"公開記録の集約条件を満たすまでは傾向を断定しません。"}],"limitations":["exact pin と個別記録は公開しません。"]}',
  '{"contractVersion":"site_brief_artifact_v1","claimLevel":"site_brief","exactCoordinatesExposed":false,"geometryExposed":false,"location":{"exactCoordinatesExposed":false,"geometryExposed":false},"output":{"exactLocationExposed":false},"sourceTypes":["manual_place_brief_pilot","public_area_context"],"limitations":["exact pin と個別記録を公開しない営業検証用Site Briefです。"]}',
  'approved_external',
  '["exact pin と個別記録は公開しません。","公開記録の集約条件を満たすまでは傾向を断定しません。"]',
  '2026-07-03T00:00:00.000Z',
  '2026-07-03T00:00:00.000Z'
),
(
  'site-brief-artifact-pilot-shijimizuka-heritage-green-20260703',
  'site-brief-run-pilot-shijimizuka-heritage-green-20260703',
  'pilot-shijimizuka-heritage-green',
  '34.71,137.72',
  'external',
  'active',
  'share-shijimizuka-heritage-green-20260703',
  '{"hypothesis":{"label":"緑地と生活道路の境目を読む場所","confidence":0.64},"placeBrief":{"placeName":"蜆塚周辺の緑地プロフィール","placeType":"heritage_green_edge","publicLocationMode":"area_or_public_place","locationLabel":"蜆塚周辺の粗い公開セル","exactLocationExposed":false,"geometryExposed":false},"reasons":["まとまった緑と生活道路が近く、身近な生きものの通り道を見比べやすい場所です。"],"checks":["樹木の根元、草地の縁、石や壁の周辺を見る。"],"captureHints":["全体の環境写真と、見つけた痕跡の近景を分けて残す。"],"environmentEvidence":[{"label":"環境タイプ","value":"緑地・生活道路・文化施設周辺","source":"manual_place_brief_pilot","limitation":"管理評価や改善余地は公開断定しません。"}],"limitations":["exact pin と個別記録は公開しません。"]}',
  '{"contractVersion":"site_brief_artifact_v1","claimLevel":"site_brief","exactCoordinatesExposed":false,"geometryExposed":false,"location":{"exactCoordinatesExposed":false,"geometryExposed":false},"output":{"exactLocationExposed":false},"sourceTypes":["manual_place_brief_pilot","public_area_context"],"limitations":["exact pin と個別記録を公開しない営業検証用Site Briefです。"]}',
  'approved_external',
  '["exact pin と個別記録は公開しません。","管理評価や改善余地は一般公開で断定しません。"]',
  '2026-07-03T00:00:00.000Z',
  '2026-07-03T00:00:00.000Z'
)
ON CONFLICT(artifact_id) DO UPDATE SET
  generation_run_id = excluded.generation_run_id,
  public_cell = excluded.public_cell,
  artifact_scope = excluded.artifact_scope,
  artifact_status = excluded.artifact_status,
  share_token = excluded.share_token,
  brief_json = excluded.brief_json,
  evidence_contract_json = excluded.evidence_contract_json,
  decision_state = excluded.decision_state,
  limitations_json = excluded.limitations_json,
  updated_at = excluded.updated_at;

INSERT INTO site_brief_source_links (
  source_link_id, generation_run_id, source_type, source_id, source_role,
  public_safe, source_summary_json, created_at
) VALUES
(
  'site-brief-source-pilot-hamamatsu-east-waterside-edge-20260703',
  'site-brief-run-pilot-hamamatsu-east-waterside-edge-20260703',
  'place_brief_pilot',
  'pilot-hamamatsu-east-waterside-edge',
  'brief_seed',
  1,
  '{"label":"手作業Place Brief seed","publicExposure":"summary_only"}',
  '2026-07-03T00:00:00.000Z'
),
(
  'site-brief-source-pilot-sanaruko-park-edge-20260703',
  'site-brief-run-pilot-sanaruko-park-edge-20260703',
  'place_brief_pilot',
  'pilot-sanaruko-park-edge',
  'brief_seed',
  1,
  '{"label":"手作業Place Brief seed","publicExposure":"summary_only"}',
  '2026-07-03T00:00:00.000Z'
),
(
  'site-brief-source-pilot-shijimizuka-heritage-green-20260703',
  'site-brief-run-pilot-shijimizuka-heritage-green-20260703',
  'place_brief_pilot',
  'pilot-shijimizuka-heritage-green',
  'brief_seed',
  1,
  '{"label":"手作業Place Brief seed","publicExposure":"summary_only"}',
  '2026-07-03T00:00:00.000Z'
)
ON CONFLICT(source_link_id) DO UPDATE SET
  source_type = excluded.source_type,
  source_id = excluded.source_id,
  source_role = excluded.source_role,
  public_safe = excluded.public_safe,
  source_summary_json = excluded.source_summary_json;
