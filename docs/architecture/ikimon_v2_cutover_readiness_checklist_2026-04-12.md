# ikimon v2 Cutover Readiness Checklist

更新日: 2026-04-12  
この文書は、`ikimon_v2_zero_base_cutover_master_plan_2026-04-11.md` を **実務の Go / No-Go checklist** に落としたもの。  
目的は 2 つだけ。

1. `いまの PHP でまだ進めるべきこと` と `v2 切替判断の条件` を混ぜない
2. cutover を「いつかやる」ではなく、`何が揃えば切れるか` で管理する

---

## 1. 前提

まず固定する。

- いまの本番主系は PHP + JSON / file store
- いまの product 改装は PHP で進める
- `ikimon.db` canonical は現行 PHP の秩序づけ用であり、v2 cutover そのものではない
- v2 cutover は `Next.js + Fastify + PostgreSQL/PostGIS/Timescale` への **parallel rebuild の本番切替**

重要:

- `現行 PHP の改善` は v2 まで止めない
- ただし `いま触る必要がない重い再設計` は v2 側へ送る
- 切替条件が揃う前に「PHP をやめる」方向へ中途半端に寄せない

---

## 2. いま PHP でやること / v2 まで待つこと

### 2.1 いま PHP でやること

- public / app の主導線改装
- place-first IA の整理
- staging parity と QA
- 現行 write surface の固定
- canonical 契約の整理
- divergence check の導入
- queue / Omoikane 停滞の復旧

判断基準:

- `今の売上・検証・運用・学習速度` に効くなら PHP でやる
- `v2 に移っても捨てずに済む仕様判断` なら PHP でやる

### 2.2 v2 まで待つこと

- Next.js public/app surface の実装
- Fastify API の全面置換
- PostgreSQL canonical への本格移行
- import / delta sync / dual-write 基盤
- nginx upstream 切替
- rollback drill を含む本番切替運用

判断基準:

- `切替基盤そのもの`
- `現行 PHP に無理に持ち込むと捨て実装になるもの`

---

## 3. Cutover readiness gate

Go 条件は、次の 6 gate を **すべて** 満たした時だけ成立する。  
1つでも欠けたら No-Go。

### Gate 1. Scope freeze

定義:

- legacy write surface が固定されている
- delta sync 対象の physical path が固定されている
- dual-write minimum set が固定されている

受け入れ条件:

- `legacy_write_inventory_2026-04-11.md` が最新である
- 新しい critical write が出た時に inventory が更新される運用がある
- auth / observation / asset / track / invite の write path に曖昧さがない

現在地:

- `Legacy Write Inventory` はある
- `legacy_write_inventory_2026-04-11.md` を 2026-04-12 時点の code search に合わせて更新した
- business / fieldscan app auth / reactions / avatar denormalization まで inventory に入った
- `ikimon_asset_path_mapping_2026-04-12.md` を追加し、uploads drift の mapping 表を作成した
- [legacy_write_inventory_manifest_2026-04-12.json](/E:/Projects/Playground/docs/architecture/legacy_write_inventory_manifest_2026-04-12.json) と [check_legacy_write_inventory.ps1](/E:/Projects/Playground/scripts/check_legacy_write_inventory.ps1) を追加し、known write surface と未棚卸し候補を CLI で見られるようにした
- 初回実行では `missingKnownFiles=0 / unknownCandidates=78` で、inventory の次の棚卸し対象を機械的に出せる状態まで来た
- [ikimon_legacy_write_inventory_triage_2026-04-12.md](/E:/Projects/Playground/docs/architecture/ikimon_legacy_write_inventory_triage_2026-04-12.md) で `unknownCandidates=78` を `P0 / P1 / P2` に圧縮した
- manifest に `ignorePathPatterns / ignoredWriteFiles` を入れて Gate 1 の critical scope を固定した
- `check_legacy_write_inventory.ps1` 再実行では `status=PASS / unknownCandidates=0 / missingKnownFiles=0` まで到達した

判定:

- `DONE`

### Gate 2. Canonical contract freeze

定義:

- `place / visit / observation / evidence / condition / follow` の主語が固定されている
- 現行 PHP 側でどこまで JSON、どこから canonical に寄せるかが明示されている

