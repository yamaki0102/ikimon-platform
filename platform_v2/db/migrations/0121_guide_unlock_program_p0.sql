-- P0 guide unlocks and guide relay programs.
-- Unlocks are private to the user. Exact capture coordinates remain on the
-- source visit; this table stores only the guide id and source visit link.

CREATE TABLE IF NOT EXISTS guide_programs (
    program_id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    owner_type TEXT NOT NULL DEFAULT 'community'
        CHECK (owner_type IN ('owner', 'community', 'municipality', 'school')),
    participation_mode TEXT NOT NULL DEFAULT 'any_order'
        CHECK (participation_mode IN ('any_order', 'ordered')),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'paused', 'closed')),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    public_summary TEXT,
    safety_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guide_program_spots (
    program_id TEXT NOT NULL REFERENCES guide_programs(program_id) ON DELETE CASCADE,
    guide_spot_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    required_for_completion BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (program_id, guide_spot_id)
);

CREATE TABLE IF NOT EXISTS guide_unlocks (
    unlock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    guide_spot_id TEXT NOT NULL,
    program_id TEXT REFERENCES guide_programs(program_id) ON DELETE SET NULL,
    source_visit_id TEXT REFERENCES visits(visit_id) ON DELETE SET NULL,
    source_occurrence_id TEXT REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    unlock_method TEXT NOT NULL DEFAULT 'nearby_record'
        CHECK (unlock_method IN ('nearby_record', 'onsite_check', 'organizer_grant')),
    visibility_status TEXT NOT NULL DEFAULT 'private'
        CHECK (visibility_status IN ('private')),
    location_basis TEXT NOT NULL DEFAULT 'visit_location',
    capture_accuracy_m NUMERIC(10,2),
    distance_band TEXT NOT NULL DEFAULT 'nearby'
        CHECK (distance_band IN ('same_place', 'nearby', 'area')),
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    first_unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_listened_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guide_unlocks_user_spot
    ON guide_unlocks (user_id, guide_spot_id);

CREATE INDEX IF NOT EXISTS idx_guide_unlocks_user_recent
    ON guide_unlocks (user_id, last_unlocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_program_spots_spot
    ON guide_program_spots (guide_spot_id);

INSERT INTO guide_programs (
    program_id, slug, title, owner_type, participation_mode, status, public_summary, safety_policy
) VALUES
    (
        'aikan-renri-guide-relay',
        'aikan-renri-guide-relay',
        '連理の木 自然共生ガイドリレー',
        'owner',
        'any_order',
        'published',
        '愛管株式会社の自然共生サイト周辺で、記録を残すと現地ガイドがあとから聞ける企画です。',
        '{"location_display":"coarse","unlock_visibility":"private","requires_public_post":false}'::jsonb
    ),
    (
        'hamamatsu-heritage-guide-relay',
        'hamamatsu-heritage-guide-relay',
        '浜松地域遺産ガイドリレー',
        'municipality',
        'any_order',
        'published',
        '地域遺産の近くで記録を残しながら、現地で聞ける短いガイドをつないでいく企画です。',
        '{"location_display":"coarse","unlock_visibility":"private","requires_public_post":false}'::jsonb
    )
ON CONFLICT (program_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    title = EXCLUDED.title,
    owner_type = EXCLUDED.owner_type,
    participation_mode = EXCLUDED.participation_mode,
    status = EXCLUDED.status,
    public_summary = EXCLUDED.public_summary,
    safety_policy = EXCLUDED.safety_policy,
    updated_at = NOW();

INSERT INTO guide_program_spots (program_id, guide_spot_id, sort_order)
VALUES
    ('aikan-renri-guide-relay', 'aikan-renri-lenri-tree', 10),
    ('hamamatsu-heritage-guide-relay', 'hamamatsu-shijimizuka-site', 10),
    ('hamamatsu-heritage-guide-relay', 'hamamatsu-nakamurake-house', 20),
    ('hamamatsu-heritage-guide-relay', 'hamamatsu-maisaka-wakihonjin', 30),
    ('hamamatsu-heritage-guide-relay', 'hamamatsu-castle-ruins', 40),
    ('hamamatsu-heritage-guide-relay', 'hamamatsu-ryotanji-garden', 50),
    ('hamamatsu-heritage-guide-relay', 'hamamatsu-makaya-temple-garden', 60),
    ('hamamatsu-heritage-guide-relay', 'hamamatsu-hourinji-temple', 70),
    ('hamamatsu-heritage-guide-relay', 'hamamatsu-heritage-system', 80)
ON CONFLICT (program_id, guide_spot_id) DO UPDATE SET
    sort_order = EXCLUDED.sort_order;
