-- Repair only missing lifecycle metadata. Existing timestamps remain authoritative.
UPDATE auth_users
SET
  created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
  updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL OR updated_at IS NULL;

-- Expired sessions cannot authenticate and do not need indefinite retention.
DELETE FROM auth_sessions
WHERE datetime(
  CASE
    WHEN expires_at GLOB '*+[0-9][0-9]' OR expires_at GLOB '*-[0-9][0-9]'
      THEN expires_at || ':00'
    ELSE expires_at
  END
) <= datetime('now');
