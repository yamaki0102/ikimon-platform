-- destructive-ok: scoped soft-repair only; rollback by reading non_biological_subject_repairs rows for migration=0114_repair_non_biological_subject_labels and restoring before_payload values. No rows are deleted.

CREATE TABLE IF NOT EXISTS non_biological_subject_repairs (
    migration       TEXT        NOT NULL,
    source_kind     TEXT        NOT NULL,
    source_id       TEXT        NOT NULL,
    visit_id        TEXT,
    occurrence_id   TEXT,
    candidate_id    UUID,
    before_payload  JSONB       NOT NULL,
    repaired_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (migration, source_kind, source_id)
);

CREATE TEMP TABLE tmp_non_biological_label_patterns (
    pattern TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_non_biological_label_patterns (pattern) VALUES
    ('^(芝生|芝|草|草地|雑草|裸地|地面|土|砂|砂地|礫|石|岩|石垣|城壁|瓦屋根|屋根|人工構造物|工事現場|景観|グランドカバー|植栽|低木|樹木|背景|周囲|群落|植物|花|葉|茎)$'),
    ('分類不能|未分類|構成種[:：]?|複数の|他の植栽|植栽低木|背景|周囲|裸地|踏圧|芝生|グランドカバー|人工構造物|工事現場|城壁|石垣|瓦屋根|シーサー|景観|植生景観|周辺植生|樹冠|草本群落|有機物残渣|落葉片|lawn|turf|grassland|bare ground|ground cover|background|surrounding|vegetation|plant community|built structure');

CREATE TEMP TABLE tmp_non_biological_candidate_matches ON COMMIT DROP AS
SELECT
    c.candidate_id,
    c.visit_id,
    c.suggested_occurrence_id,
    c.candidate_status,
    c.vernacular_name,
    c.scientific_name,
    c.taxon_rank,
    c.source_payload
FROM observation_ai_subject_candidates c
WHERE c.candidate_status <> 'dismissed'
  AND COALESCE(BTRIM(c.scientific_name), '') !~ '^[A-Z][a-z-]+([ ][a-z][a-z.-]+){0,3}$'
  AND EXISTS (
      SELECT 1
      FROM tmp_non_biological_label_patterns p
      WHERE COALESCE(c.vernacular_name, '') ~* p.pattern
         OR COALESCE(c.scientific_name, '') ~* p.pattern
  );

CREATE TEMP TABLE tmp_non_biological_occurrence_matches ON COMMIT DROP AS
SELECT
    o.occurrence_id,
    o.visit_id,
    o.occurrence_status,
    o.vernacular_name,
    o.scientific_name,
    o.taxon_rank,
    o.source_payload
FROM occurrences o
WHERE COALESCE(o.occurrence_status, 'present') <> 'absent'
  AND COALESCE(BTRIM(o.scientific_name), '') !~ '^[A-Z][a-z-]+([ ][a-z][a-z.-]+){0,3}$'
  AND EXISTS (
      SELECT 1
      FROM tmp_non_biological_label_patterns p
      WHERE COALESCE(o.vernacular_name, '') ~* p.pattern
         OR COALESCE(o.scientific_name, '') ~* p.pattern
  )
  AND NOT EXISTS (
      SELECT 1
      FROM identifications i
      WHERE i.occurrence_id = o.occurrence_id
  )
  AND (
      o.source_payload ->> 'source' IN (
          'ai_candidate_adoption',
          'community_subject_proposal',
          'ai_judgement_observation_record'
      )
      OR o.source_payload ? 'ai_judgement'
      OR NULLIF(o.source_payload ->> 'ai_judgement_candidate_key', '') IS NOT NULL
  );

INSERT INTO non_biological_subject_repairs (
    migration,
    source_kind,
    source_id,
    visit_id,
    occurrence_id,
    candidate_id,
    before_payload
)
SELECT
    '0114_repair_non_biological_subject_labels',
    'observation_ai_subject_candidates',
    c.candidate_id::text,
    c.visit_id,
    c.suggested_occurrence_id,
    c.candidate_id,
    jsonb_build_object(
        'candidate_status', c.candidate_status,
        'vernacular_name', c.vernacular_name,
        'scientific_name', c.scientific_name,
        'taxon_rank', c.taxon_rank,
        'source_payload', c.source_payload
    )
FROM tmp_non_biological_candidate_matches c
ON CONFLICT DO NOTHING;

INSERT INTO non_biological_subject_repairs (
    migration,
    source_kind,
    source_id,
    visit_id,
    occurrence_id,
    candidate_id,
    before_payload
)
SELECT
    '0114_repair_non_biological_subject_labels',
    'occurrences',
    o.occurrence_id,
    o.visit_id,
    o.occurrence_id,
    NULL,
    jsonb_build_object(
        'occurrence_status', o.occurrence_status,
        'vernacular_name', o.vernacular_name,
        'scientific_name', o.scientific_name,
        'taxon_rank', o.taxon_rank,
        'source_payload', o.source_payload
    )
FROM tmp_non_biological_occurrence_matches o
ON CONFLICT DO NOTHING;

INSERT INTO non_biological_subject_repairs (
    migration,
    source_kind,
    source_id,
    visit_id,
    occurrence_id,
    candidate_id,
    before_payload
)
SELECT
    '0114_repair_non_biological_subject_labels',
    'visit_display_state',
    v.visit_id,
    v.visit_id,
    v.featured_occurrence_id,
    NULL,
    jsonb_build_object(
        'featured_occurrence_id', v.featured_occurrence_id,
        'selected_reason', v.selected_reason,
        'selection_source', v.selection_source,
        'locked_by_human', v.locked_by_human,
        'derived_from_ai_run_id', v.derived_from_ai_run_id
    )
FROM visit_display_state v
JOIN tmp_non_biological_occurrence_matches o
  ON o.occurrence_id = v.featured_occurrence_id
WHERE v.locked_by_human = FALSE
ON CONFLICT DO NOTHING;

UPDATE observation_ai_subject_candidates c
SET candidate_status = 'dismissed',
    source_payload = COALESCE(c.source_payload, '{}'::jsonb)
        || jsonb_build_object(
            'non_biological_subject_repair',
            jsonb_build_object(
                'migration', '0114_repair_non_biological_subject_labels',
                'reason', 'scene_or_built_structure_label',
                'repaired_at', NOW()
            )
        ),
    updated_at = NOW()
FROM (
    SELECT candidate_id FROM tmp_non_biological_candidate_matches
    UNION
    SELECT c2.candidate_id
    FROM observation_ai_subject_candidates c2
    JOIN tmp_non_biological_occurrence_matches o
      ON o.occurrence_id = c2.suggested_occurrence_id
) matched
WHERE c.candidate_id = matched.candidate_id
  AND c.candidate_status <> 'dismissed';

UPDATE occurrences o
SET occurrence_status = 'absent',
    source_payload = COALESCE(o.source_payload, '{}'::jsonb)
        || jsonb_build_object(
            'non_biological_subject_repair',
            jsonb_build_object(
                'migration', '0114_repair_non_biological_subject_labels',
                'reason', 'scene_or_built_structure_label',
                'previous_status', o.occurrence_status,
                'repaired_at', NOW()
            )
        ),
    updated_at = NOW()
FROM tmp_non_biological_occurrence_matches matched
WHERE o.occurrence_id = matched.occurrence_id
  AND COALESCE(o.occurrence_status, 'present') <> 'absent';

UPDATE visit_display_state v
SET featured_occurrence_id = NULL,
    selected_reason = '非生物の場面説明を主表示から外したため、表示対象を再選定します。',
    selection_source = 'system_stable',
    locked_by_human = FALSE,
    updated_at = NOW()
FROM tmp_non_biological_occurrence_matches o
WHERE v.featured_occurrence_id = o.occurrence_id
  AND v.locked_by_human = FALSE;

