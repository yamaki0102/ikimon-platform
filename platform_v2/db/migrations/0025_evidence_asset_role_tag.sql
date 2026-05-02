-- Phase γ: evidence_assets に role_tag 関連カラムを追加。
--
-- 2026-04-24 設計: shot_suggestions (Phase α) と相補で「組写真カバレッジ」
-- を表現。Tier 1 → 1.5 自動昇格の代替経路 (confidence ≥ 0.7 かつ
-- regional prior かつ role coverage ≥ 3 roles) に使う。Tier 2+ には触らない。
--
-- カラム:
--   * role_tag — 写真の役割 (enum 相当):
--       'full_body' | 'close_up_organ' | 'habitat_wide' | 'substrate' |
--       'scale_reference' | 'unknown'
--     nullable。未判定は NULL or 'unknown'。
--   * role_tag_source — 推定の出所:
--       'user' (手動) | 'ai' (Gemini heuristic) | 'heuristic' (ルール)
--   * organ_target — クローズアップ対象部位の具体名 (例「後翅裏面」)。
--
-- 既存 evidence_tags (free form) は残す。role_tag は独立列。
-- すべて nullable / default null、NOT NULL 制約なし。
-- ロールバック容易性を最優先 (列追加のみ、破壊的変更なし)。

ALTER TABLE evidence_assets
    ADD COLUMN IF NOT EXISTS role_tag         TEXT,
    ADD COLUMN IF NOT EXISTS role_tag_source  TEXT,
    ADD COLUMN IF NOT EXISTS organ_target     TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_assets_role_tag_check'
  ) THEN
    ALTER TABLE evidence_assets
      ADD CONSTRAINT evidence_assets_role_tag_check
      CHECK (
        role_tag IS NULL
        OR role_tag IN (
          'full_body','close_up_organ','habitat_wide','substrate',
          'scale_reference','unknown'
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_assets_role_tag_source_check'
  ) THEN
    ALTER TABLE evidence_assets
      ADD CONSTRAINT evidence_assets_role_tag_source_check
      CHECK (
        role_tag_source IS NULL
        OR role_tag_source IN ('user','ai','heuristic')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_evidence_assets_role_tag
    ON evidence_assets (occurrence_id, role_tag)
    WHERE role_tag IS NOT NULL;

COMMENT ON COLUMN evidence_assets.role_tag IS
  '写真役割 (full_body/close_up_organ/habitat_wide/substrate/scale_reference/unknown)。Phase γ 2026-04-24。';
COMMENT ON COLUMN evidence_assets.role_tag_source IS
  '役割判定の出所 (user/ai/heuristic)。Phase γ 2026-04-24。';
COMMENT ON COLUMN evidence_assets.organ_target IS
  'クローズアップ対象部位 (例「後翅裏面」)。Phase γ 2026-04-24。';
