-- 0062: taxon_alert_subscriptions
--
-- 任意ユーザーが任意の taxon (種・属・科・目・綱・門) でアラート購読する。
-- マッチ条件は scientific_name の完全一致 / GBIF 上位分類のいずれか。
-- 配信は email / digest_daily / digest_weekly / none から選択。
-- フィルタとして「外来種だけ」「希少種だけ」と地域フィルタ (prefecture / municipality / bbox / radius) を持つ。

CREATE TABLE IF NOT EXISTS taxon_alert_subscriptions (
    subscription_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                TEXT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    -- マッチ条件 (いずれか必須)
    scientific_name        TEXT,
    taxon_rank             TEXT,
    -- どの分類列でマッチさせるか (occurrences の scientific_name / genus / family / order_name / class_name)
    match_field            TEXT         NOT NULL,
    -- フィルタ
    geo_filter_json        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    trigger_invasive_only  BOOLEAN      NOT NULL DEFAULT false,
    trigger_rare_only      BOOLEAN      NOT NULL DEFAULT false,
    -- 配信
    channel                TEXT         NOT NULL DEFAULT 'email',
    is_active              BOOLEAN      NOT NULL DEFAULT true,
    label                  TEXT         NOT NULL DEFAULT '',
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT taxon_alert_subscriptions_taxon_rank_chk
        CHECK (taxon_rank IS NULL OR taxon_rank IN ('species','genus','family','order','class','phylum')),
    CONSTRAINT taxon_alert_subscriptions_match_field_chk
        CHECK (match_field IN ('scientific_name','genus','family','order_name','class_name')),
    CONSTRAINT taxon_alert_subscriptions_channel_chk
        CHECK (channel IN ('email','digest_daily','digest_weekly','none')),
    CONSTRAINT taxon_alert_subscriptions_target_chk
        CHECK (scientific_name IS NOT NULL OR taxon_rank IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_taxon_alert_subscriptions_user
    ON taxon_alert_subscriptions (user_id)
    WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_taxon_alert_subscriptions_match_name
    ON taxon_alert_subscriptions (match_field, lower(scientific_name))
    WHERE is_active AND scientific_name IS NOT NULL;
