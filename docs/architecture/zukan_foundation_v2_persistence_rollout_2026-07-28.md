# ZUKAN Foundation v2 永続化・migration rollout

- 日付: 2026-07-28
- strategy foundation: `yamaki0102/ikimon-business-strategy@05f73759375e06c70f60de65960b9d2b59ee6680`
- implementation contract: `yamaki0102/ikimon-platform@4cca5d9fb13274d07e89ee0cb825a32584e44503`
- executable memory fixture: `yamaki0102/ikimon-platform@5c8933a711343d22966308cf32ebd3e0828e8440`
- state: expand migrations implemented / remote application requires exact-SHA evidence

## 1. Purpose

Foundation v2の後付けしにくい契約を、PostgreSQL canonical storeとCloudflare D1 compatibility/runtime storeへadditiveに永続化する。

この変更は既存Record、Observation、Place Atlas、Source Registryを置換しない。新規Foundation tableへ既存データを自動backfillせず、既存runtime writerも切り替えない。まず空の永続構造とDB invariantを入れ、次のPRでadapter、dual-write、shadow-readへ進む。

## 2. Migrations

### PostgreSQL

1. `0134_zukan_foundation_v2_source_identity.sql`
2. `0135_zukan_foundation_v2_predicate_claims.sql`
3. `0136_zukan_foundation_v2_authority_resolution.sql`
4. `0137_zukan_foundation_v2_governance_rights.sql`
5. `0138_zukan_foundation_v2_disputes_coverage.sql`

PostgreSQL migration runnerは各ファイルを独立transactionとして適用し、`schema_migrations`へchecksumを記録する。

### Cloudflare D1 CORE_DB

1. `0009_zukan_foundation_v2_source_identity.sql`
2. `0010_zukan_foundation_v2_predicate_claims.sql`
3. `0011_zukan_foundation_v2_authority_resolution.sql`
4. `0012_zukan_foundation_v2_governance_rights.sql`
5. `0013_zukan_foundation_v2_disputes_coverage.sql`

D1 migrationはroutine deployから分離し、approval-bound `migrate` actionで適用する。

## 3. Frozen invariants represented in DB

- opaque `SubjectIdentity` and non-reusable `PublicIdentifier`
- physical merge禁止、time-bounded membership/canonical assertions
- immutable Predicate definitions per `(predicate_uri, predicate_version)`
- append-only Claim revisions with monotonic `recorded_sequence`
- immutable ResolutionRun, candidate decision rows, ProjectionSnapshot and PublicationEdition
- exact claim-store sequence watermark and recorded-time watermark
- versioned trust anchors, authority assertions and prospective/retroactive revocation events
- suppress/redact/erase impact events without rewriting immutable manifests
- rights `unknown` as first-class state; public use is not granted by absence of a decision
- SurveyEvent / DetectionOutcome and CoverageAssessment separation
- DisputeCase, CorrectionRequest and SuppressionRequest event histories

## 4. Erase semantics

`erase` may physically delete the underlying object bytes and secret locator. The immutable snapshot still references a stable `ValueArtifact` identifier, so the metadata row becomes a non-value tombstone:

- payload fields cleared
- storage locator cleared
- content digest cleared when retaining it would be unsafe
- `availability_status = 'erased'`
- governance event and affected Snapshot/Publication event appended
- replay reports `reproducibility = degraded` and identifies missing fields

The immutable publication manifest is not edited after issue.

## 5. Validation

Before remote migration:

- PostgreSQL migration source contracts are green
- fresh in-memory D1 chain applies 0009–0013
- database-backed fixture #16–#24 passes
- migration baseline advances from 136 to 141 files, head 0138
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

## 7. Next PRs

1. PostgreSQL and D1 repository adapters implementing the same fixture contract.
2. Source Registry v1 → Foundation v2 import with dry-run/diff/idempotency.
3. ResolutionRun and public-ID read API behind a disabled feature flag.
4. shadow-read comparison, then bounded dual-write.
5. backfill and public projection only after rights and identity review gates are active.