受け入れ条件:

- `ADR-001` と `canonical_migration_policy` を具体化した保存契約がある
- UI 主語と保存主語のズレが列挙されている
- rollback 不能な migration が merge されないガードがある

現在地:

- 原則 docs はある
- `ikimon_canonical_contract_table_2026-04-12.md` で概念別の保存契約表を追加した
- `ikimon_canonical_divergence_minimum_spec_2026-04-12.md` で divergence 最小仕様を固定した
- `upload_package/tools/check_canonical_divergence.php` を最小版へ拡張し、`observations/assets` の実比較に加えて、`auth/business` の参照整合も比較できるようにした
- `place / visit` についても `track / passive_session / environment_log / session_recap` の参照整合を CLI で比較できるようにした
- `ikimon_asset_path_mapping_2026-04-12.md` で asset drift を docs とコードの両側から固定した
- orphan canonical 4件は root cause を切り、`actionable divergence` ではなく `local test/dev residue` と分類できる状態にした
- `CanonicalObservationGuard` により test/dev residue を新規に canonical へ入れにくくした
- `cleanup_test_canonical_residue.php` で local canonical residue を 1 コマンドで掃除できるようにした
- local dataset では `check_canonical_divergence.php --json` が `PASS` まで到達した
- `ikimon_canonical_enforcement_surface_map_2026-04-12.md` で write surface ごとの enforcement 優先順位を固定した
- `ikimon_canonical_connection_decision_quickpost_scan_2026-04-12.md` で `quick_post / scan_summary / scan_detection` の接続方針を固定した
- `quick_post.php` は canonical 接続済み
- `passive_event.php` は `CanonicalMachineObservationPolicy` により machine 用 separate policy を持った
- `scan_detection.php` も同 machine policy を共有し、parent event / child event / occurrence / photo evidence を canonical へ書くようになった
- `update_observation.php` は canonical event / occurrence / privacy / place condition の最小 parity を持った
- `post_identification.php` は canonical identification append と consensus 再評価の最小 parity を持った
- `propose / review / support metadata` も、観察の意味が変わる `direct / accept / auto_accepted` 時だけ canonical sync するようになった
- `ikimon_legacy_workflow_state_boundary_2026-04-12.md` を追加し、proposal bookkeeping / edit_log / queue state を intentional に JSON only とする境界を固定した
- `platform_v2/src/scripts/applyMigrations.ts` に destructive migration guard を追加し、`DROP / TRUNCATE / ALTER TABLE ... DROP / DELETE / UPDATE` を含む SQL は `--allow-destructive` なしでは通らないようにした
- staging `npm run migrate` では既存 `0001-0005` がすべて `skip` で通り、guard 導入後も通常 migration lane を壊していないことを確認した
- [ikimon_destructive_migration_policy_2026-04-12.md](/E:/Projects/Playground/docs/architecture/ikimon_destructive_migration_policy_2026-04-12.md) を追加し、destructive migration の merge 条件と required artifacts を固定した
- ただし importer 実運用後の parity 拡張は未完

判定:

- `DONE`

### Gate 3. v2 data plane ready

定義:

- v2 PostgreSQL schema と import ledger が動く
- bootstrap import が冪等に回る
- uploads / tracks / auth token を含む asset import が整う

受け入れ条件:

- 空 DB を作り直せる
- importer を再実行しても壊れない
- `legacy_id_map`, `migration_ledger`, `asset_ledger` がある
- sample snapshot で counts / checksum parity を取れる

現在地:

