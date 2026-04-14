# Legacy Write Inventory

更新日: 2026-04-11  
この文書は、`ikimon_v2_zero_base_cutover_master_plan_2026-04-11.md` の Phase 0 用 inventory。

目的:

- 旧系の write surface を固定する
- cutover 直前まで何を delta sync すべきかを明確にする
- dual-write compatibility の対象を限定する

---

## 1. Critical user-facing writes

### 1.1 Users / auth

- [UserStore.php](/E:/Projects/Playground/upload_package/libs/UserStore.php)
  - `DataStore::save('users', ...)`
- [Auth.php](/E:/Projects/Playground/upload_package/libs/Auth.php)
  - remember token: `data/auth_tokens.json`
  - session save path: `data/sessions/`
- [oauth_callback.php](/E:/Projects/Playground/upload_package/public_html/oauth_callback.php)
  - OAuth merge / create / guest migration
- [update_profile.php](/E:/Projects/Playground/upload_package/public_html/api/update_profile.php)
  - `users.json` update
  - observation 内の `user_name` denormalized sync
- [upload_avatar.php](/E:/Projects/Playground/upload_package/public_html/api/upload_avatar.php)
  - avatar upload
  - `users.json` update
  - observation 内の `user_avatar` denormalized sync
- [AppAuthTokenStore.php](/E:/Projects/Playground/upload_package/libs/AppAuthTokenStore.php)
  - `fieldscan_app_tokens`
- [FieldScanInstallRegistry.php](/E:/Projects/Playground/upload_package/libs/FieldScanInstallRegistry.php)
  - `fieldscan_installs`
  - anonymous fieldscan user create → `users.json`

### 1.2 Observations

- [post_observation.php](/E:/Projects/Playground/upload_package/public_html/api/post_observation.php)
  - observation create/update
  - photos upload
  - canonical dual-write 試行
  - `events` upsert
- [quick_post.php](/E:/Projects/Playground/upload_package/public_html/api/v2/quick_post.php)
- [scan_detection.php](/E:/Projects/Playground/upload_package/public_html/api/v2/scan_detection.php)
- [passive_event.php](/E:/Projects/Playground/upload_package/public_html/api/v2/passive_event.php)
- [add_observation_photo.php](/E:/Projects/Playground/upload_package/public_html/api/add_observation_photo.php)
- [update_observation.php](/E:/Projects/Playground/upload_package/public_html/api/update_observation.php)
- [post_identification.php](/E:/Projects/Playground/upload_package/public_html/api/post_identification.php)
- [session_recap.php](/E:/Projects/Playground/upload_package/public_html/api/v2/session_recap.php)
  - `session_recaps/{session_id}`

### 1.3 Tracks / sessions / FieldScan

- [save_track.php](/E:/Projects/Playground/upload_package/public_html/api/save_track.php)
  - `data/tracks/{user}/{session}.json`
- [passive_event.php](/E:/Projects/Playground/upload_package/public_html/api/v2/passive_event.php)
  - `passive_sessions`
  - `environment_logs`
- [save_scan_frame.php](/E:/Projects/Playground/upload_package/public_html/api/v2/save_scan_frame.php)
- [scan_draft_save.php](/E:/Projects/Playground/upload_package/public_html/api/v2/scan_draft_save.php)
- [sound_archive_upload.php](/E:/Projects/Playground/upload_package/public_html/api/v2/sound_archive_upload.php)
  - sound archive image/audio upload
  - `sound_archive`
- [analyze_audio.php](/E:/Projects/Playground/upload_package/public_html/api/v2/analyze_audio.php)
  - uploaded audio write
  - `sound_archive`

### 1.4 Assets

- photos
  - `public_html/uploads/photos/...`
  - production 実体は主に `persistent/uploads/photos/...`
- avatars
  - `public_html/uploads/avatars/...`
  - production 実体は主に `persistent/uploads/avatars/...`
- audio
  - `public_html/uploads/audio/...`
  - production 実体は主に `persistent/uploads/audio/...`
- scan uploads
  - `data/uploads/scan/...`
- reactions
  - `data/reactions/{obs_id}/{type}.json`
