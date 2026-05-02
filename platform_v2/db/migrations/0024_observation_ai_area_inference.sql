-- Phase α: observation_ai_assessments に area_inference / shot_suggestions を追加。
--
-- 2026-04-24 設計ドキュメント: docs/strategy 以下の
-- 「観察 1 枚からの情報最大化 + エリア推察 + 努力値組写真ガイド」Phase α。
--
-- 追加カラム:
--   * area_inference jsonb — 1 枚の画像から非断定で推察されるエリア属性。
--     siteBrief の決定論的ラベル (OSM/GSI) と相補。全要素 candidate 配列で
--     断定禁止 (canonical pack §1.5 trust boundary)。キー名:
--       vegetation_structure_candidates / succession_stage_candidates /
--       human_influence_candidates / moisture_regime_candidates /
--       management_hint_candidates
--     各要素は { label, why, confidence (0..1) } の形。
--
--   * shot_suggestions jsonb — この観察の research 価値を上げるための追加
--     撮影セット。要素は { role, target, rationale, priority } で role は
--     'full_body' | 'close_up_organ' | 'habitat_wide' | 'substrate' |
--     'scale_reference'。missing_evidence (形質情報) と confirm_more (次回
--     アクション) と重複しない、「今撮れる組写真」のガイド。
--
-- どちらも default '{}' / '[]' で NOT NULL なし。既存行は空のまま、次回
-- reassess 実行で埋まる。Phase γ で evidence_assets.role_tag を追加して
-- tier 昇格に反映するが、本 migration では占位のみ。

ALTER TABLE observation_ai_assessments
    ADD COLUMN IF NOT EXISTS area_inference  JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS shot_suggestions JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN observation_ai_assessments.area_inference IS
  'AI 推察エリア属性 (非断定、candidate 配列群)。siteBrief と相補。Phase α 2026-04-24。';
COMMENT ON COLUMN observation_ai_assessments.shot_suggestions IS
  '追加撮影ガイド配列。要素: {role, target, rationale, priority}。Phase α 2026-04-24。';