- schema / planner / sample importer 実証までは進んだ
- [0005_import_ledgers.sql](/E:/Projects/Playground/platform_v2/db/migrations/0005_import_ledgers.sql) を追加し、`migration_ledger / asset_ledger` の最小 schema を置いた
- [ikimon_v2_gate3_ledger_schema_2026-04-12.md](/E:/Projects/Playground/docs/architecture/ikimon_v2_gate3_ledger_schema_2026-04-12.md) で `legacy_id_map / migration_ledger / asset_ledger` の責務分離を固定した
- [planObservationLedger.ts](/E:/Projects/Playground/platform_v2/src/scripts/planObservationLedger.ts) を追加し、`observations.json -> migration_ledger + legacy_id_map` の最小 planner が dry-run で通る
- [importObservationMeaning.ts](/E:/Projects/Playground/platform_v2/src/scripts/importObservationMeaning.ts) を追加し、`migration_ledger(pending) -> places / visits / occurrences` の最小 importer skeleton が dry-run で通る
- [importObservationEvidence.ts](/E:/Projects/Playground/platform_v2/src/scripts/importObservationEvidence.ts) を追加し、`observations.json -> asset_ledger + asset_blobs + evidence_assets` の最小 importer skeleton が dry-run で通る
- [importObservationIdentification.ts](/E:/Projects/Playground/platform_v2/src/scripts/importObservationIdentification.ts) を追加し、`observations.json -> identifications` の最小 importer skeleton が dry-run で通る
- [importObservationPlaceCondition.ts](/E:/Projects/Playground/platform_v2/src/scripts/importObservationPlaceCondition.ts) を追加し、`observations.json -> place_conditions` の最小 importer skeleton が dry-run で通る
- importer の repo-relative path 解決、idempotent skip、`imported` binding 限定、sample sort の deterministic 化を入れた
- staging VPS の `ikimon_v2_staging` で migration `0005` 適用済み
- staging sample run では `plan -> meaning -> identifications -> place_conditions` の順で実 import を確認した
- staging sample run では `limit=100` で `evidencePlanned: 7 / evidenceImported: 7 / missingBindings: 0 / missingFiles: 0` まで確認した
- [verifyLegacyParity.ts](/E:/Projects/Playground/platform_v2/src/scripts/verifyLegacyParity.ts) を sample import 用 parity report に作り替え、staging `v0-sample-20260412h` で `observations=100 / identifications=100 / conditions=100 / photoRefs=7 / uniquePhotoRefs=6 / checksum mismatch=0` の一致を確認した
- staging `v0-full-20260412a` では full import を実行し、`observations=6743 / identifications=6658 / conditions=6743 / existingPhotoRefs=454 / uniqueExistingPhotoRefs=255 / checksum mismatch=0` の full snapshot parity を確認した
- full import の photo asset は `photoRefs=501` 中 `47` が legacy 実ファイル欠損で、importer 側では `assetLedgerSkipped=47` として説明可能な状態まで切り分けた
- [importRememberTokens.ts](/E:/Projects/Playground/platform_v2/src/scripts/importRememberTokens.ts) を追加し、`auth_tokens.json -> remember_tokens + migration_ledger(remember_token)` の専用 importer を作った
- staging `v0-full-20260412b` では `rememberTokens=63` も同じ import version に載せて full parity を取り、`remember_token.imported=63` まで一致を確認した
- [importTrackSessions.ts](/E:/Projects/Playground/platform_v2/src/scripts/importTrackSessions.ts) を追加し、`tracks -> visits + visit_track_points + migration_ledger(track_visit)` の専用 importer を作った
- staging `v0-full-20260412c` では `trackVisits=42 / trackPoints=5539` も同じ import version に載せて full parity を取り、`track_visit.imported=42 / track_points.imported=5539` まで一致を確認した
- `importObservationEvidence.ts` の `asset_ledger.asset_id` FK バグは修正済み
- [reportLegacyDrift.ts](/E:/Projects/Playground/platform_v2/src/scripts/reportLegacyDrift.ts) を追加し、`latest parity / delta sync freshness / sync cursor freshness / recent verify history` を 1 レポートで見られるようにした
- staging `report:legacy-drift -- --history=5 --stale-hours=24` では `status=healthy / latestImportVersion=v0-full-20260412c` を返し、最新 full parity と delta sync freshness を同時に確認できた
- partial sample import version の verify fail は `sample lane` だけを流した時の expected mismatch として履歴上で切り分けられる
- [run_legacy_drift_report.sh](/E:/Projects/Playground/platform_v2/scripts/ops/run_legacy_drift_report.sh) を追加し、staging では root crontab `15 * * * *` から 1 時間ごとに drift report を回す設定まで入れた
- wrapper は root 実行時に `sudo -u postgres` へ落として socket peer auth を壊さない
- `src/services/readiness.ts` は最新 `legacy_drift_report` を `/ops/readiness` に載せるようになり、運用面では readiness と drift health を同じ API で見られる

