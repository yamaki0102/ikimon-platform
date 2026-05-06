CREATE TABLE IF NOT EXISTS user_area_subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    href TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_area_subscriptions_target_type_check
        CHECK (target_type IN ('field', 'place', 'region'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_area_subscriptions_target
    ON user_area_subscriptions (user_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_user_area_subscriptions_user_active
    ON user_area_subscriptions (user_id, is_active, updated_at DESC);
