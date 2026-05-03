-- Resolved field IDs on visits (point-in-polygon precomputed) — Phase 2
--
-- Purpose:
--   観察を記録した瞬間に「どのエリアに含まれるか」を turf.js の
--   point-in-polygon で解決して visits.resolved_field_ids[] に書き込む。
--   これで area-snapshot の集計クエリは
--     `WHERE $field_id = ANY(resolved_field_ids)`
--   で爆速 (現状は bbox + JSONB 直走り)。
--
--   配列にしているのは複数階層 (公園 + 市 + 県 + 国) が同時にヒットするため。
--   集計の二重カウントは TNFD/30by30 報告でも標準的な扱い。
--
-- owner-sensitive-ok: nullable array column. 既存行は NULL のままで
-- area-snapshot の OR 条件 (field_id / place_id / bbox) フォールバックが有効。

ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS resolved_field_ids UUID[];

CREATE INDEX IF NOT EXISTS idx_visits_resolved_fields
    ON visits USING GIN (resolved_field_ids)
    WHERE resolved_field_ids IS NOT NULL;
