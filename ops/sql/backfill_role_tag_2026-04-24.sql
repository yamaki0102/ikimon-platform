-- Phase γ role_tag backfill: 既存 subject_media_regions から
-- evidence_assets.role_tag を heuristic 推定で埋める。
--
-- 2026-04-24: runAiForMissing の bulk 再生成は role_tag コード deploy 前に
-- 開始されたので、bulk が書いた subject_media_regions rows から事後的に
-- role_tag を派生する。面積基準:
--   max_area >= 0.55   → full_body
--   0 < max_area < 0.55 → close_up_organ
--   region なし        → habitat_wide
--
-- 更新対象は role_tag IS NULL OR role_tag_source='ai' のみ
-- (user/heuristic で手動設定されたものは保護)。

BEGIN;

-- (1) region が存在する asset の role_tag
WITH region_areas AS (
  SELECT smr.asset_id,
         MAX(
           COALESCE((smr.normalized_rect->>'width')::float, 0) *
           COALESCE((smr.normalized_rect->>'height')::float, 0)
         ) AS max_area
    FROM subject_media_regions smr
   GROUP BY smr.asset_id
)
UPDATE evidence_assets ea
   SET role_tag = CASE
         WHEN ra.max_area >= 0.55 THEN 'full_body'
         WHEN ra.max_area >  0    THEN 'close_up_organ'
         ELSE                          'habitat_wide'
       END,
       role_tag_source = 'ai'
  FROM region_areas ra
 WHERE ea.asset_id = ra.asset_id
   AND ea.asset_role = 'observation_photo'
   AND (ea.role_tag IS NULL OR ea.role_tag_source = 'ai');

-- (2) region が 1 つも無い asset → habitat_wide
UPDATE evidence_assets ea
   SET role_tag = 'habitat_wide',
       role_tag_source = 'ai'
 WHERE ea.asset_role = 'observation_photo'
   AND (ea.role_tag IS NULL OR ea.role_tag_source = 'ai')
   AND NOT EXISTS (
         SELECT 1 FROM subject_media_regions smr WHERE smr.asset_id = ea.asset_id
       );

COMMIT;

-- 確認
SELECT role_tag, count(*) AS n
  FROM evidence_assets
 WHERE asset_role = 'observation_photo'
 GROUP BY role_tag
 ORDER BY n DESC;
