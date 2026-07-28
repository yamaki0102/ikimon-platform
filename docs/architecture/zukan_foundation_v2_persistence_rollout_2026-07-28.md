# ZUKAN Foundation v2 永続化・migration rollout

- 日付: 2026-07-28
- strategy foundation: `yamaki0102/ikimon-business-strategy@05f73759375e06c70f60de65960b9d2b59ee6680`
- implementation contract: `yamaki0102/ikimon-platform@4cca5d9fb13274d07e89ee0cb825a32584e44503`
- executable memory fixture: `yamaki0102/ikimon-platform@5c8933a711343d22966308cf32ebd3e0828e8440`
- state: expand migrations implemented / remote application requires exact-SHA evidence

## 1. Purpose

Foundation v2の後付けしにくい契約を、PostgreSQL canonical storeとCloudflare D1 compatibility/runtime storeへadditiveに永続化する。

この変更は既存Record、Observation、Place Atlas、Source Registryを置換しない。新規Foundation tableへ既存データを自動backfillせず、既存runtime writerも切り替えない。空の永続構造とDB invariant、repository adapter、dry-run、無効化済みrollout controlまでを実装し、runtime配線、dual-write有効化、shadow-read有効化は後続のapproval-bound変更に分離する。

## 2. Migrations

### PostgreSQL

1. `0134_zukan_foundation_v2_source_identity.sql`
2. `0135_zukan_foundation_v2_predicate_claims.sql`
3. `0136_zukan_foundation_v2_authority_resolution.sql`
4. `0137_zukan_foundation_v2_governance_rights.sql`
5. `0138_zukan_foundation_v2_disputes_coverage.sql`
6. `0139_zukan_foundation_v2_integrity_hardening.sql`

PostgreSQL migration runnerは各ファイルを独立transactionとして適用し、`schema_migrations`へchecksumを記録する。

### Cloudflare D1 CORE_DB

1. `0009_zukan_foundation_v2_source_identity.sql`
2. `0010_zukan_foundation_v2_predicate_claims.sql`
3. `0011_zukan_foundation_v2_authority_resolution.sql`
4. `0012_zukan_foundation_v2_governance_rights.sql`
5. `0013_zukan_foundation_v2_disputes_coverage.sql`
6. `0014_zukan_foundation_v2_integrity_hardening.sql`

D1 migrationはroutine deployから分離し、approval-bound `migrate` actionで適用する。

## 3. Frozen invariants represented in DB

- opaque `SubjectIdentity` and non-reusable `PublicIdentifier`
- physical merge禁止、time-bounded membership/canonical assertions
- immutable Predicate definitions per `(predicate_uri, predicate_version)`
- append-only Claim revisions with monotonic `recorded_sequence`
- immutable ResolutionRun, candidate decision rows, ProjectionSnapshot and PublicationEdition
- a ResolutionRun candidate set is sealed when its ProjectionSnapshot is inserted; ProjectionEntry rows are sealed when a PublicationEdition references their snapshot
- exact claim-store sequence watermark and recorded-time watermark
- versioned trust anchors, authority assertions and prospective/retroactive revocation events
- suppress/redact/erase impact events without rewriting immutable manifests
- rights `unknown` as first-class state; public use is not granted by absence of a decision
- SurveyEvent / DetectionOutcome and CoverageAssessment separation
- DisputeCase, CorrectionRequest and SuppressionRequest event histories

PostgreSQL locks the same ResolutionRun or ProjectionSnapshot parent row on both
the child-insert and seal-insert paths, preventing READ COMMITTED write-skew.
D1 relies on its serialized writer and fail-closed seal triggers.

## 4. Erase semantics

`erase` may physically delete the underlying object bytes and secret locator. The immutable snapshot still references a stable `ValueArtifact` identifier, so the metadata row becomes a non-value tombstone:

- payload fields and content digest cleared
- storage locator cleared
- `availability_status = 'erased'`
- `redacted_at` is set once and never replaced
- governance event and affected Snapshot/Publication event appended
- replay reports `reproducibility = degraded` and identifies missing fields

ValueArtifact identity and ordinary payload are immutable even before they are
referenced. The only row mutation is `available → redacted/erased`, followed
optionally by `redacted → erased`, with payload, digest and locator remaining
NULL. ValueArtifact rows are never deleted.

The immutable publication manifest is not edited after issue.

## 5. Validation

Before remote migration:

- PostgreSQL migration source contracts are green
- fresh in-memory D1 chain applies 0009–0014
- database-backed fixture #16–#24 passes
- migration baseline advances to 142 files, head 0139
- no existing table is dropped, renamed or rewritten
- no production or staging data is backfilled

After staging migration:

- exact merged SHA and per-file SHA-256 recorded
- pre-apply pending list contains only the intended Foundation files
- recovery bookmark / backup evidence captured
- post-apply pending list empty for the selected migration group
- foreign key check passes
- table/index/trigger inventory matches the contract
- fixture adapter runs against staging-safe isolated rows or a disposable rehearsal DB

## 6. Rollback

The operational rollback is forward-only:

1. disable Foundation v2 writers/readers by feature flag;
2. retain tables and audit history;
3. restore D1 from the pre-apply Time Travel bookmark only if migration itself corrupts the database;
4. restore PostgreSQL from the pre-apply backup only if transactional migration safety is insufficient;
5. do not add a destructive reverse migration that drops audit-bearing tables after real data exists.

