-- Navigable Biodiversity OS: Corpus2Skill-style knowledge navigation.
--
-- A compiled navigation version is materialized from reviewed knowledge_claims,
-- reviewed regional_knowledge_cards, and paper ingest candidates. Serving code
-- can choose branches/nodes first, then attach cited source documents or ready
-- knowledge_claims as evidence. Node summaries are navigation hints only.

CREATE TABLE IF NOT EXISTS knowledge_navigation_versions (
    version_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_snapshot_hash TEXT        NOT NULL UNIQUE,
    built_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status               TEXT        NOT NULL DEFAULT 'building',
    node_count           INTEGER     NOT NULL DEFAULT 0,
    document_count       INTEGER     NOT NULL DEFAULT 0,
    metadata             JSONB       NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT knowledge_navigation_versions_status_chk
        CHECK (status IN ('building', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_navigation_versions_latest
    ON knowledge_navigation_versions (built_at DESC, status);

CREATE TABLE IF NOT EXISTS knowledge_navigation_nodes (
    node_id        TEXT        PRIMARY KEY,
    version_id     UUID        NOT NULL REFERENCES knowledge_navigation_versions(version_id) ON DELETE CASCADE,
    parent_id      TEXT        REFERENCES knowledge_navigation_nodes(node_id) ON DELETE CASCADE,
    depth          INTEGER     NOT NULL,
    label          TEXT        NOT NULL,
    summary        TEXT        NOT NULL,
    question_types TEXT[]      NOT NULL DEFAULT '{}',
    key_terms      TEXT[]      NOT NULL DEFAULT '{}',
    child_count    INTEGER     NOT NULL DEFAULT 0,
    metadata       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT knowledge_navigation_nodes_depth_chk
        CHECK (depth BETWEEN 0 AND 3),
    CONSTRAINT knowledge_navigation_nodes_label_chk
        CHECK (char_length(label) BETWEEN 1 AND 120),
    CONSTRAINT knowledge_navigation_nodes_summary_chk
        CHECK (char_length(summary) BETWEEN 1 AND 2048)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_navigation_nodes_version_depth
    ON knowledge_navigation_nodes (version_id, depth);

CREATE INDEX IF NOT EXISTS idx_knowledge_navigation_nodes_parent
    ON knowledge_navigation_nodes (parent_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_navigation_nodes_terms
    ON knowledge_navigation_nodes USING GIN (key_terms);

CREATE TABLE IF NOT EXISTS knowledge_navigation_documents (
    doc_id         TEXT        PRIMARY KEY,
    version_id     UUID        NOT NULL REFERENCES knowledge_navigation_versions(version_id) ON DELETE CASCADE,
    node_id        TEXT        NOT NULL REFERENCES knowledge_navigation_nodes(node_id) ON DELETE CASCADE,
    source_kind    TEXT        NOT NULL,
    source_ref_id  TEXT        NOT NULL,
    title          TEXT        NOT NULL,
    citation       TEXT        NOT NULL DEFAULT '',
    access_policy  TEXT        NOT NULL DEFAULT 'metadata_only',
    content_digest TEXT        NOT NULL,
    claim_refs     TEXT[]      NOT NULL DEFAULT '{}',
    key_terms      TEXT[]      NOT NULL DEFAULT '{}',
    metadata       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT knowledge_navigation_documents_source_kind_chk
        CHECK (source_kind IN ('knowledge_claim', 'regional_knowledge_card', 'research_paper')),
    CONSTRAINT knowledge_navigation_documents_access_policy_chk
        CHECK (access_policy IN ('metadata_only', 'open_abstract', 'oa_license_verified', 'licensed_excerpt', 'public')),
    CONSTRAINT knowledge_navigation_documents_unique_source
        UNIQUE (version_id, source_kind, source_ref_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_navigation_documents_version_node
    ON knowledge_navigation_documents (version_id, node_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_navigation_documents_source
    ON knowledge_navigation_documents (source_kind, source_ref_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_navigation_documents_digest
    ON knowledge_navigation_documents (content_digest);

CREATE INDEX IF NOT EXISTS idx_knowledge_navigation_documents_claim_refs
    ON knowledge_navigation_documents USING GIN (claim_refs);

CREATE INDEX IF NOT EXISTS idx_knowledge_navigation_documents_terms
    ON knowledge_navigation_documents USING GIN (key_terms);
