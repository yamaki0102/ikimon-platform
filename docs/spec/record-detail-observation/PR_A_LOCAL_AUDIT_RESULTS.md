# PR-A local audit results

## Decision

Status: `PR_A_BLOCKED`

The clean-checkout source audit is materially complete enough to reject the previous `PR_A_COMPLETE` assumption. Schema apply, dual-write, backfill, read cutover and production mutation remain blocked. No production or staging database was queried or mutated in this audit.

## Audited source

- audit date: 2026-07-21 JST
- exact source: `origin/main@c6fd11f8f63f3a329c3b660ea9b89ae0186caeaa`
- worktree: isolated detached worktree created from the exact source
- initial status: clean
- HEAD vs `origin/main`: exact match
- active PR-B source inspected separately: PR #1381 head `96d0c1b65cff4424ff31e4bc3105912fc8dede2d`

## Gate results

| Gate | Result | Evidence |
|---|---|---|
| clean checkout | PASS | clean detached worktree; exact SHA matched |
| PostgreSQL migration inventory | FAIL | 134 files; duplicate numeric prefixes exist (`0018`, `0104`, `0107`, `0109`, `0110`, `0114`, `0117`, `0119`) |
| D1 migration inventory | FAIL | 68 files; duplicate numeric prefixes exist (`0054`, `0062`) |
| destructive historical migration classification | FAIL | 16 migration files contain line-leading `DROP`, `DELETE FROM` or equivalent and need explicit historical/current classification before a complete gate |
| PostgreSQL writer inventory | PARTIAL | 48 matching source/migration/script files; major conflicts are already documented in `PR_A_EVIDENCE_MATRIX.md`, but the per-function matrix is not complete |
| D1 writer inventory | PARTIAL | 60 matching files; route/queue/transaction mapping remains incomplete |
| read-path inventory | PARTIAL | 235 matching files; no complete surface-by-surface matrix yet |
| community/promotion inventory | PARTIAL | 156 matching files; Node AI-vote exclusion is confirmed, full D1 parity remains unproven |
| environment/monitoring inventory | PARTIAL | 50 matching files; canonical monitoring promotion remains unproven |
| privacy source inventory | PARTIAL | 223 matching files; source surface is broad and rendered/API/media/export leak scan has not run |
| active lane/deploy conflict | FAIL | PR #1381/#1382 are draft; production remains `3b38c30...`; `c6fd11...` lacks same-SHA staging sequence; command bus has no migration operation |
| approved aggregate DB metrics | NOT RUN | read-only PostgreSQL/D1 access and aggregate-only procedure were not established |
| independent schema/security review | PASS WITH CHANGES | Claude Opus 4.8 and Gemini 3 Flash Preview reviewed the design; evidence is under `operations/ai_os/external_review_evidence/2026-07/ikimon-record-observation-prb-20260721/` |

## Repository validator results on exact main

| Command | Result |
|---|---|
| `scripts/check_knowledge_os_overview_sync.ps1` | FAIL: overview older than watched sources |
| `scripts/check_deploy_guardrails.ps1` | PASS |
| `scripts/check_legacy_entrypoint_reason.ps1` | PASS |
| `scripts/check_platform_migration_guardrails.ps1` | PASS for unchanged baseline |
| `scripts/check_deploy_manifest_sync.ps1` | PASS |
| `npm ci` for Node and Cloudflare runtimes | PASS; audit reported 0 vulnerabilities in both dependency trees |

## Confirmed blockers

### P0

1. Rendered HTML/API/JSON-LD/map/feed/media metadata/export privacy verification has not proven protected-location leakage is zero.
2. No bounded, separately approved D1 migration operation exists in the Cloudflare command bus. Routine deploy must not be used as a migration surrogate.
3. PR #1381 as opened did not enforce same-observation accepted claims, durable lifecycle retention, complete source identity or human-provenance promotion at the database boundary. A local corrective implementation exists but is not yet merged or applied.

### P1

1. Historical duplicate migration numbers and destructive statements need explicit classification or a validated ordered-manifest rule.
2. The clean-checkout writer/read/privacy matrices remain incomplete at function and public-surface level.
3. Approved aggregate row-shape metrics for 0/1/N subjects, AI-only rows, media shape and ambiguity candidates are unavailable.
4. The knowledge overview freshness validator fails on exact main.
5. Production deploy attempts #466/#467/#474 have no terminal evidence and target a SHA without the required same-SHA staging sequence.

## Safe next boundary

PR-B migration code may be repaired and tested locally because it is additive and not applied. It must not be merged or applied until the final schema is independently reviewed, migration numbering/ordering is resolved, current baseline gates are green, and an approved bounded migration lane exists.
