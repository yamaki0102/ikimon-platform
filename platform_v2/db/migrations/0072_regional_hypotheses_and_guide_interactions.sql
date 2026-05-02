CREATE TABLE IF NOT EXISTS regional_hypotheses (
    hypothesis_id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_kind                  TEXT        NOT NULL DEFAULT 'mesh'
        CHECK (subject_kind IN ('mesh', 'place')),
    mesh_key                      TEXT        REFERENCES guide_environment_mesh_cells(mesh_key) ON DELETE CASCADE,
    place_id                      TEXT        REFERENCES places(place_id) ON DELETE SET NULL,
    claim_type                    TEXT        NOT NULL
        CHECK (claim_type IN (
            'habitat',
            'seasonality',
            'species_candidate',
            'sampling_gap',
            'management_effect',
            'effort_bias'
        )),
    hypothesis_text               TEXT        NOT NULL,
    what_we_can_say               TEXT        NOT NULL DEFAULT '',
    supporting_observation_ids    JSONB       NOT NULL DEFAULT '[]'::jsonb,
    supporting_guide_record_ids   JSONB       NOT NULL DEFAULT '[]'::jsonb,
    supporting_knowledge_card_ids JSONB       NOT NULL DEFAULT '[]'::jsonb,
    supporting_claim_ids          JSONB       NOT NULL DEFAULT '[]'::jsonb,
    evidence                      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    confidence                    NUMERIC(4,3) NOT NULL DEFAULT 0.500
        CHECK (confidence >= 0 AND confidence <= 1),
    bias_warnings                 JSONB       NOT NULL DEFAULT '[]'::jsonb,
    missing_data                  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    next_sampling_protocol        TEXT        NOT NULL DEFAULT '',
    review_status                 TEXT        NOT NULL DEFAULT 'auto'
        CHECK (review_status IN ('draft', 'auto', 'needs_review', 'reviewed', 'rejected')),
    generation_method             TEXT        NOT NULL DEFAULT 'deterministic_v1',
    source_fingerprint            TEXT        NOT NULL,
    generated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT regional_hypotheses_subject_chk
        CHECK (mesh_key IS NOT NULL OR place_id IS NOT NULL),
    CONSTRAINT regional_hypotheses_text_chk
        CHECK (char_length(hypothesis_text) BETWEEN 1 AND 900),
    CONSTRAINT regional_hypotheses_sampling_protocol_chk
        CHECK (char_length(next_sampling_protocol) <= 900),
    CONSTRAINT regional_hypotheses_fingerprint_uniq
        UNIQUE (source_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_regional_hypotheses_mesh
    ON regional_hypotheses (mesh_key, claim_type, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_regional_hypotheses_place
    ON regional_hypotheses (place_id, claim_type, confidence DESC)
    WHERE place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_regional_hypotheses_review
    ON regional_hypotheses (review_status, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_regional_hypotheses_missing_data
    ON regional_hypotheses USING GIN (missing_data);

CREATE TABLE IF NOT EXISTS guide_interactions (
    interaction_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_record_id   UUID        REFERENCES guide_records(guide_record_id) ON DELETE SET NULL,
    hypothesis_id     UUID        REFERENCES regional_hypotheses(hypothesis_id) ON DELETE SET NULL,
    user_id           TEXT,
    session_id        TEXT        NOT NULL DEFAULT '',
    interaction_type  TEXT        NOT NULL
        CHECK (interaction_type IN (
            'surfaced',
            'played',
            'skipped',
            'saved_later',
            'helpful',
            'wrong',
            'corrected'
        )),
    payload           JSONB       NOT NULL DEFAULT '{}'::jsonb,
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_interactions_record
    ON guide_interactions (guide_record_id, occurred_at DESC)
    WHERE guide_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guide_interactions_hypothesis
    ON guide_interactions (hypothesis_id, occurred_at DESC)
    WHERE hypothesis_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guide_interactions_user
    ON guide_interactions (user_id, occurred_at DESC)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guide_interactions_type
    ON guide_interactions (interaction_type, occurred_at DESC);
