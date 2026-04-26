-- Normalized media role index for research/search/aggregation.
--
-- Do not ALTER evidence_assets here. Staging/prod deploy roles may write to
-- evidence_assets but are not guaranteed to own it, so media-role query state
-- lives in a companion table keyed by asset_id.

CREATE TABLE IF NOT EXISTS evidence_asset_media_roles (
    asset_id          UUID        PRIMARY KEY REFERENCES evidence_assets(asset_id) ON DELETE CASCADE,
    occurrence_id     TEXT        NOT NULL REFERENCES occurrences(occurrence_id) ON DELETE CASCADE,
    visit_id          TEXT        NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    asset_role        TEXT        NOT NULL,
    media_role        TEXT        NOT NULL
        CHECK (media_role IN ('primary_subject', 'context', 'sound_motion', 'secondary_candidate')),
    media_role_source TEXT        NOT NULL DEFAULT 'user'
        CHECK (media_role_source IN ('user', 'ai', 'system', 'backfill')),
    source_payload    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_asset_media_roles_occurrence
    ON evidence_asset_media_roles (occurrence_id, media_role);

CREATE INDEX IF NOT EXISTS idx_evidence_asset_media_roles_visit
    ON evidence_asset_media_roles (visit_id, media_role);

CREATE INDEX IF NOT EXISTS idx_evidence_asset_media_roles_role_asset
    ON evidence_asset_media_roles (media_role, asset_role, updated_at DESC);

INSERT INTO evidence_asset_media_roles (
    asset_id,
    occurrence_id,
    visit_id,
    asset_role,
    media_role,
    media_role_source,
    source_payload
)
SELECT
    ea.asset_id,
    ea.occurrence_id,
    ea.visit_id,
    ea.asset_role,
    ea.source_payload->>'media_role',
    'backfill',
    jsonb_build_object(
        'source', 'migration_backfill',
        'from', 'evidence_assets.source_payload.media_role'
    )
FROM evidence_assets ea
WHERE ea.occurrence_id IS NOT NULL
  AND ea.visit_id IS NOT NULL
  AND ea.source_payload->>'media_role' IN (
      'primary_subject',
      'context',
      'sound_motion',
      'secondary_candidate'
  )
ON CONFLICT (asset_id) DO UPDATE SET
    occurrence_id = EXCLUDED.occurrence_id,
    visit_id = EXCLUDED.visit_id,
    asset_role = EXCLUDED.asset_role,
    media_role = EXCLUDED.media_role,
    media_role_source = EXCLUDED.media_role_source,
    source_payload = evidence_asset_media_roles.source_payload || EXCLUDED.source_payload,
    updated_at = NOW();

COMMENT ON TABLE evidence_asset_media_roles IS
  'Searchable media-role index for observation assets. Keeps evidence_assets owner-safe.';