判定:

- `DONE`

### Gate 4. v2 product parity ready

定義:

- v2 staging で主要導線が production-like に end-to-end で通る

受け入れ条件:

- login / logout
- home
- record / quick capture
- explore
- observation detail
- profile / my places
- photo upload
- track upload

現在地:

- 現行 PHP の staging parity は進んだ
- Fastify の staging lane は `:3200` で起動中
- [smokeV2Lane.ts](/E:/Projects/Playground/platform_v2/src/scripts/smokeV2Lane.ts) を追加し、`/`, `/healthz`, `/readyz`, `/ops/readiness` の read-only smoke を固定した
- staging 実行 `npm run smoke:v2-lane -- --base-url=http://127.0.0.1:3200` で `passed` を確認した
- `/ops/readiness` は `latestDriftReport.summary` まで返すので、lane health と data plane health を同時に見られる
- [read.ts](/E:/Projects/Playground/platform_v2/src/routes/read.ts) と [readModels.ts](/E:/Projects/Playground/platform_v2/src/services/readModels.ts) を追加し、`/home`, `/observations/:id`, `/profile/:userId` の minimal read lane を v2 に生やした
- [smokeV2ReadLane.ts](/E:/Projects/Playground/platform_v2/src/scripts/smokeV2ReadLane.ts) を追加し、user-facing read shell を DB 実データ起点で確認できるようにした
- [smokeV2WriteLane.ts](/E:/Projects/Playground/platform_v2/src/scripts/smokeV2WriteLane.ts) を追加し、`/api/v1/users/upsert -> /api/v1/observations/upsert -> /api/v1/tracks/upsert` の最小 write smoke を固定した
- その後 `remember token issue / revoke` も smoke に追加し、`login / logout` の最小代替まで同じ fixture で確認できるようにした
- [observationPhotoUpload.ts](/E:/Projects/Playground/platform_v2/src/services/observationPhotoUpload.ts) と [write.ts](/E:/Projects/Playground/platform_v2/src/routes/write.ts) で `/api/v1/observations/:id/photos/upload` を追加し、`asset_blobs / evidence_assets / compatibility write` まで通る最小 photo upload lane を v2 に生やした
- `smokeV2WriteLane.ts` は `observations/photos/upload` を fixture に含めるようになり、write lane smoke で photo upload も同時検証できる
- [authSession.ts](/E:/Projects/Playground/platform_v2/src/services/authSession.ts) と [write.ts](/E:/Projects/Playground/platform_v2/src/routes/write.ts) で `auth/session/issue`, `auth/session`, `auth/session/logout` を追加し、`remember_tokens` を再利用した cookie-based session lane を v2 に生やした
- [read.ts](/E:/Projects/Playground/platform_v2/src/routes/read.ts) は `/home` と `/profile` が session cookie fallback で開けるようになった
- [read.ts](/E:/Projects/Playground/platform_v2/src/routes/read.ts) に `/record` を追加し、session cookie または `?userId=...` で開ける minimal quick capture shell を v2 に生やした
- `smokeV2WriteLane.ts` は session issue/current/logout も fixture に含めるようになり、auth session 本体を same-lane で検証できる
- local `npm run typecheck` は photo upload lane 追加後も通過した
- staging 実行 `npm run smoke:v2-write-lane -- --base-url=http://127.0.0.1:3200 --fixture-prefix=staging-write-smoke-20260412b` で `users/upsert`, `auth/remember-tokens/issue`, `observations/upsert`, `tracks/upsert`, `auth/remember-tokens/revoke` の全件 `passed` を確認し、`compatibility.attempted=true / succeeded=true` まで見た
- staging 実行 `npm run smoke:v2-write-lane -- --base-url=http://127.0.0.1:3200 --fixture-prefix=staging-session-smoke-20260412c` では `auth/session/issue`, `auth/session/current`, `auth/session/logout` を含む全 9 checks が `passed` し、`compatibility.attempted=true / succeeded=true` まで確認した
- staging 実行 `npx tsx src/scripts/smokeV2ReadLane.ts -- --base-url=http://127.0.0.1:3200` では `record`, `explore`, `home`, `observation detail`, `profile` の全 5 checks が `passed` した
- つまり v2 staging lane は read-only ではなく、`record + explore + user-facing read lane + minimal read-write lane + login/logout 代替 lane + photo upload lane + auth session lane` まで staging 実測で通った

