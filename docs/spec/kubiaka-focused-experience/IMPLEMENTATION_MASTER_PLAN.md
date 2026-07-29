# ZUKAN クビアカツヤカミキリ見守り — Final Implementation Master Plan

- Status: final / external architecture review closed
- Date: 2026-07-29
- Product contract: `SPEC.md`
- Coverage contract: `AREA_COVERAGE.md`
- Ordered plan: `PLAN.md`
- Strategy:
  - `yamaki0102/ikimon-business-strategy#42`
  - `yamaki0102/ikimon-business-strategy#43`
- Platform parent: `yamaki0102/ikimon-platform#1489`
- Superseded implementation: `yamaki0102/ikimon-platform#1492` closed, unmerged
- Cross-project control: `yamaki0102/all-projects-management#886`

## 0. Executive decision

本計画は次の順で実装する。

> 全通知interlock → private contribution → receipt / claim / member workspace → delayed feedback → closed pilot → operator coverage → 将来public map → approved routing

初期版の中心価値はprivate receiptと誠実なfeedbackである。

一般公開のcoverage map、survey non-detection、外部routingは初期版から外す。

外部architecture reviewは終了し、以後は本計画、実コード、テスト、staging、closed-pilot evidenceに基づいて判断する。

## 1. Non-negotiable invariants

1. Accountを別管理しない
2. Record、Media、Placeを複製しない
3. composerをforkしない
4. Record保存とAI完了を混同しない
5. submitted assetとassessed assetを混同しない
6. AI、trained reviewer、specialist、recipient responseを一つのconfirmedへ畳まない
7. casual photoからsurvey non-detectionを生成しない
8. feedbackで元Recordを上書きしない
9. experience link欠落を通知許可と解釈しない
10. `link_pending`中にAssessment・feedback公開・外部通知を開始しない
11. guest端末の過去receiptを既定表示しない
12. receipt IDだけをbearer accessにしない
13. public mapをP0へ含めない
14. external sendをP0〜Release Dへ含めない
15. law status、AI confidence、candidate、Caseだけで外部送信しない
16. production、DB、secret、DNS、権限、外部送信は明示承認なしに変更しない

## 2. Canonical PR topology

### 2.1 Existing PRs

```text
strategy #42  ZUKAN architecture and routing safety
strategy #43  Kubiaka receipt-first decision
platform #1489 ZUKAN product architecture contract
platform #1491 final Kubiaka SPEC / PLAN
platform #1492 closed / superseded evidence only
```

### 2.2 Integration order

1. strategy #42をmainへ統合
2. strategy #43を最新mainへrebaseし統合
3. platform #1489をstrategy main exact SHAへ追従し、検証後mainへ統合
4. platform #1491を最新mainへrebaseし、docs/spec onlyとして統合
5. successor runtime PRはlatest mainから新規作成

Parent branchを2段以上維持しない。親がmergeされたら子PRをmain baseへ付け替える。

### 2.3 Superseded #1492

- closed
- unmerged
- current implementation candidateではない
- branch内容は設計失敗の証跡としてのみ参照
- successorへcherry-pickしない
- 必要なpure ideaはlatest mainから再実装する

## 3. Gate 0 — all-alert taxon interlock

### 3.1 Purpose

Kubiaka Recordが作られる前に、管理対象taxonが既存通知・deliveryへ流れないことを保証する。

### 3.2 Taxon scope

P0 source contract:

```ts
interface ExperienceManagedTaxonScope {
  scopeKey: "kubiaka-watch";
  acceptedNormalizedScientificNames: readonly string[];
  status: "deny_external_routing" | "routing_enabled";
  policyVersion: string;
}
```

- canonical initial name: `Aromia bungii`
- approved synonyms are normalized into the same set
- opaque taxon ID is not assumed to exist

### 3.3 Enforcement point

`emitAlertsForOccurrence` equivalent dispatcher入口で、各branchより前に実行する。

Pseudo contract:

```ts
const managedScope = findExperienceManagedTaxon(normalizeTaxonName(ctx));
if (managedScope && managedScope.status !== "routing_enabled") {
  return emptyAlertSummary("experience_managed_taxon_denied");
}
```

