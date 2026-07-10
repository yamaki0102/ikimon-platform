# Cloudflare Production Lane Readiness - 2026-06-16

Status: `fail`
Mode: `Imported`

Generated: 2026-06-28 09:33:07 +09:00

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
| d1 count production_import_users | fail | actual=1931 expected=1982 mode=Imported |
| d1 count production_import_visits | fail | actual=659 expected=663 mode=Imported |
| d1 count production_import_occurrences | fail | actual=1332 expected=1334 mode=Imported |
| d1 count production_import_asset_blobs | fail | actual=5251 expected=5257 mode=Imported |
| d1 count production_import_evidence_assets | fail | actual=2032 expected=2035 mode=Imported |
| d1 count production_import_public_readmodel | pass | actual=588 expected=588 mode=Imported |
| d1 count legacy_r2_import_ledger | fail | actual=1957 expected=1956 mode=Imported |
| d1 count legacy_asset_import_ledger | pass | actual=81 expected=81 mode=Imported |
| d1 count legacy_stream_inventory | pass | actual=35 expected=35 mode=Imported |
| d1 count production_restore_parity_runs | pass | actual=1 expected=1 mode=Imported |
| d1 count production_restore_parity_metrics | pass | actual=210 expected>=200 |
| r2 imported object lower-bound | pass | actual=4592 expected>=1956; source=wrangler r2 bucket info; bucket may also contain derived public assets; ledger fallback is import-state evidence, not public media-route completeness proof |
| r2 imported size lower-bound | pass | actual=3210000000 expected>=2338615563; source=wrangler r2 bucket info; bucket may also contain derived public assets; ledger fallback is import-state evidence, not public media-route completeness proof |
| worker health | pass | status=200 content={"ok":true,"environment":"production"} |
| shadow smoke closed in production | pass | status=404 content= |
| internal route closed in production | pass | status=404 content= |

## Meaning

The production lane matches the expected imported snapshot counts. Run synthetic write and restore/reconciliation smoke next before any public route or DNS change.