判定:

- `DONE`

### Gate 5. Production shadow sync ready

定義:

- 本番 legacy を主系にしたまま v2 へ継続同期できる

受け入れ条件:

- delta sync daemon が安定稼働する
- drift report が見える
- sample pages / sample API parity を定期検証できる
- cutover rehearsal を staging で成功させている

現在地:

- [syncLegacyDelta.ts](/E:/Projects/Playground/platform_v2/src/scripts/syncLegacyDelta.ts) があり、legacy mtime を cursor にした `delta_sync` 実行と `migration_runs / sync_cursors` 更新まで通る
- [run_shadow_sync.sh](/E:/Projects/Playground/platform_v2/scripts/ops/run_shadow_sync.sh) は `source_name / legacy-data-root / uploads-root / public-root` を env で切り替えられるようになり、staging / production shadow の共通入口になった
- [bootstrap_shadow_db.sh](/E:/Projects/Playground/platform_v2/scripts/ops/bootstrap_shadow_db.sh) を追加し、`ikimon_v2_staging` の schema を `ikimon_v2_shadow` へ複製できるようにした
- [pull_production_legacy_mirror.sh](/E:/Projects/Playground/platform_v2/scripts/ops/pull_production_legacy_mirror.sh) を追加し、Onamae production の `ikimon.life/data` と `ikimon.life/public_html/uploads` を VPS mirror へ rsync できるようにした
- [run_production_shadow_sync_only.sh](/E:/Projects/Playground/platform_v2/scripts/ops/run_production_shadow_sync_only.sh) と [run_production_shadow_cycle.sh](/E:/Projects/Playground/platform_v2/scripts/ops/run_production_shadow_cycle.sh) を追加し、`pull -> delta sync` と `pull -> delta sync -> drift report` を分けた
- [verifyProductionShadowParity.ts](/E:/Projects/Playground/platform_v2/src/scripts/verifyProductionShadowParity.ts) と [run_production_shadow_verify.sh](/E:/Projects/Playground/platform_v2/scripts/ops/run_production_shadow_verify.sh) を追加し、`ikimon_v2_shadow` の live tables と production mirror の count/checksum parity を `verify_legacy_parity` run として記録できるようにした
- VPS 実行 `bash scripts/ops/bootstrap_shadow_db.sh` で `ikimon_v2_shadow` を初期化し、production shadow 用の専用 DB を staging と分離した
- VPS 実行 `bash scripts/ops/run_production_shadow_cycle.sh` で production mirror pull と `source_name=production_legacy_fs` の one-off shadow sync が成功し、`users=102`, `visits=238`, `occurrences=233`, `evidence_assets=230`, `remember_tokens=61`, `visit_track_points=680` を `ikimon_v2_shadow` に取り込んだ
- VPS 実行 `bash scripts/ops/run_production_shadow_sync_only.sh` の再実行では `status=skipped` を確認し、mtime cursor ベースの再実行安全性も見た
- VPS 実行 `npm run verify:production-shadow ... --import-version=production_shadow_live` で `observations=233 / rememberTokens=61 / trackVisits=5 / trackPoints=680 / identifications=199 / evidenceAssets=228 / checksum mismatch=0` を確認した
- VPS 実行 `bash scripts/ops/run_production_shadow_cycle.sh` では `summary.status=healthy / parityClean=true / deltaHealthy=true / deltaFresh=true / cursorFresh=true` まで確認した
- root crontab に `20 * * * * ... run_production_shadow_cycle.sh` を追加し、production shadow sync + verify + drift report を hourly で常時実行に載せた
- drift report はすでに hourly 実行済みなので、shadow sync と組み合わせる基礎監視面はある
- [run_v2_sample_cadence.sh](/E:/Projects/Playground/platform_v2/scripts/ops/run_v2_sample_cadence.sh) を追加し、`smoke:v2-lane -> smoke:v2-read-lane -> smoke:v2-write-lane` を staging `:3200` に対して 1 コマンドで回せるようにした
- VPS 実行 `bash scripts/ops/run_v2_sample_cadence.sh` で sample page / sample API cadence の manual run を通し、`record / explore / home / observation detail / profile` と最小 write lane の両方が `passed` することを確認した
- root crontab に `35 * * * * ... run_v2_sample_cadence.sh` を追加し、sample page / sample API cadence も hourly 常時実行へ載せた

