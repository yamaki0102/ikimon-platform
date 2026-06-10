-- 同名属・同名分類群の taxon insight キャッシュ衝突を避ける。
-- 例: Chloris は鳥の属名にも植物の属名にも使われるため、学名文字列だけでは不足する。
-- owner-sensitive-ok: deploy role must own taxon_insights_cache; rollback is to drop
-- idx_taxon_insights_lookup_context, recreate idx_taxon_insights_lookup on (scientific_name, lang),
-- and restore UNIQUE (scientific_name, lang) after deleting context-specific duplicate rows.

ALTER TABLE taxon_insights_cache
    ADD COLUMN IF NOT EXISTS context_key TEXT NOT NULL DEFAULT '';

ALTER TABLE taxon_insights_cache
    DROP CONSTRAINT IF EXISTS taxon_insights_cache_scientific_name_lang_key;

DROP INDEX IF EXISTS idx_taxon_insights_lookup;

CREATE UNIQUE INDEX IF NOT EXISTS idx_taxon_insights_lookup_context
    ON taxon_insights_cache (scientific_name, lang, context_key);
