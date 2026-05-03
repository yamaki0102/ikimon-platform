-- Field-level manager / steward role (Phase 2)
--
-- Purpose:
--   ユーザー要望「希少種の正確な情報は、エリアの管理者であることが認められた人と
--   特定権限を与えられた人にだけ見せる」を実現するための薄い権限テーブル。
--
--   admin/analyst (グローバル) が見えるのは前提。これは「自然共生サイト運営者」
--   「環境省委託調査員」「学術研究者」など特定 field の権限保持者を限定的に
--   コアユーザー扱いするためのもの。
--
-- 役割:
--   - owner       — 認定地そのものの主体 (例: 自然共生サイトの運営法人)
--   - steward     — 現地でのモニタリングを請け負う調査員 (季節限定など)
--   - viewer_exact — 研究者・連携機関への読み取り専用権限 (write は別レイヤー)
--
-- 期限:
--   `expires_at` を必ず確認することで「研究プロジェクト終了後に自動失効」が成立。

CREATE TABLE IF NOT EXISTS field_managers (
    manager_id   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id     UUID         NOT NULL REFERENCES observation_fields(field_id) ON DELETE CASCADE,
    user_id      TEXT         NOT NULL,
    role         TEXT         NOT NULL,
    granted_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    granted_by   TEXT,
    expires_at   TIMESTAMPTZ,
    note         TEXT         NOT NULL DEFAULT '',
    CONSTRAINT field_managers_role_chk
        CHECK (role IN ('owner', 'steward', 'viewer_exact'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_field_managers_unique
    ON field_managers (field_id, user_id, role);

CREATE INDEX IF NOT EXISTS idx_field_managers_user
    ON field_managers (user_id, role)
    WHERE expires_at IS NULL OR expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_field_managers_field
    ON field_managers (field_id, role);
