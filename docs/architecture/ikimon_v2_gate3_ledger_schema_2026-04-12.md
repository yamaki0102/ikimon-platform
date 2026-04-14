# ikimon v2 Gate 3 Ledger Schema

更新日: 2026-04-12  
目的: Gate 3 の `importer / ledger skeleton` で使う最小テーブル責務を固定する。  
この文書は [0005_import_ledgers.sql](/E:/Projects/Playground/platform_v2/db/migrations/0005_import_ledgers.sql) の設計意図。

---

## 1. 結論

Gate 3 の ledger は 3 本に分ける。

1. `legacy_id_map`
2. `migration_ledger`
3. `asset_ledger`

混ぜない。役割はこう。

- `legacy_id_map`
  - 一度 canonical に採番された `legacy id <-> canonical id` の恒久対応表
- `migration_ledger`
  - importer が 1 entity をどう処理したかの実行記録
- `asset_ledger`
  - file / blob import の実行記録

---

## 2. Why existing tables were not enough

既存 v2 schema には次があった。

- [0002_programs_and_sync.sql](/E:/Projects/Playground/platform_v2/db/migrations/0002_programs_and_sync.sql)
  - `legacy_id_map`
  - `migration_runs`
  - `asset_import_manifest`

ただし不足があった。

### 2.1 `legacy_id_map`

足りないもの:

- import status
- skipped reason
- import version
- 実行時点の checksum

つまり:

- `mapping table` ではある
- でも `execution ledger` ではない

### 2.2 `migration_runs`

足りないもの:

- 1 row / 1 entity の結果

つまり:

- batch header ではある
- でも per-row ledger ではない

### 2.3 `asset_import_manifest`

足りないもの:

- asset import status
- skipped reason
- import version
- logical asset type
- canonical blob / asset への安定参照

---

## 3. Final split

### 3.1 `legacy_id_map`

用途:

- idempotent upsert の anchor
- rollback / delta sync 時の canonical id 再利用

持つべき意味:

- `legacy_source`
- `legacy_entity_type`
- `legacy_id`
- `canonical_entity_type`
- `canonical_id`

### 3.2 `migration_ledger`

用途:

- importer 実行の結果ログ
- `何を imported / skipped / failed したか` の監査
- checksum と version を使った再実行判定

1 row = 1 legacy entity

主カラム:

- `entity_type`
- `legacy_source`
- `legacy_entity_type`
- `legacy_id`
- `canonical_entity_type`
- `canonical_id`
- `canonical_parent_type`
- `canonical_parent_id`
- `import_status`
- `skipped_reason`
- `source_checksum`
- `import_version`
- `observed_at`
- `imported_at`

### 3.3 `asset_ledger`

用途:

- file import の結果ログ
- `legacy relative path -> blob_id / asset_id` の監査
- path drift と missing file の見える化

1 row = 1 legacy asset path

主カラム:

- `legacy_relative_path`
- `logical_asset_type`
- `storage_backend`
- `storage_path`
- `blob_id`
- `asset_id`
- `import_status`
- `skipped_reason`
- `sha256`
- `bytes`
- `mime_type`
- `import_version`
- `last_seen_at`
- `imported_at`

---

## 4. Status vocabulary

ledger の status は最小でこれに固定する。

- `pending`
- `imported`
- `skipped`
- `failed`

`skipped_reason` は最小でこれに固定する。

- `workflow_only`
- `test_residue`
- `missing_required_fields`
- `missing_file`
- `duplicate_checksum`
- `unsupported_media_type`

---

## 5. Entity type vocabulary

`migration_ledger.entity_type` は最小でこれに固定する。

- `observation_meaning`
- `visit`
- `occurrence`
- `identification`
- `place_condition`
- `privacy_access`

`asset_ledger.logical_asset_type` は最小でこれに固定する。

- `photo`
- `avatar`
- `audio`
- `scan_photo`
- `scan_frame`
- `sound_archive_image`

---

## 6. Import order

この順で importer を作る。

1. `place`
2. `visit`
3. `occurrence`
4. `identification`
5. `place_condition`
6. `asset`

理由:

- `occurrence` は `visit` が先に必要
- `identification` は `occurrence` が先に必要
- `asset` は `occurrence / visit` のどちらかが先に必要

