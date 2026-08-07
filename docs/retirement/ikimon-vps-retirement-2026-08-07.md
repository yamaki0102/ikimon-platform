# ikimon-vps 退役記録（2026-08-07）

## 境界

- 対象: `ikimon-vps` / `162.43.44.131`（legacy VPS）。
- 現行 production 正本: Cloudflare Worker `ikimon-life-cloudflare-prod`。
- 現行 staging 正本: Cloudflare Worker `ikimon-life-cloudflare-staging`。
- 対象外: 愛管・LENRI等の共有サーバー `i-kan-xserver` / `sv1102.xserver.jp`。この記録は共有サーバーの停止・削除・解約を意味しない。

## 2026-08-07時点の判定

`BLOCKED_VPS_ACTIVE_RUNTIME_AND_DATA_PRESERVATION`

コード上のVPS-stop readiness reportは `blocker_count=0`、P0/P1/P2=0、active fallback call=0まで到達した。一方、実機には現役systemd、cron、PostgreSQL、Docker/RustDesk、Discord bot、BirdNET、Perch、VOICEVOX、IKIMON AI、media/report/curator系のruntimeと大量の固有データが残っている。データ退避先のGoogle Driveは、確認できた接続profileが `g.ikan501@gmail.com` で、規定の `yamaki0102@gmail.com` と一致しないため、backup bytesはまだ作成・移送していない。

## 実装・検証

- 最新 `origin/main`: `4e6e290476b3e9e2e3187a5e1911b366602250ce`。
- Cloudflare-native Kubiaka private record/media、owner scope、notification interlockを実装。
- legacy PostgreSQL Kubiaka modulesはfail-closed/inert化。
- production/staging/shadow configからorigin fallback設定を除去。
- shadow/staging/production deploy guardのhash/statusに`migrations`を含める修正を追加。
- `kubiakaFocusedExperience.ts`、`kubiakaPrivateUploadGuard.ts`、`kubiakaPrivateRecordsReadModel.ts`、`notificationEligibility.ts`を最新main上で再確認し、VPS PostgreSQL経路を実行しない退役契約を固定。
- `npm run test:node`: 1702/1702、Cloudflare Worker tests: 244/244、`npm run typecheck`、`npm run build`、Cloudflare check、quick tests、shadow/staging/production dry-runを通過。
- readiness本体実出力（2026-08-07T09:54:50Z）: `blocker_count=0`、`p0=0`、`p1=0`、`p2=0`、`runtime_pg_dependency_files=0`、`fallback_call_count=0`、`runtime_vps_workflow_files=0`。
- ただし現行公開runtimeは未反映。production SHAは`40418d9b...`、staging SHAは`abeff44f...`で、双方のhealthzに旧`fallbackOriginConfigured=true`、`/kubiaka`は404。今回の変更SHAでのstaging/production反映は未実行。
- 中央deploy registryのmigration laneは現時点で`0067_record_observation_foundation.sql`固定であり、新規`0070_kubiaka_private_record_contract.sql`の承認・反映証跡は未成立。D1 migration applyはhuman gateとして未実行。

## 実機監査の主要残存物

監査artifact `vps-readonly-audit-20260807.txt` と `vps-data-metadata-20260807.txt` を正本証跡とする。主な観測対象は、PostgreSQL cluster、`ikimon-v2-blue/green/staging`、nginx、PHP-FPM、Docker/containerd、RustDesk、PM2 Discord bot、BirdNET、Perch、VOICEVOX、IKIMON AI、intake hub、alert/media/audio/report/curator/timer/cron、uploads/persistent/data/mirrors/backupsである。

## 停止・解約境界

VPSのwrite runtime停止、Cloudflare-only smoke、data backup/restore証跡、本番Cloudflare exact-SHA反映が完了するまで、VPS停止・削除・契約解約は実行しない。旧VPSをorigin fallbackとして戻すこともしない。現時点では停止リハーサル未実行。

## 証跡locator

- readiness: `artifacts/vps-stop-readiness-final-local.txt`
- read-only audit: `artifacts/vps-readonly-audit-20260807.txt`
- data inventory: `artifacts/vps-data-metadata-20260807.txt`
- backup manifest: `artifacts/vps-backup-manifest-20260807.md`
- live Cloudflare/DNS read-back: `artifacts/live-cloudflare-dns-readback-20260807.txt`
- final local readiness: `artifacts/vps-stop-readiness-final-local.txt`
- final Node regression: `artifacts/platform-test-node-final-2.txt`
- final Worker tests/guards: `artifacts/shadow-tests-final.txt`, `artifacts/shadow-dry-run-final.txt`, `artifacts/staging-dry-run-final.txt`, `artifacts/production-dry-run-final.txt`
- sealed security review: `D:/LocalData/Temp/codex-security-scans-7jczXZ/ikimon-platform-origin-main/4e6e290476b3e9e2e3187a5e1911b366602250ce_20260807T090958Z_hbysze9f/report.md`
