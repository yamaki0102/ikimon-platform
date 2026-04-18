-- /contact フォーム送信内容の保管テーブル。
-- Gmail SMTP relay (msmtp 経由) で通知・自動返信を送るが、
-- メール到達に関係なく原文は DB に残す。
-- 管理画面（将来実装）からの履歴確認・再送・分析に使う。

CREATE TABLE IF NOT EXISTS contact_submissions (
    submission_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category            TEXT        NOT NULL,
    name                TEXT        NOT NULL DEFAULT '',
    email               TEXT        NOT NULL DEFAULT '',
    organization        TEXT        NOT NULL DEFAULT '',
    message             TEXT        NOT NULL,
    source_url          TEXT        NOT NULL DEFAULT '',
    user_agent          TEXT        NOT NULL DEFAULT '',
    ip_hash             TEXT        NOT NULL DEFAULT '',
    user_id             TEXT,
    notification_sent   BOOLEAN     NOT NULL DEFAULT FALSE,
    auto_reply_sent     BOOLEAN     NOT NULL DEFAULT FALSE,
    send_error          TEXT        NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_submitted_at
    ON contact_submissions (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_category
    ON contact_submissions (category);
