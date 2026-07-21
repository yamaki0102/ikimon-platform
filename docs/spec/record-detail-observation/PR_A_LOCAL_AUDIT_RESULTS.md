# PR-A local audit results

## Decision

Status: `PR_A_SOURCE_CLOSEOUT_IN_PROGRESS`

The clean-checkout inventory, aggregate production D1 baseline and migration-ordering review are complete. This branch repairs the remaining source-level privacy and documentation-freshness defects. PR-A is not complete until this exact fix reaches staging and rendered/API privacy verification reports zero record-scoped location keys.

No staging or production database mutation was performed by this audit.

## Audited source

- audit date: 2026-07-22 JST
- exact source: `origin/main@c6fd11f8f63f3a329c3b660ea9b89ae0186caeaa`
- worktree: isolated worktree created from the exact source
- initial status: clean; `HEAD` matched `origin/main`
- PR-B: #1381, additive schema only
- PR-C: #1382, stacked and not eligible before PR-B merge

## Gate results

| Gate | Result | Evidence |
|---|---|---|
| clean checkout | PASS | isolated worktree; exact SHA matched |
| PostgreSQL migration ordering | PASS | runner sorts and ledgers complete filenames plus checksum; repeated numeric prefixes are deterministic, not collisions |
| D1 migration ordering | PASS | Wrangler ledgers complete migration filenames; repeated numeric prefixes are deterministic |
| historical data-changing migrations | PASS WITH CLASSIFICATION | PostgreSQL historical normalization remains checksum-stable; all four flagged D1 migrations are already present in production `d1_migrations` |
| new PR-B migrations | PASS | additive only; no rename, delete, reader cutover or backfill |
| writer/read inventory | PASS FOR PR-B BOUNDARY | current PostgreSQL occurrence and D1 observation responsibilities remain compatibility sources until cutover |
| aggregate D1 metrics | PASS | aggregate counts only; no identifiers, coordinates, paths, notes or source payloads returned |
| active lane classification | PASS | #1381/#1382 are current dependencies; stale/diverged lanes are not schema bases and are not automatically closed or rebased |
| independent schema/security review | PASS WITH ADOPTED CHANGES | paired external reviews required same-observation claims, durable lifecycle, complete source identity and human-only promotion constraints; PR-B contains the fixes |
| documentation freshness | FIXED IN THIS BRANCH | validator now uses Git history instead of checkout filesystem mtimes; overview now names the central registry and Cloudflare command bus |
| public record-detail location contract | FIXED IN MAIN BASELINE | exact source no longer returns record-scoped public detail cell fields |
| public map record location contract | FIXED IN THIS BRANCH | aggregate cell features remain; individual observation items and record lookup no longer return `cellId`, mesh or geohash keys |
| rendered staging privacy scan | PENDING | exact fix must be promoted to staging and scanned before `PR_A_COMPLETE` |

## Approved aggregate production D1 baseline

Database: current production observation D1, read-only aggregate queries.

| Metric | Count |
|---|---:|
| records | 687 |
| records with 0 assets | 131 |
| records with 1 asset | 70 |
| records with N assets | 486 |
| AI review targets | 17 |
| synthetic primary AI targets | 17 |
| unresolved targets | 0 |
| identifications | 0 |
| reassessment `standard/completed` | 17 |
| reassessment `standard/failed` | 5 |
| records with rights rows | 676 / 687 |
| external export allowed | 0 |

The current D1 schema cannot represent 0/1/N biological subjects independently of records. This is the confirmed baseline limitation that PR-B addresses; it is not treated as missing evidence.

## Active lane classification

| PR | Classification | Disposition |
|---|---|---|
| #1381 | current PR-B dependency | validate, stage migration, then merge |
| #1382 | current PR-C dependency | rebase only after PR-B merges |
| #1302 | stale/diverged historical lane | do not use as schema base |
| #1293 | historical operations remediation | evidence only |
| #1280, #1228, #1095, #855, #769 | superseded, stale or unrelated to the physical schema | do not close/rebase automatically in PR-A |

## Remaining gate

1. Merge this source closeout.
2. Promote its exact main SHA to staging through the Cloudflare command bus.
3. Scan public record detail, observation compatibility routes, map, feed, API, JSON-LD, URL, media metadata and export preview.
4. Require zero record-scoped `cell`, `mesh`, `geohash` or precise-coordinate leakage.
5. Record `PR_A_COMPLETE` in central Issue #435 before applying PR-B migration.
