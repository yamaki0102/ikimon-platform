CREATE TABLE IF NOT EXISTS observation_quality_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_kind TEXT NOT NULL DEFAULT 'import_quarantine',
    review_status TEXT NOT NULL DEFAULT 'needs_review',
    legacy_source TEXT,
    legacy_entity_type TEXT,
    legacy_id TEXT,
    visit_id TEXT REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id TEXT REFERENCES occurrences(occurrence_id) ON DELETE CASCADE,
    reason_code TEXT NOT NULL,
    reason_detail TEXT NOT NULL DEFAULT '',
    public_visibility TEXT NOT NULL DEFAULT 'review',
    quality_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    import_version TEXT NOT NULL DEFAULT '',
    reviewed_by TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT observation_quality_reviews_status_chk
        CHECK (review_status IN ('needs_review', 'accepted', 'rejected', 'archived')),
    CONSTRAINT observation_quality_reviews_visibility_chk
        CHECK (public_visibility IN ('public', 'review', 'hidden')),
    CONSTRAINT observation_quality_reviews_identity_chk
        CHECK (legacy_id IS NOT NULL OR visit_id IS NOT NULL OR occurrence_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quality_reviews_legacy_identity
    ON observation_quality_reviews (legacy_source, legacy_entity_type, legacy_id, import_version)
    WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quality_reviews_visit_active
    ON observation_quality_reviews (visit_id, reason_code)
    WHERE visit_id IS NOT NULL AND review_status = 'needs_review';

CREATE INDEX IF NOT EXISTS idx_quality_reviews_status
    ON observation_quality_reviews (review_status, reason_code, created_at DESC);

ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS public_visibility TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS quality_review_status TEXT NOT NULL DEFAULT 'accepted',
    ADD COLUMN IF NOT EXISTS quality_gate_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'visits_public_visibility_chk'
    ) THEN
        ALTER TABLE visits
            ADD CONSTRAINT visits_public_visibility_chk
            CHECK (public_visibility IN ('public', 'review', 'hidden'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'visits_quality_review_status_chk'
    ) THEN
        ALTER TABLE visits
            ADD CONSTRAINT visits_quality_review_status_chk
            CHECK (quality_review_status IN ('accepted', 'needs_review', 'rejected', 'archived'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_visits_public_quality
    ON visits (public_visibility, quality_review_status, observed_at DESC);