Do not query experience Record link as the primary deny predicate.

### 3.4 Paths to block

- user taxon matches / subscriptions
- novelty
- researcher trigger
- invasive reporting
- webhook
- mail
- municipality / land-manager delivery

### 3.5 Gate 0 tests

- managed taxon + no link → all branches denied
- managed taxon + `link_pending` → all branches denied
- managed synonym → denied
- managed taxon + law status priority → denied
- managed taxon + novelty confidence → denied
- managed taxon + family / order subscription → denied
- unmanaged taxon → existing behavior unchanged
- explicit routing flag cannot be enabled without policy configuration
- no external delivery rows or sends in test fixture

### 3.6 Exit

- independent PR from latest main
- exact SHA tests green
- no production deploy
- no taxon routing activation

## 4. Release B — Private contribution foundation

### 4.1 User value

- guest or member submits 1–6 photos
- Record is saved before AI
- guest receives private receipt
- member returns to dedicated detail
- dedicated Home shows only relevant continuation

### 4.2 P0 persistence entities

Use Kubiaka-specific names. Do not create generic `focused_experiences` table in P0.

#### `experience_managed_taxa`

Safety configuration for Gate 0.

Fields:

- opaque row ID
- scope key
- normalized scientific name
- accepted synonym flag / canonical name reference
- routing status
- policy version
- created / updated audit

This entity may be source-config backed first; DB activation requires migration approval.

#### `kubiaka_record_links`

- opaque link ID
- canonical Record reference
- participant reference nullable while pending
- entrypoint
- protocol profile/version
- seasonal module optional
- createdAt immutable
- suppression state
- idempotency key

#### `kubiaka_link_outbox`

- outbox ID
- Record reference
- intended context
- state
- retry count
- next attempt
- last error class
- idempotency key
- completedAt

#### `kubiaka_participants`

- participant ID
- account user ID nullable
- guest credential digest nullable
- session createdAt
- disabled / claimed state
- no public participant semantics

#### `kubiaka_receipts`

- receipt ID
- participant
- record link
- current feedback pointer nullable
- guest access state
- account owner nullable
- metadata privacy state
- createdAt

#### `kubiaka_receipt_claims`

- claim ID
- receipt ID
- user ID
- idempotency key
- state
- created / completed / failed
- replay evidence

### 4.3 Migration rules

- additive only
- opaque IDs
- tenant / scope isolation
- foreign keys or equivalent integrity
- idempotent apply ledger
- PostgreSQL and D1 only where active runtime needs parity
- backup and rollback plan
- staging apply before production
- no production apply without explicit approval

### 4.4 Composer integration

Preferred route: `/kubiaka/record`.

Reuse existing composer through controller/context injection.

Required:

- server-authoritative `experience_key`
- login return path
- retry preserves context
- post-save destination scoped
- global launcher hidden
- current upload/MIME/EXIF behavior retained after tests
- one to six images
- save independent of AI

Do not store experience context only in query string or analytics.

### 4.5 Outbox behavior

If Record save succeeds and link write fails:

- Record stays saved
- receipt can show `link_pending`
- outbox retries
- no Assessment starts
- no feedback publishes
- Gate 0 still denies notifications by taxon
- successful retry creates one link only

### 4.6 Guest receipt

- HttpOnly scoped credential
- receipt ID not sufficient alone
- private/no-store headers
- link preview reveals no private data
- current-session receipt only
- pre-submit guest view empty

### 4.7 Account claim

- receipt-scoped
- transaction
- no duplicate Record/media
- guest access invalidated after success
- rollback on partial failure
- account A/B isolation
- no claim-all P0

### 4.8 Member workspace

`/kubiaka/me` continuation priority:

1. unread feedback
2. more evidence request
3. checking
4. annual/seasonal revisit
5. first record

`/kubiaka/me/records`:

- scoped Kubiaka records
- photo-first compact cards
- contributor-facing state only

`/kubiaka/records/:recordId`:

