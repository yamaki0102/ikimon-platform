-- Populate asset_blobs for legacy avatar files and relink users.avatar_asset_id.
-- 2026-04-24: 従来 avatar_asset_id は dangling FK (blob 欠落) で img 出ない → 修復
-- Files at /var/www/ikimon.life/repo/upload_package/public_html/uploads/avatars/

BEGIN;

INSERT INTO asset_blobs (blob_id, storage_backend, storage_path, media_type, mime_type, public_url, sha256, bytes, source_payload, created_at, updated_at)
VALUES
  ('11111111-aaaa-bbbb-cccc-000000000001', 'legacy', '/uploads/avatars/user_69be85c688371_1774093902.png', 'image', 'image/png', '/uploads/avatars/user_69be85c688371_1774093902.png', 'legacy-avatar-nats', 0, '{}'::jsonb, now(), now()),
  ('11111111-aaaa-bbbb-cccc-000000000002', 'legacy', '/uploads/avatars/user_69acd65b8e01c_1772934986.webp', 'image', 'image/webp', '/uploads/avatars/user_69acd65b8e01c_1772934986.webp', 'legacy-avatar-yoh', 0, '{}'::jsonb, now(), now()),
  ('11111111-aaaa-bbbb-cccc-000000000003', 'legacy', '/uploads/avatars/user_admin_001_1775256234.webp', 'image', 'image/webp', '/uploads/avatars/user_admin_001_1775256234.webp', 'legacy-avatar-admin', 0, '{}'::jsonb, now(), now()),
  ('11111111-aaaa-bbbb-cccc-000000000004', 'legacy', '/uploads/avatars/user_69a01379b962e_1772547665.png', 'image', 'image/png', '/uploads/avatars/user_69a01379b962e_1772547665.png', 'legacy-avatar-nats-legacy', 0, '{}'::jsonb, now(), now())
ON CONFLICT (blob_id) DO UPDATE SET public_url = EXCLUDED.public_url, storage_path = EXCLUDED.storage_path;

UPDATE users SET avatar_asset_id = '11111111-aaaa-bbbb-cccc-000000000001' WHERE user_id = 'user_69be85c688371';
UPDATE users SET avatar_asset_id = '11111111-aaaa-bbbb-cccc-000000000002' WHERE user_id = 'user_69acd65b8e01c';
UPDATE users SET avatar_asset_id = '11111111-aaaa-bbbb-cccc-000000000003' WHERE user_id = 'user_admin_001';
UPDATE users SET avatar_asset_id = '11111111-aaaa-bbbb-cccc-000000000004' WHERE user_id = 'user_69a01379b962e';

COMMIT;
