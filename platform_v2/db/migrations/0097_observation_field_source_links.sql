-- owner-sensitive-ok: observation_fields に一次情報リンクの種別列を追加し、既存の公式URL運用を後方互換で保持する。
-- destructive-ok: 既存URLを新列へ分類するデータ補正のみ。削除や縮退は行わず、失敗時は追加列を無視してロールバック可能。

ALTER TABLE observation_fields
  ADD COLUMN IF NOT EXISTS owner_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS story_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS certification_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_confidence NUMERIC(4,3) NOT NULL DEFAULT 0;

UPDATE observation_fields
   SET story_url = official_url
 WHERE story_url = ''
   AND official_url ~* '^https?://([^/]+\.)?ikimon\.life([/:?#]|$)';

UPDATE observation_fields
   SET owner_url = official_url
 WHERE owner_url = ''
   AND official_url <> ''
   AND official_url !~* '^https?://([^/]+\.)?ikimon\.life([/:?#]|$)'
   AND certification_url = '';

UPDATE observation_fields
   SET official_url = COALESCE(NULLIF(owner_url, ''), NULLIF(certification_url, ''), '')
 WHERE official_url ~* '^https?://([^/]+\.)?ikimon\.life([/:?#]|$)';

UPDATE observation_fields
   SET source_confidence = CASE
     WHEN owner_url <> '' AND certification_url <> '' THEN 1.000
     WHEN owner_url <> '' OR certification_url <> '' THEN 0.950
     WHEN official_url <> '' THEN 0.750
     WHEN story_url <> '' THEN 0.450
     ELSE source_confidence
   END
 WHERE source_confidence = 0;
