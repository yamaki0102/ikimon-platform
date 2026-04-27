-- Biodiversity Freshness OS: research_paper_ingest_queue
--
-- paper-research-curator queues candidate papers (OpenAlex / CrossRef / J-STAGE)
-- discovered for the top observed taxa. Items advance through:
--   queued -> claim_extracted -> review_pending -> approved / rejected
-- Final approved claims are inserted into knowledge_sources + knowledge_claims
-- via the standard PR-based human review gate.

CREATE TABLE IF NOT EXISTS research_paper_ingest_queue (
    queue_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    source_kind           TEXT         NOT NULL,
    external_id           TEXT         NOT NULL,
    doi                   TEXT,
    title                 TEXT         NOT NULL DEFAULT '',
    publication_year      INTEGER,
    publisher             TEXT         NOT NULL DEFAULT '',
    license_label         TEXT         NOT NULL DEFAULT '',
    access_policy         TEXT         NOT NULL DEFAULT 'metadata_only',
    discovered_taxa       TEXT[]       NOT NULL DEFAULT '{}',
    relevance_score       NUMERIC(4,3) NOT NULL DEFAULT 0.000,
    status                TEXT         NOT NULL DEFAULT 'queued',
    discovered_run_id     UUID         REFERENCES ai_curator_runs(run_id) ON DELETE SET NULL,
    extracted_run_id      UUID         REFERENCES ai_curator_runs(run_id) ON DELETE SET NULL,
    extracted_claim_count INTEGER      NOT NULL DEFAULT 0,
    rejected_reason       TEXT         NOT NULL DEFAULT '',
    metadata              JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT research_paper_ingest_queue_kind_chk
        CHECK (source_kind IN ('openalex', 'crossref', 'jstage', 'manual')),
    CONSTRAINT research_paper_ingest_queue_status_chk
        CHECK (status IN ('queued', 'claim_extracted', 'review_pending', 'approved', 'rejected')),
    CONSTRAINT research_paper_ingest_queue_access_chk
        CHECK (access_policy IN ('metadata_only', 'open_abstract', 'oa_license_verified', 'licensed_excerpt')),
    CONSTRAINT research_paper_ingest_queue_relevance_chk
        CHECK (relevance_score >= 0 AND relevance_score <= 1),
    CONSTRAINT research_paper_ingest_queue_year_chk
        CHECK (publication_year IS NULL OR publication_year BETWEEN 1700 AND 2200)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_research_paper_ingest_kind_external
    ON research_paper_ingest_queue (source_kind, external_id);

CREATE INDEX IF NOT EXISTS idx_research_paper_ingest_pending
    ON research_paper_ingest_queue (relevance_score DESC, created_at DESC)
    WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_research_paper_ingest_review
    ON research_paper_ingest_queue (created_at DESC)
    WHERE status = 'review_pending';

CREATE INDEX IF NOT EXISTS idx_research_paper_ingest_doi
    ON research_paper_ingest_queue (lower(doi))
    WHERE doi IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_research_paper_ingest_taxa
    ON research_paper_ingest_queue USING GIN (discovered_taxa);