## 7. Implementation sequence

1. PostgreSQL and D1 repository adapters, Source Registry dry-run/diff/idempotency, and disabled rollout controls are implemented in source.
2. The dry-run CLI reproduces a canonical manifest, diff and SHA-256 without database access or writes.
3. Apply and verify the hardening migrations before enabling either adapter writer.
4. Add ResolutionRun and public-ID read APIs only behind a disabled feature flag.
5. Collect shadow-read evidence before any bounded dual-write activation; backfill and public projection remain later gates.

## 8. Adapter activation order

The repository adapters and rollout controls are present, but no public route or current Source Registry response is cut over by this change. Activation is forward-only and must follow this order:

### Current wiring boundary

The PostgreSQL and D1 repository adapter implementations exist in source.
However, `runBoundedFoundationDualWrite` is not called by the server, Worker,
admin operation, or CLI, and neither runtime constructs adapter instances. No
concrete durable audit sink or runtime callsite is wired. Therefore changing
the flags cannot activate a Foundation write in the current code: activation
is not yet possible. A later approval-bound change must add a private operator
entrypoint, construct PostgreSQL and D1 repository instances, bind a durable
audit sink, pass one stable idempotency key to both, and preserve kill-switch,
tenant/operation allowlists, bounded entity count, per-dialect receipts, and
retry of a one-dialect partial result.

The current CLI is intentionally dry-run only. A future private apply CLI is
acceptable only after the runtime wiring above exists; it must require an
explicit full source SHA, tenant, idempotency key and confirmation, refuse
public routing, and retry with the same key after a partial outcome.

1. keep `ZUKAN_FOUNDATION_V2_SHADOW_READ_MODE=off`, `ZUKAN_FOUNDATION_V2_DUAL_WRITE_MODE=off`, and `ZUKAN_FOUNDATION_V2_WRITE_KILL_SWITCH=on`;
2. apply exactly the ledger-pending set through separate approval-bound
   migration operations (currently PostgreSQL `0134`–`0139` and D1 CORE_DB
   `0009`–`0014`); never reapply a file already recorded as applied;
3. verify the watermark, tombstone, PublicIdentifier, ContentObject and predicate-version guards, plus `zukan_foundation_v2_write_receipts`;
4. run the Source Registry import twice in dry-run mode and require an identical payload SHA-256 with the second diff fully unchanged;
5. enable shadow read only for an explicit tenant and compare count plus digest while the existing response remains canonical;
6. after shadow evidence is green, explicitly allowlist `source_registry_import_v1`, one tenant and a bounded entity count, then turn the kill switch off and dual-write on for the approved operation;
7. reuse the same idempotency key when retrying a partial cross-dialect outcome; do not generate a replacement key;
8. on any mismatch, turn dual-write and shadow read off, turn the kill switch on, retain audit receipts and investigate before retry.

Reproducible dry-run Evidence:

`npm --prefix platform_v2 run --silent plan:zukan-foundation-source-import -- --source-sha=<40-character-merged-sha>`

The command reads only the checked-in Source Registry, uses an empty existing-state projection, runs the same plan twice, and writes one canonical JSON document to stdout. `--apply`, write, execute and database arguments are rejected.
When `--source-sha` is supplied, it must equal the actual Git `HEAD` and the
entire worktree (including untracked files) must be clean; otherwise the
command refuses to emit exact-SHA evidence. An uncommitted implementation may
run without `--source-sha`, but that output is marked `not_requested` rather
than exact merged-SHA evidence.

When `--tenant` is omitted, the planner uses
`zukan-regional-source-dry-run`. This is a synthetic evidence namespace, is
not present in any writer allowlist, and must never be reused as an activation
tenant. Any future private apply command must require an explicit tenant.

Unknown configuration values fail closed. Empty tenant/operation allowlists authorize nothing. PostgreSQL and D1 transactions are individually atomic; there is no distributed transaction, so the receipt and stable idempotency key are required to recover a one-dialect partial result safely.

## 9. Verified local boundary and remaining remote evidence

The hardening migrations add fail-closed guards for tenant/workspace identity,
claim watermarks, aggregate seals, content fixity, immutable public IDs and
artifacts, workflow/status state machines, inherited rights, authority
revocation, and publication eligibility. PostgreSQL serializes each invariant
on its owning parent/target row; D1 relies on its serialized writer. Legacy
row-level `suppressed` state is rejected during migration because suppression
must be represented by append-only governance and availability events.

Local verification proves migration syntax and semantics only:

- D1 `0009`–`0014` applies to a fresh database and the database-backed
  #16–#24 fixture plus hardening regressions pass.
- PostgreSQL `0134`–`0139` applies to a local PGlite scratch database and a
  positive publication/status runtime graph passes.
- TypeScript checks pass for the PostgreSQL app and Cloudflare Worker trees.

PGlite is not staging PostgreSQL evidence. No staging/production migration,
write, route cutover, or deployment is authorized by these results. Before a
remote apply, record the exact clean merged commit SHA, migration SHA-256,
actual database identity, tenant scope, recovery evidence, and pre/post
migration inventories. Run the common database fixture only on a newly created
scratch database and run shadow comparison in server-enforced read-only mode.

The production publication writer remains absent/disabled. Application-level
manifest generation and its exact source-SHA binding must be rehearsed and
approved before any publication boundary is activated.