判定:

- `DONE`

### Gate 6. Rollback and day-0 operations ready

定義:

- 切替しても数分で戻せる

受け入れ条件:

- `S-24h`, `S-15m`, `S-final` snapshot 手順が固定
- fast rollback rehearsal 済み
- nginx switch / rollback script がある
- dual-write compatibility が同期成功を返す
- cutover 当日の smoke test が固定されている

現在地:

- master plan に要件はある
- [rehearseCutover.ts](/E:/Projects/Playground/platform_v2/src/scripts/rehearseCutover.ts) は `sync -> verify -> read smoke -> write smoke -> readiness` を連続実行できる
- [run_cutover_rehearsal.sh](/E:/Projects/Playground/platform_v2/scripts/ops/run_cutover_rehearsal.sh) を追加し、staging rehearsal の repo 入口を固定した
- [snapshot_cutover_state.sh](/E:/Projects/Playground/platform_v2/scripts/ops/snapshot_cutover_state.sh) を追加し、`S-24h / S-15m / S-final` の snapshot を `nginx config + crontab + v2 health + ikimon_v2_shadow dump` として残せるようにした
- [switch_public_nginx_to_v2.sh](/E:/Projects/Playground/platform_v2/scripts/ops/switch_public_nginx_to_v2.sh) と [rollback_public_nginx_to_legacy.sh](/E:/Projects/Playground/platform_v2/scripts/ops/rollback_public_nginx_to_legacy.sh) を追加し、`ikimon.life` の live nginx config を v2 candidate と legacy snapshot の間で切り替えられるようにした
- [ikimon.life-v2-cutover.conf](/E:/Projects/Playground/platform_v2/ops/nginx/ikimon.life-v2-cutover.conf) を追加し、public domain の v2 proxy candidate を repo 管理に置いた
- [run_day0_public_smoke.sh](/E:/Projects/Playground/platform_v2/scripts/ops/run_day0_public_smoke.sh) を追加し、cutover 後の public smoke を `https://ikimon.life` 向けに 1 コマンド化した
- [ikimon_v2_day0_runbook_2026-04-12.md](/E:/Projects/Playground/docs/architecture/ikimon_v2_day0_runbook_2026-04-12.md) を追加し、`T-24h / T-15m / T-0 / T+5m / rollback` の実行順を固定した
- VPS 実行 `bash scripts/ops/snapshot_cutover_state.sh rehearsal-20260412a` で cutover snapshot を作成した
- VPS 実行 `bash scripts/ops/switch_public_nginx_to_v2.sh --dry-run --label=dryrun-20260412a` で live file 置換込みの `nginx -t` dry-run を通した
- VPS 実行 `bash scripts/ops/rollback_public_nginx_to_legacy.sh /var/www/ikimon.life-staging/cutover-snapshots/rehearsal-20260412a` で legacy config restore と nginx reload を確認した

判定:

- `IN PROGRESS`

---

## 4. Go / No-Go scorecard

2026-04-12 時点の暫定判定:

| Gate | 状態 | 意味 |
|---|---|---|
| 1. Scope freeze | DONE | critical write surface / physical target / inventory CLI check が固定された |
| 2. Canonical contract freeze | DONE | create/update path / workflow boundary / destructive migration guard まで揃った |
| 3. v2 data plane ready | DONE | schema / planner / full parity / drift report / hourly staging run / readiness integration まで揃った |
| 4. v2 product parity ready | DONE | record / explore / home / observation detail / profile / session / photo upload / track upload の最小 lane が staging 実測で通った |
| 5. Production shadow sync ready | DONE | production shadow cycle と sample page / sample API cadence の両方が hourly で回る状態まで固定した |
| 6. Rollback operations ready | IN PROGRESS | snapshot / switch / rollback / day-0 smoke / runbook は揃った。残件は live public rehearsal の実施判断だけ |

