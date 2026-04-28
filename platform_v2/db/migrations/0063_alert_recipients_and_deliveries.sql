-- 0063: alert_recipients + alert_deliveries
--
-- alert_recipients: 自治体・研究者・機関を受信者として登録。
--   - recipient_type: municipality / researcher / agency / user
--   - email or webhook_url で配信
--   - prefecture / municipality で地域マッチング、interest_taxon_json で分類群マッチング
--   - rate_limit_per_day で日次上限
-- alert_deliveries: 個々の配信履歴。pending → sent / failed / acknowledged の遷移
--   - 受信者は user_id か recipient_id のいずれか
--   - subscription_id へのリンクで「どの購読がトリガーしたか」を追跡
--   - acknowledged_at で「ユーザーがチェックした」履歴を保存

CREATE TABLE IF NOT EXISTS alert_recipients (
    recipient_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_type         TEXT         NOT NULL,
    display_name           TEXT         NOT NULL,
    email                  TEXT,
    webhook_url            TEXT,
    -- 自治体マッチ
    prefecture             TEXT,
    municipality           TEXT,
    -- 研究者・機関の関心
    interest_taxon_json    JSONB        NOT NULL DEFAULT '[]'::jsonb,
    interest_invasive      BOOLEAN      NOT NULL DEFAULT false,
    interest_rare          BOOLEAN      NOT NULL DEFAULT false,
    -- 配信制御
    is_active              BOOLEAN      NOT NULL DEFAULT true,
    rate_limit_per_day     INT          NOT NULL DEFAULT 50,
    source_url             TEXT,
    notes                  TEXT         NOT NULL DEFAULT '',
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT alert_recipients_type_chk
        CHECK (recipient_type IN ('municipality','researcher','agency','user'))
);

CREATE INDEX IF NOT EXISTS idx_alert_recipients_municipality
    ON alert_recipients (prefecture, municipality)
    WHERE is_active AND recipient_type = 'municipality';

CREATE INDEX IF NOT EXISTS idx_alert_recipients_type
    ON alert_recipients (recipient_type)
    WHERE is_active;

CREATE TABLE IF NOT EXISTS alert_deliveries (
    delivery_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id          UUID         NOT NULL REFERENCES occurrences(occurrence_id) ON DELETE CASCADE,
    user_id                TEXT         REFERENCES users(user_id) ON DELETE SET NULL,
    recipient_id           UUID         REFERENCES alert_recipients(recipient_id) ON DELETE SET NULL,
    subscription_id        UUID         REFERENCES taxon_alert_subscriptions(subscription_id) ON DELETE SET NULL,
    trigger_kind           TEXT         NOT NULL,
    channel                TEXT         NOT NULL,
    delivered_at           TIMESTAMPTZ,
    delivery_status        TEXT         NOT NULL DEFAULT 'pending',
    error_message          TEXT,
    payload_json           JSONB        NOT NULL DEFAULT '{}'::jsonb,
    acknowledged_at        TIMESTAMPTZ,
    acknowledged_note      TEXT,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT alert_deliveries_trigger_chk
        CHECK (trigger_kind IN ('invasive','rare','novelty','taxon_match','municipality_invasive')),
    CONSTRAINT alert_deliveries_status_chk
        CHECK (delivery_status IN ('pending','sent','failed','suppressed','acknowledged')),
    CONSTRAINT alert_deliveries_target_chk
        CHECK (user_id IS NOT NULL OR recipient_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_occurrence
    ON alert_deliveries (occurrence_id);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_user_recent
    ON alert_deliveries (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_pending
    ON alert_deliveries (delivery_status, created_at)
    WHERE delivery_status = 'pending';

-- 重複送信抑止: 同じ occurrence × 同じ受信者 × 同じ trigger_kind の組は 1 件まで。
-- recipient_id / user_id のいずれかが必ず NOT NULL なので、両方含める partial unique。
CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_deliveries_dedup_recipient
    ON alert_deliveries (occurrence_id, recipient_id, trigger_kind)
    WHERE recipient_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_deliveries_dedup_user
    ON alert_deliveries (occurrence_id, user_id, subscription_id, trigger_kind)
    WHERE user_id IS NOT NULL AND subscription_id IS NOT NULL;