- media
- persistence / assessment / feedback projection
- safe Place
- feedback when available
- provenance disclosure

`/kubiaka/places/:placeId`:

- same-Place timeline
- identity uncertainty
- annual / seasonal comparison
- no `前はいなかった` claim

## 5. Closed pilot B1

### 5.1 Scope

- one region
- invite or limited entry
- no external send
- no public map
- no survey non-detection
- feedback can remain disabled or operator-only during initial persistence validation

### 5.2 Metrics

- Record save success
- upload retry success
- link outbox recovery
- receipt return success
- guest A/B isolation
- account A/B isolation
- shared-device confusion
- claim success / rollback
- privacy incidents
- average media size and storage

### 5.3 Exit

- no ownership/privacy blocker
- retry and outbox evidence green
- actual user journey can proceed without generic ZUKAN Home interruption

## 6. Release C — Delayed feedback

### 6.1 Asset-aware assessment contract

Modify or replace current `recordPhotoFeedback` integration.

Input:

```ts
interface AssessmentAssetInput {
  assetId: string;
  mimeType: string;
  bytesOrReference: unknown;
}
```

Output must retain:

- submittedAssetIds
- assessedAssetIds
- failedAssetIds
- per-asset evidence roles
- findings linked to asset IDs
- model/rule version
- limitations
- contradictions
- completedAt

No silent truncation.

If model call supports only 3 assets, process deterministic batches and preserve batch provenance. Publish whole-record no-clear-sign only after all intended assets are assessed.

### 6.2 Evidence flags

- isPhotoRecord
- isScreenable
- isRepeatComparable

Do not compute `isSurveyUsable`.

### 6.3 FeedbackEdition

Store:

- edition ID
- Record link
- submitted asset IDs
- assessed asset IDs
- content sections
- authority
- source assessment versions
- limitations
- publishedAt
- supersedes edition ID nullable

Append-only. Never overwrite prior edition.

### 6.4 Automatic feedback boundary

May auto-publish only when:

- persistence ready
- asset accounting valid
- no sensitive content leak
- limitations present
- authority=`automated`
- wording is photo-scope only
- no unresolved candidate requiring human review

Candidate, contradiction, severe quality limitation, or policy uncertainty enters operator queue.

### 6.5 Operator inbox

Queue groups:

- adult candidate
- frass / exit-hole candidate
- insufficient or contradictory evidence
- feedback draft
- more evidence request
- audit sample

No action confirms and sends externally.

### 6.6 Random audit

Sample no-clear-sign automated feedback.

Pilot target:

- at least 200 samples before claiming measured false-negative performance
- stratify by adult / frass / exit-hole, device quality, season, region

## 7. Closed pilot C1

Measure:

- Review minutes per Record
- feedback latency p50 / p90 / p99
- candidate rejection rate
- false positive rate
- no-clear-sign false negative audit
- automated completion rate
- more-evidence request rate
- user feedback read rate
- annual revisit intent baseline

Do not promise SLA before these values exist.

## 8. Release D — Operator coverage only

### 8.1 Start conditions

- Release C pilot data exists
- operator use case exists
- privacy owner assigned
- no public route

### 8.2 Reuse

Reuse existing:

- cell derivation
- gridM ladder
- snapshot cadence mechanism

Create separate Kubiaka read model. Do not reuse public feature fields containing count/date/centroid.

### 8.3 Inputs

- Record and assessed asset aggregates
- evidence role distribution
- unique days
- Place revisit
- participant type
- Review/audit state
- suppression/erase events
- optional formal SurveyEvent when real protocol exists

### 8.4 Suppression consumer

New production consumer is required; do not assume it exists.

- read suppression/erase events
- exclude affected source rows
- generate immutable new projection edition
- update serving pointer
- retain audit evidence

### 8.5 Public map

Not part of Release D.

A separate future Decision must define:

- account-only participant threshold
- no guest-only publication
- empty/suppressed indistinguishability
- freshness masking
- differencing protection
- granularity
- operational owner

## 9. Release E — Approved routing

Not started without explicit approval.

Required:

