-- Reference identification capability model.
--
-- Turns a registered guide/reference into operational commands:
-- "this source can be used to check/support this taxon scope".
-- The model is metadata-only. It must not store copyrighted page body text.

CREATE TABLE IF NOT EXISTS reference_identification_scopes (
    scope_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id            UUID        NOT NULL REFERENCES knowledge_sources(source_id) ON DELETE CASCADE,
    scope_taxon_name     TEXT        NOT NULL,
    scope_taxon_rank     TEXT        NOT NULL DEFAULT '',
    scope_taxon_key      TEXT        NOT NULL DEFAULT '',
    command_kind         TEXT        NOT NULL DEFAULT 'reference_check',
    max_supported_rank   TEXT        NOT NULL DEFAULT '',
    locator_policy       TEXT        NOT NULL DEFAULT 'recommended',
    coverage_basis       TEXT        NOT NULL DEFAULT 'source_metadata',
    verification_status  TEXT        NOT NULL DEFAULT 'active',
    confidence           NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    notes                TEXT        NOT NULL DEFAULT '',
    created_by_user_id   TEXT        REFERENCES users(user_id) ON DELETE SET NULL,
    source_payload       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reference_identification_scopes_taxon_name_chk
        CHECK (btrim(scope_taxon_name) <> ''),
    CONSTRAINT reference_identification_scopes_command_kind_chk
        CHECK (command_kind IN ('reference_check', 'support_identification', 'exclude_candidate', 'reading_suggestion')),
    CONSTRAINT reference_identification_scopes_max_rank_chk
        CHECK (
            max_supported_rank IN (
                '', 'group', 'kingdom', 'phylum', 'class', 'order', 'family', 'subfamily',
                'tribe', 'genus', 'subgenus', 'species_group', 'species', 'subspecies'
            )
        ),
    CONSTRAINT reference_identification_scopes_locator_policy_chk
        CHECK (locator_policy IN ('optional', 'recommended', 'required')),
    CONSTRAINT reference_identification_scopes_coverage_basis_chk
        CHECK (coverage_basis IN (
            'source_metadata',
            'owner_statement',
            'ai_inferred',
            'curator_toc',
            'reviewer_curation',
            'ikimon_digital_guide'
        )),
    CONSTRAINT reference_identification_scopes_status_chk
        CHECK (verification_status IN ('active', 'needs_review', 'deprecated')),
    CONSTRAINT reference_identification_scopes_confidence_chk
        CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reference_identification_scopes_unique
    ON reference_identification_scopes (
        source_id,
        lower(btrim(scope_taxon_name)),
        lower(btrim(scope_taxon_rank)),
        lower(btrim(scope_taxon_key)),
        command_kind,
        max_supported_rank,
        coverage_basis
    );

CREATE INDEX IF NOT EXISTS idx_reference_identification_scopes_lookup
    ON reference_identification_scopes (
        lower(btrim(scope_taxon_name)),
        verification_status,
        command_kind,
        confidence DESC
    );

CREATE INDEX IF NOT EXISTS idx_reference_identification_scopes_source
    ON reference_identification_scopes (source_id, verification_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS reference_identification_scope_aliases (
    alias_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_id             UUID        NOT NULL REFERENCES reference_identification_scopes(scope_id) ON DELETE CASCADE,
    alias_name           TEXT        NOT NULL,
    alias_rank           TEXT        NOT NULL DEFAULT '',
    alias_kind           TEXT        NOT NULL DEFAULT 'vernacular',
    verification_status  TEXT        NOT NULL DEFAULT 'active',
    confidence           NUMERIC(4,3) NOT NULL DEFAULT 0.800,
    source_payload       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reference_identification_scope_aliases_name_chk
        CHECK (btrim(alias_name) <> ''),
    CONSTRAINT reference_identification_scope_aliases_kind_chk
        CHECK (alias_kind IN ('vernacular', 'synonym', 'misspelling', 'legacy_scientific', 'local_name', 'alt_orthography')),
    CONSTRAINT reference_identification_scope_aliases_status_chk
        CHECK (verification_status IN ('active', 'needs_review', 'deprecated')),
    CONSTRAINT reference_identification_scope_aliases_confidence_chk
        CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reference_identification_scope_aliases_unique
    ON reference_identification_scope_aliases (
        scope_id,
        lower(btrim(alias_name)),
        lower(btrim(alias_rank)),
        alias_kind
    );

CREATE INDEX IF NOT EXISTS idx_reference_identification_scope_aliases_lookup
    ON reference_identification_scope_aliases (lower(btrim(alias_name)), verification_status, confidence DESC);

INSERT INTO reference_identification_scopes (
    source_id,
    scope_taxon_name,
    scope_taxon_rank,
    scope_taxon_key,
    command_kind,
    max_supported_rank,
    locator_policy,
    coverage_basis,
    verification_status,
    confidence,
    created_by_user_id,
    source_payload,
    created_at,
    updated_at
)
SELECT
    kt.source_id,
    kt.taxon_name,
    kt.taxon_rank,
    '',
    CASE
        WHEN kt.link_type IN ('user_confirmed', 'reviewer_confirmed') THEN 'support_identification'
        ELSE 'reference_check'
    END,
    CASE
        WHEN kt.taxon_rank IN (
            'group', 'kingdom', 'phylum', 'class', 'order', 'family', 'subfamily',
            'tribe', 'genus', 'subgenus', 'species_group', 'species', 'subspecies'
        ) THEN kt.taxon_rank
        ELSE ''
    END,
    CASE
        WHEN kt.link_type = 'reviewer_confirmed' THEN 'recommended'
        WHEN kt.link_type = 'user_confirmed' THEN 'recommended'
        ELSE 'optional'
    END,
    CASE
        WHEN kt.link_type = 'reviewer_confirmed' THEN 'reviewer_curation'
        WHEN kt.link_type = 'user_confirmed' THEN 'owner_statement'
        ELSE 'ai_inferred'
    END,
    CASE
        WHEN kt.confidence < 0.550 THEN 'needs_review'
        ELSE 'active'
    END,
    kt.confidence,
    kt.created_by_user_id,
    coalesce(kt.source_payload, '{}'::jsonb) || jsonb_build_object(
        'source', 'knowledge_source_taxon_links_backfill',
        'legacy_link_type', kt.link_type,
        'copyright_policy', 'metadata_only_no_page_text'
    ),
    kt.created_at,
    now()
FROM knowledge_source_taxon_links kt
WHERE btrim(kt.taxon_name) <> ''
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW user_reference_identification_commands AS
SELECT DISTINCT ON (p.user_id, ris.scope_id)
       p.user_id,
       p.proof_id,
       p.verification_status AS proof_status,
       p.created_at AS proof_created_at,
       ris.scope_id,
       ris.source_id,
       ks.title AS source_title,
       ris.scope_taxon_name,
       ris.scope_taxon_rank,
       ris.scope_taxon_key,
       ris.command_kind,
       ris.max_supported_rank,
       ris.locator_policy,
       ris.coverage_basis,
       ris.verification_status AS scope_status,
       ris.confidence,
       CASE ris.command_kind
           WHEN 'support_identification' THEN 'この資料で確認'
           WHEN 'exclude_candidate' THEN 'この資料で比較'
           WHEN 'reading_suggestion' THEN 'この資料を見る'
           ELSE 'この資料で確認'
       END AS command_label
  FROM user_reference_access_proofs p
  JOIN reference_identification_scopes ris
    ON ris.source_id = p.source_id
  JOIN knowledge_sources ks
    ON ks.source_id = ris.source_id
  LEFT JOIN knowledge_source_reference_metadata krm
    ON krm.source_id = ris.source_id
 WHERE p.verification_status IN ('ai_verified', 'user_confirmed', 'reviewer_confirmed')
   AND ris.verification_status = 'active'
   AND coalesce(krm.catalog_status, 'active') NOT IN ('withdrawn', 'duplicate')
 ORDER BY p.user_id, ris.scope_id, p.created_at DESC;
