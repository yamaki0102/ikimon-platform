# Cloudflare Production Lane Readiness - 2026-06-16

Status: `fail`
Mode: `Empty`

Generated: 2026-06-28 09:31:35 +09:00

This is read-only against Cloudflare D1/R2/Worker and does not touch public DNS, routes, maintenance mode, the current VPS database, or provider settings.

## Summary

- Worker: https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev
- Observation D1: ikimon_prod_observations_2026_06
- R2 bucket: ikimon-prod-media
- Delta supplement root: E:\Projects\_agent_scratch\ikimon-platform\cloudflare-snapshot-delta-20260616\delta_20260628_003348
- R2 object count: 4592
- R2 bucket size bytes: 3210000000
- R2 measurement source: wrangler r2 bucket info
- R2 verified import ledger objects: 1957
- R2 verified import ledger bytes: 2338615654
- R2 public route proof boundary: when the measurement source is the D1 ledger fallback, this report proves imported-state continuity only. It does not replace per-object/list verification before media-dependent public route promotion.

## D1 Counts

| Table | Count |
|---|---:|
| production_import_users | 1931 |
| production_import_visits | 659 |
| production_import_occurrences | 1332 |
| production_import_asset_blobs | 5251 |
| production_import_evidence_assets | 2032 |
| production_import_public_readmodel | 588 |
| legacy_r2_import_ledger | 1957 |
| legacy_asset_import_ledger | 81 |
| legacy_stream_inventory | 35 |
| production_restore_parity_runs | 1 |
| production_restore_parity_metrics | 210 |

## Checks

| Check | Result | Detail |
|---|---:|---|
| d1 count production_import_users | fail | actual=1931 expected=0 mode=Empty |
| d1 count production_import_visits | fail | actual=659 expected=0 mode=Empty |
| d1 count production_import_occurrences | fail | actual=1332 expected=0 mode=Empty |
| d1 count production_import_asset_blobs | fail | actual=5251 expected=0 mode=Empty |
| d1 count production_import_evidence_assets | fail | actual=2032 expected=0 mode=Empty |
| d1 count production_import_public_readmodel | fail | actual=588 expected=0 mode=Empty |
| d1 count legacy_r2_import_ledger | fail | actual=1957 expected=0 mode=Empty |
| d1 count legacy_asset_import_ledger | fail | actual=81 expected=0 mode=Empty |
| d1 count legacy_stream_inventory | fail | actual=35 expected=0 mode=Empty |
| d1 count production_restore_parity_runs | fail | actual=1 expected=0 mode=Empty |
| d1 count production_restore_parity_metrics | fail | actual=210 expected=0 mode=Empty |
| r2 bucket object_count | fail | actual=4592 expected=0 |
| r2 bucket size | fail | actual=3210000000 expected=0 |
| worker health | pass | status=200 content={"ok":true,"environment":"production"} |
| shadow smoke closed in production | pass | status=404 content= |
| internal route closed in production | pass | status=404 content= |

## Meaning

The production lane is still empty and safe for the next approved import phase. This proves no production snapshot has been imported yet.