- real recipient
- geographic/taxon/purpose scope
- valid receive consent and expiry
- allowed fields
- trained reviewer requirement
- operator separate approval
- idempotent send
- acknowledgement mechanism
- failed/expired states
- runbook
- rollback / kill switch

Gate 0 remains deny until each exact scope is enabled.

## 10. Generic survey platform relationship

Existing/parallel generic survey development remains separate.

Responsibilities:

1. survey recording
2. save-health notification
3. coverage navigation
4. optional AI guide

Walking / vehicle / fixed, offline queue, Wake Lock, 500m mesh, 25–50m subcells are not P0 Kubiaka dependencies.

Later integration points:

- operator coverage
- formal SurveyEvent
- annual monitoring protocol
- partner-led field survey

Do not model a perpetual survey as a fake event.

## 11. Validation matrix

### Unit / contract

- normalized taxon synonym scope
- Gate 0 path decisions
- four-axis contributor projection
- `link_pending`
- asset accounting
- evidence reference validation
- feedback copy rules
- annual revisit selection

### Integration

- Record→outbox→link→receipt
- outbox idempotency
- claim transaction
- append-only feedback
- Assessment failure with saved Record
- stale Assessment with published feedback
- suppression→projection regeneration in Release D

### Security

- guest A/B
- account A/B
- guest/account crossover
- pre-submit shared-device empty
- current-session receipt only
- stale cookie
- replay
- CSRF
- receipt enumeration
- cache/no-store
- Gate 0 across all notification branches

### Browser

- 320 / 375 / 390 / 412 / 768 / 1024 / 1280 / 1440 / 1536
- text 200%
- keyboard
- screen reader
- 6-photo upload/retry
- login return
- camera permission denied
- offline draft recovery

### Operations

- queue overload
- Assessment outage
- receipt survival during outage
- retry/backpressure
- incident runbook
- no external send

### Model evaluation

- adult precision/recall
- frass precision/recall
- exit-hole precision/recall
- image role classification
- no-clear-sign audit
- regional/season/device stratification

## 12. Observability

Track without private content:

- save success/failure class
- outbox pending age
- link recovery
- receipt access success
- claim success/failure
- Assessment queue age
- assessed/submitted ratio
- feedback latency
- operator queue age
- retry counts

Do not log:

- exact coordinates
- image content
- raw notes
- credential
- receipt access secret
- child identity

## 13. Rollback

### Gate 0

- kill switch keeps managed taxa denied
- rollback must never re-enable external sends by default

### Release B

- disable new Kubiaka entry
- keep existing receipts read-only
- preserve Records and links
- continue outbox reconciliation

### Release C

- stop Assessment workers
- keep save/receipt operational
- retain published feedback editions
- mark new feedback withheld

### Release D

- stop projection refresh
- remove operator view pointer
- preserve editions for audit

### Release E

- disable exact routing scope
- stop send worker
- retain delivery evidence
- do not delete source Record

## 14. Explicit approval boundaries

Requires explicit approval before execution:

- PostgreSQL / D1 migration apply
- production deploy
- taxon routing activation
- external send
- recipient registration
- secret / DNS / permission changes
- deletion / branch deletion if evidence would be lost

Source-only docs, code, tests, branch, and Draft PR may proceed within repository rules.

## 15. Completion definition

Initial product is complete when:

- Gate 0 is enforced across all notification paths
- guest/member 1–6 photo save works
- private receipt survives Assessment outage
- shared-device history does not leak
- receipt claim is transactional
- member stays in dedicated Kubiaka experience
- submitted/assessed asset accounting is truthful
- photo-scope feedback is versioned and limited
- closed pilot metrics are recorded
- public map and external send remain disabled

## 16. Stop conditions

Stop immediately if:

- any managed-taxon notification branch bypasses Gate 0
- link failure permits Assessment or send
- another guest's receipt is shown
- receipt URL alone grants access
- feedback claims unassessed media
- casual photo creates survey non-detection
- generic public map fields are exposed
- production/DB/external send lacks explicit approval
- implementation diverges from strategy Decision
