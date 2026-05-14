-- destructive-ok: scoped backfill only; rollback by clearing candidate suggested_occurrence_id rows marked migration=0106_materialize_visible_ai_subject_candidates and deleting inserted occurrences whose source_payload.ai_judgement.migration has that value after restoring from a DB snapshot if needed.

CREATE TEMP TABLE tmp_visible_ai_subject_candidate_records ON COMMIT DROP AS
WITH eligible AS (
    SELECT
        c.candidate_id,
        c.ai_run_id,
        c.visit_id,
        v.legacy_observation_id,
        c.candidate_key,
        c.vernacular_name,
        c.scientific_name,
        c.taxon_rank,
        c.confidence_score,
        c.note,
        c.source_payload,
        existing.occurrence_id AS existing_occurrence_id,
        existing.subject_index AS existing_subject_index
    FROM observation_ai_subject_candidates c
    JOIN visits v ON v.visit_id = c.visit_id
    LEFT JOIN LATERAL (
        SELECT o.occurrence_id, o.subject_index
        FROM occurrences o
        WHERE o.visit_id = c.visit_id
          AND (
              o.source_payload ->> 'ai_judgement_candidate_key' = c.candidate_key
              OR o.source_payload #>> '{ai_judgement,candidate_id}' = c.candidate_id::text
          )
        ORDER BY o.subject_index ASC
        LIMIT 1
    ) existing ON TRUE
    WHERE c.suggested_occurrence_id IS NULL
      AND c.candidate_status IN ('proposed', 'matched')
      AND (NULLIF(BTRIM(c.vernacular_name), '') IS NOT NULL OR NULLIF(BTRIM(c.scientific_name), '') IS NOT NULL)
      AND (
          NULLIF(BTRIM(c.taxon_rank), '') IS NULL
          OR LOWER(c.taxon_rank) IN ('species', 'genus', 'family', 'lifeform')
      )
      AND (c.confidence_score IS NULL OR c.confidence_score >= 0.5)
      AND EXISTS (
          SELECT 1
          FROM subject_media_regions smr
          WHERE smr.candidate_id = c.candidate_id
            AND COALESCE(smr.confidence_score, 1) >= 0.45
            AND jsonb_typeof(smr.normalized_rect) = 'object'
            AND smr.normalized_rect ? 'x'
            AND smr.normalized_rect ? 'width'
            AND smr.normalized_rect ? 'height'
      )
),
new_candidates AS (
    SELECT
        e.*,
        COALESCE(max_subject.max_subject_index, -1)
          + ROW_NUMBER() OVER (
              PARTITION BY e.visit_id
              ORDER BY e.confidence_score DESC NULLS LAST, e.candidate_id
            ) AS assigned_subject_index
    FROM eligible e
    LEFT JOIN LATERAL (
        SELECT MAX(o.subject_index) AS max_subject_index
        FROM occurrences o
        WHERE o.visit_id = e.visit_id
    ) max_subject ON TRUE
    WHERE e.existing_occurrence_id IS NULL
)
SELECT
    e.candidate_id,
    e.ai_run_id,
    e.visit_id,
    e.legacy_observation_id,
    e.candidate_key,
    e.vernacular_name,
    e.scientific_name,
    e.taxon_rank,
    e.confidence_score,
    e.note,
    e.source_payload,
    COALESCE(e.existing_occurrence_id, 'occ:' || e.visit_id || ':' || n.assigned_subject_index::text) AS occurrence_id,
    COALESCE(e.existing_subject_index, n.assigned_subject_index)::integer AS subject_index,
    e.existing_occurrence_id IS NOT NULL AS matched_existing
FROM eligible e
LEFT JOIN new_candidates n ON n.candidate_id = e.candidate_id;

