-- Purge 本番 v2 DB / staging DB の非実用データ
--
-- 2026-04-23 YAMAKI 承認: 案A（厳しく純化）、Nats 保護を条件に実行。
--
-- 削除対象:
--   1. user_admin_001 の photos なし visits (6335 件)
--      → 本番 admin による passive scan / live-scan / pocket walk の大量自動投稿
--   2. system_import (愛管 生物調査チーム) の全 54 件 (seed/demo)
--   3. install_* / field_user_* の photos なし (9 件) (FieldScan センサー投稿)
--   4. e2e テストユーザー (email e2e_%@example.com) の 4 件 (photos 4 含む)
--
-- 合計削除: 6402 visits (および CASCADE で紐づく occurrences/evidence/identifications)
--
-- 保護対象（明示 assert）:
--   - Nats (user_69be85c688371): 132 visits / 269 photos
--   - YAMAKI (user_69bc926c2eca4): 9 visits / 23 photos
--   - よー (user_69acd65b8e01c): 5 visits
--   - admin の photos 付き (49枚): 20 visits は残す
--   - Guest の photos 付き
--
-- 使い方:
--   sudo -u postgres psql ikimon_v2_staging -f purge_admin_seed_garbage_2026-04-23.sql
--   sudo -u postgres psql ikimon_v2        -f purge_admin_seed_garbage_2026-04-23.sql
--
-- 事前必須:
--   pg_dump で backup を取る（15分以内に復元できる state で実行）
--
-- Before / After (実測 2026-04-23 22:25):
--                Before | After
--   users:           77  |   77
--   visits:       6573  |  171
--   occurrences:  6530  |  170
--   track_points: 5725  | 1122
--   identifications: 201 |  56
--   photos:        365  |  361

BEGIN;

CREATE TEMP TABLE purge_targets AS
  -- 1. admin_no_photo
  SELECT v.visit_id, 'admin_no_photo' AS reason
  FROM visits v
  WHERE v.user_id = 'user_admin_001'
  AND NOT EXISTS (
    SELECT 1 FROM occurrences o
    JOIN evidence_assets ev ON ev.occurrence_id = o.occurrence_id AND ev.asset_role = 'observation_photo'
    WHERE o.visit_id = v.visit_id
  )
  UNION ALL
  -- 2. system_import
  SELECT visit_id, 'system_import' FROM visits WHERE user_id = 'system_import'
  UNION ALL
  -- 3. install_ / field_user_
  SELECT v.visit_id, 'install_field_no_photo'
  FROM visits v
  WHERE (v.user_id LIKE 'install_%' OR v.user_id LIKE 'field_user_%')
  AND NOT EXISTS (
    SELECT 1 FROM occurrences o
    JOIN evidence_assets ev ON ev.occurrence_id = o.occurrence_id AND ev.asset_role = 'observation_photo'
    WHERE o.visit_id = v.visit_id
  )
  UNION ALL
  -- 4. e2e test user
  SELECT v.visit_id, 'e2e_test'
  FROM visits v
  JOIN users u ON u.user_id = v.user_id
  WHERE u.email LIKE 'e2e_%@example.com';

-- 保護対象が誤って含まれていないかの assert
DO $$
DECLARE
  protected_hits int;
BEGIN
  SELECT count(*) INTO protected_hits
  FROM visits v
  JOIN purge_targets p ON p.visit_id = v.visit_id
  WHERE v.user_id IN (
    'user_69be85c688371',  -- Nats (latest)
    'user_69a01379b962e',  -- Nats (legacy users.json)
    'user_69bc926c2eca4',  -- YAMAKI
    'user_69acd65b8e01c'   -- よー
  );
  IF protected_hits > 0 THEN
    RAISE EXCEPTION 'SAFETY VIOLATION: % protected visits would be deleted', protected_hits;
  END IF;
  RAISE NOTICE 'safety check passed: 0 protected visits targeted';
END
$$;

-- 削除実行 (CASCADE で occurrences / evidence_assets / identifications /
-- place_conditions / visit_track_points / observation_ai_* も連動削除)
DELETE FROM visits WHERE visit_id IN (SELECT visit_id FROM purge_targets);

COMMIT;

-- 確認クエリ
-- SELECT (SELECT count(*) FROM users) u, (SELECT count(*) FROM visits) v,
--        (SELECT count(*) FROM occurrences) o, (SELECT count(*) FROM visit_track_points) tp,
--        (SELECT count(*) FROM evidence_assets WHERE asset_role='observation_photo') photos;
