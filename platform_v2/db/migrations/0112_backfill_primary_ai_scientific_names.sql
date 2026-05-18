-- destructive-ok: scoped data repair for primary AI recommendation names only; rollback by restoring affected occurrence/assessment rows from the pre-deploy DB snapshot or clearing values marked source=migration_0112_primary_ai_scientific_name_backfill.

WITH local_taxon_dictionary(vernacular_name, scientific_name, taxon_rank) AS (
    VALUES
        ('ナワシロイチゴ', 'Rubus parvifolius', 'species'),
        ('アカメガシワ', 'Mallotus japonicus', 'species'),
        ('カタバミ属', 'Oxalis', 'genus')
),
latest_assessment_matches AS (
    SELECT DISTINCT ON (a.occurrence_id)
           a.assessment_id,
           a.occurrence_id,
           d.vernacular_name,
           d.scientific_name,
           d.taxon_rank
      FROM observation_ai_assessments a
      JOIN local_taxon_dictionary d
        ON BTRIM(COALESCE(NULLIF(a.recommended_taxon_name, ''), NULLIF(a.best_specific_taxon_name, ''), '')) = d.vernacular_name
     WHERE a.occurrence_id IS NOT NULL
     ORDER BY a.occurrence_id, a.generated_at DESC
),
occurrence_updates AS (
    UPDATE occurrences o
       SET scientific_name = m.scientific_name,
           vernacular_name = COALESCE(NULLIF(o.vernacular_name, ''), m.vernacular_name),
           taxon_rank = COALESCE(NULLIF(o.taxon_rank, ''), m.taxon_rank),
           source_payload = COALESCE(o.source_payload, '{}'::jsonb)
             || jsonb_build_object(
                  'taxon_name_normalization',
                  jsonb_build_object(
                    'source', 'migration_0112_primary_ai_scientific_name_backfill',
                    'dictionary', 'local_taxon_dictionary',
                    'vernacular_name', m.vernacular_name,
                    'scientific_name', m.scientific_name,
                    'rank', m.taxon_rank
                  )
                ),
           updated_at = NOW()
      FROM latest_assessment_matches m
     WHERE o.occurrence_id = m.occurrence_id
       AND NULLIF(BTRIM(COALESCE(o.scientific_name, '')), '') IS NULL
    RETURNING m.assessment_id, m.occurrence_id, m.vernacular_name, m.scientific_name, m.taxon_rank
)
UPDATE visual_subject_candidates v
   SET scientific_name = u.scientific_name,
       taxon_rank = COALESCE(NULLIF(v.taxon_rank, ''), u.taxon_rank),
       source_payload = COALESCE(v.source_payload, '{}'::jsonb)
         || jsonb_build_object(
              'taxon_name_normalization',
              jsonb_build_object(
                'source', 'migration_0112_primary_ai_scientific_name_backfill',
                'dictionary', 'local_taxon_dictionary',
                'vernacular_name', u.vernacular_name,
                'scientific_name', u.scientific_name,
                'rank', u.taxon_rank
              )
            )
  FROM occurrence_updates u
 WHERE v.assessment_id = u.assessment_id
   AND v.subject_role = 'primary'
   AND NULLIF(BTRIM(COALESCE(v.scientific_name, '')), '') IS NULL;

WITH local_taxon_dictionary(vernacular_name, scientific_name, taxon_rank) AS (
    VALUES
        ('ナワシロイチゴ', 'Rubus parvifolius', 'species'),
        ('アカメガシワ', 'Mallotus japonicus', 'species'),
        ('カタバミ属', 'Oxalis', 'genus')
)
UPDATE observation_ai_assessments a
   SET recommended_rank = COALESCE(NULLIF(a.recommended_rank, ''), d.taxon_rank),
       raw_json = CASE
         WHEN COALESCE(a.raw_json, '{}'::jsonb) ? 'parsed' THEN
           jsonb_set(
             jsonb_set(
               COALESCE(a.raw_json, '{}'::jsonb),
               '{parsed,recommended_scientific_name}',
               to_jsonb(d.scientific_name),
               true
             ),
             '{parsed,recommended_rank}',
             to_jsonb(COALESCE(NULLIF(a.recommended_rank, ''), d.taxon_rank)),
             true
           )
         ELSE
           jsonb_set(
             jsonb_set(
               COALESCE(a.raw_json, '{}'::jsonb),
               '{recommended_scientific_name}',
               to_jsonb(d.scientific_name),
               true
             ),
             '{recommended_rank}',
             to_jsonb(COALESCE(NULLIF(a.recommended_rank, ''), d.taxon_rank)),
             true
           )
       END
  FROM local_taxon_dictionary d
 WHERE NULLIF(BTRIM(COALESCE(a.raw_json #>> '{parsed,recommended_scientific_name}', a.raw_json ->> 'recommended_scientific_name', '')), '') IS NULL
   AND BTRIM(COALESCE(NULLIF(a.recommended_taxon_name, ''), NULLIF(a.best_specific_taxon_name, ''), '')) = d.vernacular_name;
