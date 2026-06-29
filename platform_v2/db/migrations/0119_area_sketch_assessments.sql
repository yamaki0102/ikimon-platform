CREATE TABLE IF NOT EXISTS area_sketch_assessments (
    assessment_id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id                       UUID        NOT NULL REFERENCES observation_fields(field_id) ON DELETE CASCADE,
    actor_user_id                  TEXT        NOT NULL,
    status                         TEXT        NOT NULL DEFAULT 'draft',
    visibility                     TEXT        NOT NULL DEFAULT 'private',
    policy_version                 TEXT        NOT NULL,
    estimate_version               TEXT        NOT NULL,
    sketch_polygon                 JSONB       NOT NULL,
    normalized_polygon             JSONB       NOT NULL,
    land_cover                     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    owner_assertion                JSONB       NOT NULL DEFAULT '{}'::jsonb,
    evidence_payload               JSONB       NOT NULL DEFAULT '{}'::jsonb,
    result_payload                 JSONB       NOT NULL DEFAULT '{}'::jsonb,
    claim_boundary                 JSONB       NOT NULL DEFAULT '{}'::jsonb,
    audit_payload                  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    area_ha                        NUMERIC(12,4),
    green_candidate_area_ha         NUMERIC(12,4),
    conditional_green_candidate_area_ha NUMERIC(12,4),
    unknown_area_ha                NUMERIC(12,4),
    green_ratio                    NUMERIC(8,5),
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT area_sketch_assessments_status_check
        CHECK (status IN ('draft', 'archived')),
    CONSTRAINT area_sketch_assessments_visibility_check
        CHECK (visibility IN ('private', 'field_managers', 'internal'))
);

CREATE INDEX IF NOT EXISTS idx_area_sketch_assessments_field_updated
    ON area_sketch_assessments (field_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_area_sketch_assessments_actor_updated
    ON area_sketch_assessments (actor_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_area_sketch_assessments_result_payload_gin
    ON area_sketch_assessments USING GIN (result_payload);