---

## 7. Gate 3 Definition of Done

Gate 3 の入口としては、少なくともこれが必要。

- `legacy_id_map` がある
- `migration_ledger` がある
- `asset_ledger` がある
- importer が `pending/imported/skipped/failed` を書ける
- skip reason が workflow boundary と一致する

---

## 8. Code references

- [0002_programs_and_sync.sql](/E:/Projects/Playground/platform_v2/db/migrations/0002_programs_and_sync.sql)
- [0005_import_ledgers.sql](/E:/Projects/Playground/platform_v2/db/migrations/0005_import_ledgers.sql)
- [planObservationLedger.ts](/E:/Projects/Playground/platform_v2/src/scripts/planObservationLedger.ts)
- [importObservationMeaning.ts](/E:/Projects/Playground/platform_v2/src/scripts/importObservationMeaning.ts)
- [importObservationEvidence.ts](/E:/Projects/Playground/platform_v2/src/scripts/importObservationEvidence.ts)
- [importObservationIdentification.ts](/E:/Projects/Playground/platform_v2/src/scripts/importObservationIdentification.ts)
- [importObservationPlaceCondition.ts](/E:/Projects/Playground/platform_v2/src/scripts/importObservationPlaceCondition.ts)
- [ikimon_legacy_workflow_state_boundary_2026-04-12.md](/E:/Projects/Playground/docs/architecture/ikimon_legacy_workflow_state_boundary_2026-04-12.md)
- [ikimon_v2_cutover_readiness_checklist_2026-04-12.md](/E:/Projects/Playground/docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md)

現時点:

- `planObservationLedger.ts` は `observations.json -> migration_ledger + legacy_id_map` の最小 planner として動く
- `importObservationMeaning.ts` は `migration_ledger(import_status=pending) -> places / visits / occurrences` の最小 importer skeleton として staging DB sample import まで通った
- `importObservationEvidence.ts` は `observations.json -> asset_ledger + asset_blobs + evidence_assets` の最小 importer skeleton として staging DB sample import まで通った
- `importObservationIdentification.ts` は `observations.json -> identifications` の最小 importer skeleton として staging DB sample import まで通った
- `importObservationPlaceCondition.ts` は `observations.json -> place_conditions` の最小 importer skeleton として staging DB sample import まで通った
- `verifyLegacyParity.ts` は sample import 用 parity report として staging DB で `count/checksum parity` まで通った
- `verifyLegacyParity.ts` は full import `v0-full-20260412a` でも staging DB で `count/checksum parity` を通し、`missing photo refs` を importer bug ではなく legacy asset gap として分離できる
- `importRememberTokens.ts` は staging DB で `auth_tokens.json -> remember_tokens + migration_ledger(remember_token)` を通し、full import `v0-full-20260412b` で `rememberTokens=63` の parity を確認した
- `importTrackSessions.ts` は staging DB で `tracks -> visits + visit_track_points + migration_ledger(track_visit)` を通し、full import `v0-full-20260412c` で `trackVisits=42 / trackPoints=5539` の parity を確認した
- sample import 中に見つかった `repo path hardcode`, `pending binding 参照`, `sample order drift`, `asset_ledger.asset_id` FK 不整合は修正済み
- `reportLegacyDrift.ts` は `latest parity / delta sync freshness / sync cursor freshness / recent verify history` をまとめて返す Gate 3 の drift report として使える
- staging `report:legacy-drift -- --history=5 --stale-hours=24` は `healthy / latestImportVersion=v0-full-20260412c` を返し、full parity lane と partial sample lane を運用上区別できる状態まで確認した
- `scripts/ops/run_legacy_drift_report.sh` は staging の root crontab `15 * * * *` から hourly 実行する wrapper として設定済み
- wrapper は root 実行時に `postgres` ユーザーへ落として `ikimon_v2_staging` へ接続する
- `/var/log/ikimon/legacy_drift_report.log` への実ログ出力も確認済み
- `src/services/readiness.ts` は latest drift report を `/ops/readiness` に載せ、staging では `near_ready / deltaSyncHealthy=true / driftReportHealthy=true` を返す
