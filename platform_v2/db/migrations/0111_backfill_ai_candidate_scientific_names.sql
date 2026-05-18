-- destructive-ok: scoped data repair for AI candidate names only; rollback by clearing scientific_name/taxon_rank values marked source=migration_0111_ai_candidate_scientific_name_backfill from AI-only candidate rows if a DB snapshot restore is not used.

WITH local_taxon_dictionary(vernacular_name, scientific_name, taxon_rank) AS (
    VALUES
        ('ナワシロイチゴ', 'Rubus parvifolius', 'species'),
        ('アカメガシワ', 'Mallotus japonicus', 'species'),
        ('カタバミ属', 'Oxalis', 'genus')
),
candidate_updates AS (
    UPDATE observation_ai_subject_candidates c
       SET scientific_name = d.scientific_name,
           taxon_rank = COALESCE(NULLIF(c.taxon_rank, ''), d.taxon_rank),
           source_payload = COALESCE(c.source_payload, '{}'::jsonb)
             || jsonb_build_object(
                  'taxon_name_normalization',
                  jsonb_build_object(
                    'source', 'migration_0111_ai_candidate_scientific_name_backfill',
                    'dictionary', 'local_taxon_dictionary',
                    'vernacular_name', d.vernacular_name,
                    'scientific_name', d.scientific_name,
                    'rank', d.taxon_rank
                  )
                ),
           updated_at = NOW()
      FROM local_taxon_dictionary d
     WHERE NULLIF(BTRIM(COALESCE(c.scientific_name, '')), '') IS NULL
       AND BTRIM(COALESCE(c.vernacular_name, '')) = d.vernacular_name
    RETURNING c.candidate_id, c.suggested_occurrence_id, d.vernacular_name, d.scientific_name, d.taxon_rank
)
UPDATE visual_subject_candidates v
   SET scientific_name = u.scientific_name,
       taxon_rank = COALESCE(NULLIF(v.taxon_rank, ''), u.taxon_rank),
       source_payload = COALESCE(v.source_payload, '{}'::jsonb)
         || jsonb_build_object(
              'taxon_name_normalization',
              jsonb_build_object(
                'source', 'migration_0111_ai_candidate_scientific_name_backfill',
                'dictionary', 'local_taxon_dictionary',
                'vernacular_name', u.vernacular_name,
                'scientific_name', u.scientific_name,
                'rank', u.taxon_rank
              )
            )
  FROM candidate_updates u
 WHERE v.candidate_id = u.candidate_id
   AND NULLIF(BTRIM(COALESCE(v.scientific_name, '')), '') IS NULL;

WITH local_taxon_dictionary(vernacular_name, scientific_name, taxon_rank) AS (
    VALUES
        ('ナワシロイチゴ', 'Rubus parvifolius', 'species'),
        ('アカメガシワ', 'Mallotus japonicus', 'species'),
        ('カタバミ属', 'Oxalis', 'genus')
),
candidate_links AS (
    SELECT c.suggested_occurrence_id AS occurrence_id,
           d.vernacular_name,
           d.scientific_name,
           d.taxon_rank
      FROM observation_ai_subject_candidates c
      JOIN local_taxon_dictionary d
        ON BTRIM(COALESCE(c.vernacular_name, '')) = d.vernacular_name
     WHERE c.suggested_occurrence_id IS NOT NULL
)
UPDATE occurrences o
   SET scientific_name = l.scientific_name,
       taxon_rank = COALESCE(NULLIF(o.taxon_rank, ''), l.taxon_rank),
       source_payload = COALESCE(o.source_payload, '{}'::jsonb)
         || jsonb_build_object(
              'taxon_name_normalization',
              jsonb_build_object(
                'source', 'migration_0111_ai_candidate_scientific_name_backfill',
                'dictionary', 'local_taxon_dictionary',
                'vernacular_name', l.vernacular_name,
                'scientific_name', l.scientific_name,
                'rank', l.taxon_rank
              )
            ),
       updated_at = NOW()
  FROM candidate_links l
 WHERE o.occurrence_id = l.occurrence_id
   AND NULLIF(BTRIM(COALESCE(o.scientific_name, '')), '') IS NULL;
