-- 0064: user_notification_preferences
--
-- ユーザーごとの通知設定 (メール送受の有効化、ダイジェストの配信時刻、配信停止トークン)。
-- 1 ユーザー 1 行。デフォルト値は migration 適用時点で全ユーザーに自動付与しないが、
-- 通知エンドポイントが lazy 初期化する想定。

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id              TEXT         PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    email_enabled        BOOLEAN      NOT NULL DEFAULT true,
    digest_hour_local    INT          NOT NULL DEFAULT 8,
    unsubscribe_token    TEXT         NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
    locale               TEXT         NOT NULL DEFAULT 'ja',
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT user_notification_preferences_digest_hour_chk
        CHECK (digest_hour_local BETWEEN 0 AND 23)
);