INSERT INTO occurrences (
    occurrence_id,
    visit_id,
    legacy_observation_id,
    subject_index,
    scientific_name,
    vernacular_name,
    taxon_rank,
    basis_of_record,
    occurrence_status,
    confidence_score,
    evidence_tier,
    data_quality,
    quality_grade,
    ai_assessment_status,
    source_payload,
    created_at,
    updated_at
)
SELECT
    t.occurrence_id,
    t.visit_id,
    COALESCE(t.legacy_observation_id, t.visit_id),
    t.subject_index,
    NULLIF(BTRIM(t.scientific_name), ''),
    NULLIF(BTRIM(t.vernacular_name), ''),
    NULLIF(BTRIM(t.taxon_rank), ''),
    'HumanObservation',
    'present',
    t.confidence_score,
    0.5,
    'ai_only_unreviewed',
    'ai_judgement',
    'ai_judgement',
    jsonb_build_object(
        'source', 'ai_judgement_observation_record',
        'ai_judgement_candidate_key', t.candidate_key,
        'ai_judgement', jsonb_build_object(
            'status', 'ai_judgement',
            'ai_run_id', t.ai_run_id,
            'candidate_id', t.candidate_id,
            'confidence', t.confidence_score,
            'note', t.note,
            'source_tag', COALESCE(t.source_payload ->> 'sourceTag', 'migration_0106_visible_candidate'),
            'migration', '0106_materialize_visible_ai_subject_candidates',
            'gbif', COALESCE(t.source_payload -> 'gbif', 'null'::jsonb)
        ),
        'v2_subject', jsonb_build_object(
            'subject_index', t.subject_index,
            'is_primary', FALSE,
            'role_hint', CASE WHEN LOWER(COALESCE(t.taxon_rank, '')) = 'lifeform' THEN 'vegetation' ELSE 'coexisting' END,
            'confidence', t.confidence_score,
            'note', t.note
        )
    ),
    NOW(),
    NOW()
FROM tmp_visible_ai_subject_candidate_records t
WHERE NOT t.matched_existing;

UPDATE observation_ai_subject_candidates c
SET
    suggested_occurrence_id = t.occurrence_id,
    candidate_status = 'matched',
    source_payload = COALESCE(c.source_payload, '{}'::jsonb)
        || jsonb_build_object(
            'ai_judgement_backfill',
            jsonb_build_object(
                'migration', '0106_materialize_visible_ai_subject_candidates',
                'occurrence_id', t.occurrence_id,
                'matched_existing', t.matched_existing,
                'materialized_at', NOW()
            )
        ),
    updated_at = NOW()
FROM tmp_visible_ai_subject_candidate_records t
WHERE c.candidate_id = t.candidate_id
  AND EXISTS (
      SELECT 1
      FROM occurrences o
      WHERE o.occurrence_id = t.occurrence_id
  );

UPDATE subject_media_regions smr
SET
    occurrence_id = t.occurrence_id,
    source_payload = COALESCE(smr.source_payload, '{}'::jsonb)
        || jsonb_build_object(
            'ai_judgement_backfill',
            jsonb_build_object(
                'migration', '0106_materialize_visible_ai_subject_candidates',
                'occurrence_id', t.occurrence_id
            )
        )
FROM tmp_visible_ai_subject_candidate_records t
WHERE smr.candidate_id = t.candidate_id
  AND smr.occurrence_id IS NULL
  AND EXISTS (
      SELECT 1
      FROM occurrences o
      WHERE o.occurrence_id = t.occurrence_id
  );

UPDATE visual_subject_candidates vsc
SET
    occurrence_id = t.occurrence_id,
    source_payload = COALESCE(vsc.source_payload, '{}'::jsonb)
        || jsonb_build_object(
            'ai_judgement_backfill',
            jsonb_build_object(
                'migration', '0106_materialize_visible_ai_subject_candidates',
                'occurrence_id', t.occurrence_id
            )
        )
FROM tmp_visible_ai_subject_candidate_records t
WHERE vsc.candidate_id = t.candidate_id
  AND vsc.occurrence_id IS NULL
  AND EXISTS (
      SELECT 1
      FROM occurrences o
      WHERE o.occurrence_id = t.occurrence_id
  );

UPDATE visual_asset_regions var
SET
    occurrence_id = t.occurrence_id,
    source_payload = COALESCE(var.source_payload, '{}'::jsonb)
        || jsonb_build_object(
            'ai_judgement_backfill',
            jsonb_build_object(
                'migration', '0106_materialize_visible_ai_subject_candidates',
                'occurrence_id', t.occurrence_id
            )
        )
FROM tmp_visible_ai_subject_candidate_records t
WHERE var.candidate_id = t.candidate_id
  AND var.occurrence_id IS NULL
  AND EXISTS (
      SELECT 1
      FROM occurrences o
      WHERE o.occurrence_id = t.occurrence_id
  );
