CREATE TABLE IF NOT EXISTS place_management_policies (
    place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    management_goal TEXT NOT NULL DEFAULT 'balanced',
    weed_tolerance TEXT NOT NULL DEFAULT 'medium',
    invasive_response TEXT NOT NULL DEFAULT 'ask_first',
    mowing_frequency TEXT NOT NULL DEFAULT 'as_needed',
    notes TEXT,
    policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (place_id, user_id),
    CHECK (management_goal IN ('balanced', 'keep_clear', 'native_patch', 'flowering_allowed', 'invasive_watch')),
    CHECK (weed_tolerance IN ('low', 'medium', 'high')),
    CHECK (invasive_response IN ('ask_first', 'controlled_removal', 'observe')),
    CHECK (mowing_frequency IN ('as_needed', 'monthly', 'seasonal', 'rare'))
);

CREATE INDEX IF NOT EXISTS idx_place_management_policies_user_updated
    ON place_management_policies (user_id, updated_at DESC);
