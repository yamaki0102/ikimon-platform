-- Reference library / evidence-backed identification foundation.
--
-- Copyright posture:
--   * knowledge_sources remains the shared metadata catalog.
--   * user proof images are private evidence_assets with asset_blobs.public_url = NULL.
--   * page/caption corrections are stored as metadata verified from official sources;
--     no page body or OCR full text is required or used for RAG.

CREATE TABLE IF NOT EXISTS knowledge_source_reference_metadata (
    source_id          UUID        PRIMARY KEY REFERENCES knowledge_sources(source_id) ON DELETE CASCADE,
    isbn               TEXT,
    ean                TEXT,
    author_text        TEXT        NOT NULL DEFAULT '',
    edition            TEXT        NOT NULL DEFAULT '',
    source_language    TEXT        NOT NULL DEFAULT '',
    catalog_status     TEXT        NOT NULL DEFAULT 'active',
    ai_extract_payload JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT knowledge_source_reference_metadata_catalog_status_chk
        CHECK (catalog_status IN ('active', 'needs_review', 'duplicate', 'withdrawn'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_source_reference_metadata_isbn
    ON knowledge_source_reference_metadata (regexp_replace(isbn, '[^0-9Xx]', '', 'g'))
    WHERE isbn IS NOT NULL AND regexp_replace(isbn, '[^0-9Xx]', '', 'g') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_source_reference_metadata_ean
    ON knowledge_source_reference_metadata (regexp_replace(ean, '[^0-9]', '', 'g'))
    WHERE ean IS NOT NULL AND regexp_replace(ean, '[^0-9]', '', 'g') <> '';

CREATE INDEX IF NOT EXISTS idx_knowledge_source_reference_metadata_catalog_lookup
    ON knowledge_source_reference_metadata (catalog_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_source_taxon_links (
    link_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id          UUID        NOT NULL REFERENCES knowledge_sources(source_id) ON DELETE CASCADE,
    taxon_name         TEXT        NOT NULL,
    taxon_rank         TEXT        NOT NULL DEFAULT '',
    link_type          TEXT        NOT NULL DEFAULT 'ai_inferred',
    confidence         NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    created_by_user_id TEXT        REFERENCES users(user_id) ON DELETE SET NULL,
    source_payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT knowledge_source_taxon_links_type_chk
        CHECK (link_type IN ('ai_inferred', 'user_confirmed', 'reviewer_confirmed')),
    CONSTRAINT knowledge_source_taxon_links_confidence_chk
        CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT knowledge_source_taxon_links_taxon_name_chk
        CHECK (btrim(taxon_name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_source_taxon_links_unique
    ON knowledge_source_taxon_links (
        source_id,
        lower(btrim(taxon_name)),
        lower(btrim(taxon_rank)),
        link_type
    );

CREATE INDEX IF NOT EXISTS idx_knowledge_source_taxon_links_lookup
    ON knowledge_source_taxon_links (lower(btrim(taxon_name)), link_type, confidence DESC);

CREATE TABLE IF NOT EXISTS reference_capture_batches (
    batch_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status         TEXT        NOT NULL DEFAULT 'queued',
    item_count     INTEGER     NOT NULL DEFAULT 0,
    ai_summary     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reference_capture_batches_status_chk
        CHECK (status IN ('queued', 'processing', 'completed', 'needs_review', 'failed')),
    CONSTRAINT reference_capture_batches_item_count_chk
        CHECK (item_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_reference_capture_batches_user_created
    ON reference_capture_batches (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reference_capture_items (
    item_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id            UUID        NOT NULL REFERENCES reference_capture_batches(batch_id) ON DELETE CASCADE,
    user_id             TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    source_id           UUID        REFERENCES knowledge_sources(source_id) ON DELETE SET NULL,
    proof_asset_id      UUID        REFERENCES evidence_assets(asset_id) ON DELETE SET NULL,
    item_status         TEXT        NOT NULL DEFAULT 'queued',
    extracted_payload   JSONB       NOT NULL DEFAULT '{}'::jsonb,
    classification_note TEXT        NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reference_capture_items_status_chk
        CHECK (item_status IN ('queued', 'ai_verified', 'needs_review', 'duplicate', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_reference_capture_items_batch
    ON reference_capture_items (batch_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_reference_capture_items_user_status
    ON reference_capture_items (user_id, item_status, created_at DESC);

CREATE TABLE IF NOT EXISTS user_reference_access_proofs (
    proof_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    source_id           UUID        NOT NULL REFERENCES knowledge_sources(source_id) ON DELETE CASCADE,
    proof_asset_id      UUID        REFERENCES evidence_assets(asset_id) ON DELETE SET NULL,
    batch_id            UUID        REFERENCES reference_capture_batches(batch_id) ON DELETE SET NULL,
    proof_kind          TEXT        NOT NULL DEFAULT 'cover',
    verification_status TEXT        NOT NULL DEFAULT 'pending',
    ai_check_payload    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    private_use_only    BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_reference_access_proofs_kind_chk
        CHECK (proof_kind IN ('cover', 'isbn', 'page', 'web_capture')),
    CONSTRAINT user_reference_access_proofs_status_chk
        CHECK (verification_status IN ('pending', 'ai_verified', 'user_confirmed', 'reviewer_confirmed', 'needs_review', 'rejected')),
    CONSTRAINT user_reference_access_proofs_private_chk
        CHECK (private_use_only IS TRUE)
);

CREATE INDEX IF NOT EXISTS idx_user_reference_access_proofs_user_status
    ON user_reference_access_proofs (user_id, verification_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_reference_access_proofs_source
    ON user_reference_access_proofs (source_id, verification_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_reference_access_proofs_user_source_kind_asset
    ON user_reference_access_proofs (
        user_id,
        source_id,
        proof_kind,
        coalesce(proof_asset_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

CREATE TABLE IF NOT EXISTS identification_references (
    identification_reference_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    identification_id           UUID        NOT NULL REFERENCES identifications(identification_id) ON DELETE CASCADE,
    source_id                   UUID        NOT NULL REFERENCES knowledge_sources(source_id) ON DELETE RESTRICT,
    locator                     TEXT        NOT NULL DEFAULT '',
    reference_role              TEXT        NOT NULL DEFAULT 'primary_basis',
    selected_by_user_id         TEXT        REFERENCES users(user_id) ON DELETE SET NULL,
    source_payload              JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT identification_references_role_chk
        CHECK (reference_role IN ('primary_basis', 'comparison', 'correction', 'exclusion', 'reading_suggestion')),
    CONSTRAINT identification_references_locator_len_chk
        CHECK (char_length(locator) <= 160)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_identification_references_unique
    ON identification_references (identification_id, source_id, reference_role, locator);

CREATE INDEX IF NOT EXISTS idx_identification_references_source
    ON identification_references (source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_identification_references_user
    ON identification_references (selected_by_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS commerce_providers (
    provider_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    provider            TEXT        NOT NULL,
    country_code        TEXT        NOT NULL,
    marketplace_domain  TEXT        NOT NULL DEFAULT '',
    api_mode            TEXT        NOT NULL DEFAULT 'manual',
    enabled             BOOLEAN     NOT NULL DEFAULT FALSE,
    disclosure_label    TEXT        NOT NULL DEFAULT '広告/成果報酬リンクを含みます',
    config_payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT commerce_providers_provider_chk
        CHECK (provider IN ('amazon', 'rakuten', 'bookshop', 'publisher_direct', 'other')),
    CONSTRAINT commerce_providers_api_mode_chk
        CHECK (api_mode IN ('official_api', 'partner_feed', 'manual')),
    CONSTRAINT commerce_providers_country_chk
        CHECK (country_code ~ '^[A-Z]{2}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commerce_providers_unique
    ON commerce_providers (provider, country_code, marketplace_domain);

CREATE INDEX IF NOT EXISTS idx_commerce_providers_enabled_country
    ON commerce_providers (country_code, enabled, provider);

CREATE TABLE IF NOT EXISTS source_commerce_links (
    link_id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id                      UUID        NOT NULL REFERENCES knowledge_sources(source_id) ON DELETE CASCADE,
    provider_id                    UUID        NOT NULL REFERENCES commerce_providers(provider_id) ON DELETE CASCADE,
    country_code                   TEXT        NOT NULL,
    product_url                    TEXT        NOT NULL,
    affiliate_url                  TEXT,
    affiliate_disclosure_required  BOOLEAN     NOT NULL DEFAULT FALSE,
    match_basis                    TEXT        NOT NULL DEFAULT 'manual',
    match_confidence               NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    availability_status            TEXT        NOT NULL DEFAULT 'candidate',
    review_status                  TEXT        NOT NULL DEFAULT 'pending',
    last_checked_at                TIMESTAMPTZ,
    source_payload                 JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT source_commerce_links_country_chk
        CHECK (country_code ~ '^[A-Z]{2}$'),
    CONSTRAINT source_commerce_links_match_basis_chk
        CHECK (match_basis IN ('isbn', 'title_author', 'manual')),
    CONSTRAINT source_commerce_links_match_confidence_chk
        CHECK (match_confidence >= 0 AND match_confidence <= 1),
    CONSTRAINT source_commerce_links_availability_chk
        CHECK (availability_status IN ('candidate', 'available', 'unavailable', 'unknown')),
    CONSTRAINT source_commerce_links_review_status_chk
        CHECK (review_status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT source_commerce_links_affiliate_disclosure_chk
        CHECK (affiliate_url IS NULL OR affiliate_url = '' OR affiliate_disclosure_required IS TRUE)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_source_commerce_links_unique
    ON source_commerce_links (source_id, provider_id, country_code, product_url);

CREATE INDEX IF NOT EXISTS idx_source_commerce_links_public_lookup
    ON source_commerce_links (source_id, country_code, review_status, availability_status);

CREATE TABLE IF NOT EXISTS commerce_link_discovery_jobs (
    job_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id      UUID        NOT NULL REFERENCES knowledge_sources(source_id) ON DELETE CASCADE,
    provider_id    UUID        NOT NULL REFERENCES commerce_providers(provider_id) ON DELETE CASCADE,
    status         TEXT        NOT NULL DEFAULT 'queued',
    query_payload  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    result_payload JSONB       NOT NULL DEFAULT '{}'::jsonb,
    error          TEXT        NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT commerce_link_discovery_jobs_status_chk
        CHECK (status IN ('queued', 'running', 'completed', 'needs_review', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_commerce_link_discovery_jobs_status
    ON commerce_link_discovery_jobs (status, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commerce_link_discovery_jobs_unique_open
    ON commerce_link_discovery_jobs (source_id, provider_id)
    WHERE status IN ('queued', 'running', 'needs_review');

CREATE TABLE IF NOT EXISTS knowledge_source_corrections (
    correction_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id                UUID        NOT NULL REFERENCES knowledge_sources(source_id) ON DELETE CASCADE,
    locator                  TEXT        NOT NULL DEFAULT '',
    original_name            TEXT        NOT NULL DEFAULT '',
    corrected_name           TEXT        NOT NULL DEFAULT '',
    original_taxon_name      TEXT        NOT NULL DEFAULT '',
    corrected_taxon_name     TEXT        NOT NULL DEFAULT '',
    correction_kind          TEXT        NOT NULL DEFAULT 'misidentification',
    official_source_url      TEXT        NOT NULL DEFAULT '',
    official_reference       TEXT        NOT NULL DEFAULT '',
    verification_status      TEXT        NOT NULL DEFAULT 'pending',
    verified_by_user_id      TEXT        REFERENCES users(user_id) ON DELETE SET NULL,
    verified_at              TIMESTAMPTZ,
    applies_from             DATE,
    source_payload           JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT knowledge_source_corrections_kind_chk
        CHECK (correction_kind IN ('misidentification', 'taxonomy_update', 'caption_error', 'distribution_update', 'other')),
    CONSTRAINT knowledge_source_corrections_status_chk
        CHECK (verification_status IN ('pending', 'official_confirmed', 'rejected')),
    CONSTRAINT knowledge_source_corrections_official_confirmed_chk
        CHECK (
            verification_status <> 'official_confirmed'
            OR btrim(official_source_url) <> ''
            OR btrim(official_reference) <> ''
        ),
    CONSTRAINT knowledge_source_corrections_locator_len_chk
        CHECK (char_length(locator) <= 160),
    CONSTRAINT knowledge_source_corrections_names_chk
        CHECK (btrim(original_name) <> '' OR btrim(corrected_name) <> '' OR btrim(original_taxon_name) <> '' OR btrim(corrected_taxon_name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_knowledge_source_corrections_source
    ON knowledge_source_corrections (source_id, verification_status, locator);

CREATE INDEX IF NOT EXISTS idx_knowledge_source_corrections_taxon
    ON knowledge_source_corrections (lower(btrim(original_taxon_name)), lower(btrim(corrected_taxon_name)), verification_status);

INSERT INTO commerce_providers (provider, country_code, marketplace_domain, api_mode, enabled, disclosure_label, config_payload)
VALUES
    ('amazon', 'JP', 'amazon.co.jp', 'official_api', false, '広告/成果報酬リンクを含みます', '{"requires_product_advertising_api":true}'::jsonb),
    ('amazon', 'US', 'amazon.com', 'official_api', false, 'Contains affiliate links', '{"requires_product_advertising_api":true}'::jsonb),
    ('rakuten', 'JP', 'rakuten.co.jp', 'partner_feed', false, '広告/成果報酬リンクを含みます', '{"requires_partner_feed":true}'::jsonb),
    ('bookshop', 'US', 'bookshop.org', 'partner_feed', false, 'Contains affiliate links', '{"requires_partner_feed":true}'::jsonb),
    ('publisher_direct', 'JP', '', 'manual', true, '広告/成果報酬リンクを含みます', '{"manual_review_required":true}'::jsonb)
ON CONFLICT (provider, country_code, marketplace_domain) DO UPDATE SET
    api_mode = excluded.api_mode,
    disclosure_label = excluded.disclosure_label,
    config_payload = commerce_providers.config_payload || excluded.config_payload,
    updated_at = now();