結論:

- `live cutover`: **No-Go**
- `production rehearsal`: **Go**  
  参照: [ikimon_v2_production_rehearsal_decision_2026-04-12.md](/E:/Projects/Playground/docs/architecture/ikimon_v2_production_rehearsal_decision_2026-04-12.md)
- release QA は [ikimon_v2_release_qa_matrix_2026-04-13.md](/E:/Projects/Playground/docs/architecture/ikimon_v2_release_qa_matrix_2026-04-13.md) に従う  
  `ページ単体確認` ではなく、`surface × state × transition × failure mode × environment` の MECE 監査を通した時だけ release を議論する
- staging edge の現況は [ikimon_v2_staging_edge_release_audit_2026-04-13.md](/E:/Projects/Playground/docs/architecture/ikimon_v2_staging_edge_release_audit_2026-04-13.md) に固定した  
  2026-04-13 時点では `T1`, `T6`, `F1` が通過し、残件は `人手 write transition` と `mobile QA`

---

## 5. 切替条件が整うまでの実装順

順番を変えない。

1. Gate 1 を `DONE`
2. Gate 2 を `DONE`
3. Gate 3 を `DONE`
4. Gate 4 の v2 staging lane を立てる
5. Gate 5 の shadow sync を回す
6. Gate 6 の rollback rehearsal を通す
7. 6 gate 全通過後にだけ cutover 日程を切る

理由:

- `product parity` より前に `data plane` がないと切替は議論不能
- `rollback` がない cutover は論外

---

## 6. 今期の Definition of Done

このセッション群で「切替条件を整える」と言えるのは、少なくとも次まで。

### DoD-A. 現行 lane を整理する

- public surface 改装を継続
- multilingual parity を維持
- critical write surface の増減を inventory に反映

### DoD-B. Canonical 契約を固定する

- `place / visit / observation / evidence / condition / follow` の保存契約表を作る
- JSON only state を増やさない
- divergence check の入口を作る

### DoD-C. v2 着手条件を作る

- PostgreSQL schema たたき台
- importer responsibility 分割
- asset ledger 項目固定
- legacy path -> canonical path mapping 表

ここまでで初めて、`v2 実装に入ってよい` 状態になる。

---

## 7. 切替判断を誤らないための禁止事項

- public surface が揺れている段階で v2 UI を作り込み始める
- legacy write inventory を更新せずに新 write path を増やす
- divergence check なしで canonical write を広げる
- rollback rehearsal なしで cutover 日を決める
- `PHP をやめる予定` を理由に、現行売上導線や公開面改善を止める

---

## 8. 直近 3 スプリントの実務計画

### Sprint 1

- front surface の place-first 改装を続ける
- `legacy_write_inventory` をコード起点で再監査する
- canonical 契約表の初版を作る
- divergence minimum spec を固定する

### Sprint 2

- divergence check CLI の最小版を作る
- asset path の実態調査を終える
- v2 schema / ledger のたたき台を作る

補足:

- divergence CLI 最小版は着手済み
- auth/business の mapping 比較と asset path mapping 表は着手済み
- `place / visit mapping` も CLI に入った
- orphan canonical の原因切り分けは完了
- local residue cleanup と local PASS までは到達
- staging `ikimon_v2_staging` では sample importer 実証まで進み、次は checksum/count parity と asset/track/auth の import 範囲拡張が本筋

### Sprint 3

- bootstrap importer の skeleton を作る
- sample snapshot で import rehearsal を始める
- v2 staging lane の infra 前提を固める

---

## 9. この文書の使い方

- `今やるべき作業の優先順位` で迷ったら本書を見る
- `それは PHP でやるか v2 でやるか` を切り分ける時に本書を見る
- cutover を口にする時は、必ず gate 状態を先に更新する

この文書を更新せずに「そろそろ切り替えられる」は言わない。
