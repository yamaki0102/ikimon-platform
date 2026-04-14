# ikimon v2 Day-0 Runbook

更新日: 2026-04-12

## 目的

- public traffic を legacy PHP から v2 lane へ切り替える
- 数分で rollback できる状態を保つ

## 前提

- production shadow cycle が `healthy`
- `https://ikimon.life` の live nginx config は legacy PHP のまま
- v2 app は `127.0.0.1:3200` で稼働中
- `ikimon_v2_shadow` が cutover target DB

## 使う script

- `scripts/ops/snapshot_cutover_state.sh`
- `scripts/ops/switch_public_nginx_to_v2.sh`
- `scripts/ops/rollback_public_nginx_to_legacy.sh`
- `scripts/ops/run_day0_public_smoke.sh`
- `scripts/ops/run_production_shadow_cycle.sh`

## T-24h

1. `bash scripts/ops/snapshot_cutover_state.sh S-24h`
2. `bash scripts/ops/switch_public_nginx_to_v2.sh --dry-run --label=dryrun-S-24h`
3. `bash scripts/ops/rollback_public_nginx_to_legacy.sh /var/www/ikimon.life-staging/cutover-snapshots/S-24h`
4. `bash scripts/ops/run_production_shadow_cycle.sh`

完了条件:

- snapshot が作られる
- nginx candidate dry-run が通る
- rollback script が current legacy config を復元できる
- production shadow cycle が `healthy`

## T-15m

1. `bash scripts/ops/snapshot_cutover_state.sh S-15m`
2. `bash scripts/ops/run_production_shadow_cycle.sh`
3. `/ops/readiness` と `shadow-production-sync.log` を確認

完了条件:

- latest drift report が `healthy`
- latest verify が `production_shadow_live`
- latest delta sync が `succeeded` か `skipped`

## T-2m

1. queue lag を確認
2. `curl -fsS http://127.0.0.1:3200/healthz`
3. `curl -fsS http://127.0.0.1:3200/readyz`

## T-0

1. `bash scripts/ops/snapshot_cutover_state.sh S-final`
2. `bash scripts/ops/run_production_shadow_cycle.sh`
3. `bash scripts/ops/switch_public_nginx_to_v2.sh --label=cutover-T0`
4. `bash scripts/ops/run_day0_public_smoke.sh`

完了条件:

- `switch_public_nginx_to_v2.sh` が snapshot path を返す
- public smoke が全部通る

## T+5m

- `curl -fsS https://ikimon.life/healthz`
- `curl -fsS https://ikimon.life/readyz`
- `curl -fsS https://ikimon.life/ops/readiness`
- `tail -n 100 /var/www/ikimon.life-staging/repo/platform_v2/shadow-production-sync.log`

## Rollback 条件

以下のどれか 1 つで rollback:

- public smoke fail
- login / session issue fail
- photo upload fail
- `ops/readiness` が `near_ready` 以外
- nginx reload 後 5 分以内に major 5xx

## Fast Rollback

1. `bash scripts/ops/rollback_public_nginx_to_legacy.sh /var/www/ikimon.life-staging/cutover-snapshots/S-final`
2. `curl -fsS https://ikimon.life/`
3. `curl -fsS https://ikimon.life/deploy` は確認不要
4. incident log に時刻と reason を残す

## 監視ポイント

- `/var/www/ikimon.life-staging/repo/platform_v2/shadow-production-sync.log`
- `/var/log/ikimon/legacy_drift_report.log`
- `https://ikimon.life/ops/readiness`
- `nginx -t`