- observation count cache
  - `data/counts/observations/{obs_id}.json`

### 1.5 Social / side effects

- follows
  - `data/follows/*.json`
- notifications
  - `data/notifications/{user_id}.json`
- invites
  - `data/invites.json`
- surveys
  - `data/surveys/*.json`
- reactions
  - [toggle_like.php](/E:/Projects/Playground/upload_package/public_html/api/toggle_like.php)
  - `data/reactions/**`
  - notification side effect
- follows
  - [FollowManager.php](/E:/Projects/Playground/upload_package/libs/FollowManager.php)
  - `data/follows/{user_id}.json`

### 1.6 Business / workspace side effects

- [BusinessApplicationManager.php](/E:/Projects/Playground/upload_package/libs/BusinessApplicationManager.php)
  - `business_applications`
- [CorporateInviteManager.php](/E:/Projects/Playground/upload_package/libs/CorporateInviteManager.php)
  - `corporate_invites`
- [CorporateManager.php](/E:/Projects/Playground/upload_package/libs/CorporateManager.php)
  - corporation workspace state
- [InviteManager.php](/E:/Projects/Playground/upload_package/libs/InviteManager.php)
  - invite acceptance side effect

---

## 2. Physical write targets

### 2.1 JSON / file

- `data/users.json`
- `data/auth_tokens.json`
- `data/fieldscan_app_tokens.json`
- `data/fieldscan_installs.json`
- `data/invites.json`
- `data/business_applications*.json`
- `data/corporate_invites*.json`
- `data/observations.json`
- `data/observations/*.json`
- `data/events.json`
- `data/follows/*.json`
- `data/notifications/*.json`
- `data/reactions/**`
- `data/counts/observations/*.json`
- `data/tracks/**`
- `data/passive_sessions/*.json`
- `data/environment_logs/*.json`
- `data/surveys/*.json`
- `data/sites/**`
- `data/session_recaps/**`
- `data/sound_archive*.json`
- `data/uploads/scan/**`
- `data/sessions/**`

### 2.2 Uploads

- `/var/www/ikimon.life/persistent/uploads/photos/**`
- `/var/www/ikimon.life/persistent/uploads/avatars/**`
- `/var/www/ikimon.life/persistent/uploads/audio/**`

### 2.3 Canonical experiments already present

- `upload_package/data/ikimon.db`
- staging 側では canonical rows が入っている
- production 側では `ikimon.db` はまだ 0 byte

---

## 3. v2 dual-write minimum set

cutover 後 7-14 日の rollback safety window で、最低限 legacy へ同期互換書き込みする対象:

- user update
- remember token issue/revoke
- fieldscan app token issue/revoke
- fieldscan install ↔ user binding
- observation create
- observation update
- photo upload
- audio upload
- avatar upload
- track save
- invite acceptance
- business application submit
- corporate invite acceptance

同期互換対象から外してよいもの:

- analytics raw
- rebuildable cache
- derived recommendation outputs

---

## 4. Cutover risk hotspots

### 4.1 Auth continuity

- `auth_tokens.json` を落とすと再ログイン祭りになる
- `data/sessions/**` は archive でよいが、remember token 互換は必要

### 4.2 Asset path drift

- DB上の相対パスと、実ファイルの物理配置がずれている
- production は `public_html/uploads` と `persistent/uploads` が混在している
- avatar / audio も同じ drift を持つ

### 4.3 Observation fan-out

- 旧 observation 1 件に photos / IDs / AI assessment / site context が混在している
- v2 import は `visit + occurrence + evidence` に分離する必要がある

### 4.4 Hidden side effects

- login / oauth callback が guest observation migration を持つ
- post/create 系が `events` も更新する
- profile / avatar 更新が observation の denormalized user fields を更新する
- reactions が notification と counts cache を更新する
- business apply が後続 workspace provisioning の起点になる

---

## 5. Phase 0 acceptance

Phase 0 を完了とみなす条件:

- critical write surface が固定されている
- physical write target が列挙されている
- dual-write minimum set が明示されている
- cutover hotspot が明示されている
