-- Observation Feedback Knowledge DB v0.
--
-- Purpose:
--   Store claim-level knowledge that can improve AI observation feedback,
--   mypage copy, and enterprise reports without redistributing copyrighted
--   papers or abstracts.
--
-- Copyright posture:
--   * keep source metadata and DOI/URL
--   * keep only a short supporting span for audit/review, never full text
--   * keep ikimon-authored/paraphrased claim_text, not copied paragraphs
--   * require human_review_status/use_in_feedback before prompt retrieval

CREATE TABLE IF NOT EXISTS knowledge_sources (
    source_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_kind           TEXT        NOT NULL DEFAULT 'literature',
    source_provider       TEXT        NOT NULL DEFAULT '',
    title                 TEXT        NOT NULL DEFAULT '',
    doi                   TEXT,
    url                   TEXT,
    publisher             TEXT        NOT NULL DEFAULT '',
    publication_year      INTEGER,
    license_label         TEXT        NOT NULL DEFAULT '',
    access_policy         TEXT        NOT NULL DEFAULT 'metadata_only',
    citation_text         TEXT        NOT NULL DEFAULT '',
    source_payload        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT knowledge_sources_access_policy_chk
        CHECK (access_policy IN ('metadata_only', 'open_abstract', 'oa_license_verified', 'licensed_excerpt')),
    CONSTRAINT knowledge_sources_citation_text_len_chk
        CHECK (char_length(citation_text) <= 600)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_sources_doi
    ON knowledge_sources (lower(doi))
    WHERE doi IS NOT NULL AND doi <> '';

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_url
    ON knowledge_sources (url)
    WHERE url IS NOT NULL AND url <> '';

CREATE TABLE IF NOT EXISTS knowledge_claims (
    claim_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id             UUID        REFERENCES knowledge_sources(source_id) ON DELETE SET NULL,
    claim_hash            TEXT        NOT NULL,
    claim_type            TEXT        NOT NULL,
    claim_text            TEXT        NOT NULL,
    taxon_name            TEXT        NOT NULL DEFAULT '',
    scientific_name       TEXT        NOT NULL DEFAULT '',
    taxon_rank            TEXT        NOT NULL DEFAULT '',
    taxon_group           TEXT        NOT NULL DEFAULT '',
    place_region          TEXT        NOT NULL DEFAULT '',
    season_bucket         TEXT        NOT NULL DEFAULT '',
    habitat               TEXT        NOT NULL DEFAULT '',
    evidence_type         TEXT        NOT NULL DEFAULT 'image',
    risk_lane             TEXT        NOT NULL DEFAULT 'normal',
    target_outputs        JSONB       NOT NULL DEFAULT '["observation_feedback"]'::jsonb,
    citation_span         TEXT        NOT NULL DEFAULT '',
    source_title          TEXT        NOT NULL DEFAULT '',
    source_doi            TEXT        NOT NULL DEFAULT '',
    source_url            TEXT        NOT NULL DEFAULT '',
    source_provider       TEXT        NOT NULL DEFAULT '',
    source_text_policy    TEXT        NOT NULL DEFAULT 'metadata_only',
    confidence            NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    human_review_status   TEXT        NOT NULL DEFAULT 'pending',
    needs_human_review    BOOLEAN     NOT NULL DEFAULT TRUE,
    use_in_feedback       BOOLEAN     NOT NULL DEFAULT FALSE,
    source_payload        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT knowledge_claims_hash_uniq UNIQUE (claim_hash),
    CONSTRAINT knowledge_claims_type_chk
        CHECK (claim_type IN (
            'identification_trait',
            'missing_evidence',
            'retake_guidance',
            'seasonality',
            'habitat',
            'distribution',
            'risk',
            'monitoring_interpretation',
            'site_condition_note'
        )),
    CONSTRAINT knowledge_claims_evidence_type_chk
        CHECK (evidence_type IN ('image', 'audio', 'note', 'video', 'mixed')),
    CONSTRAINT knowledge_claims_risk_lane_chk
        CHECK (risk_lane IN ('rare', 'invasive', 'normal', 'unknown')),
    CONSTRAINT knowledge_claims_source_text_policy_chk
        CHECK (source_text_policy IN ('metadata_only', 'open_abstract', 'oa_license_verified', 'licensed_excerpt')),
    CONSTRAINT knowledge_claims_review_status_chk
        CHECK (human_review_status IN ('pending', 'ready', 'rejected', 'needs_review')),
    CONSTRAINT knowledge_claims_claim_text_len_chk
        CHECK (char_length(claim_text) BETWEEN 1 AND 260),
    CONSTRAINT knowledge_claims_citation_span_len_chk
        CHECK (char_length(citation_span) <= 320),
    CONSTRAINT knowledge_claims_confidence_chk
        CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_claims_feedback_lookup
    ON knowledge_claims (human_review_status, use_in_feedback, taxon_group, taxon_rank, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_claims_taxon_name
    ON knowledge_claims (lower(taxon_name), lower(scientific_name));

CREATE INDEX IF NOT EXISTS idx_knowledge_claims_target_outputs
    ON knowledge_claims USING GIN (target_outputs);

CREATE INDEX IF NOT EXISTS idx_knowledge_claims_context
    ON knowledge_claims (evidence_type, risk_lane, season_bucket, place_region);
