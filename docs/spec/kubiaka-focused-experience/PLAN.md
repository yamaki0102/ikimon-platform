# ZUKAN クビアカツヤカミキリ見守り — Ordered Implementation Plan

- Status: final active plan
- Contract: `SPEC.md`
- Master plan: `IMPLEMENTATION_MASTER_PLAN.md`
- Coverage: `AREA_COVERAGE.md`
- Strategy: `yamaki0102/ikimon-business-strategy#42` and `#43`

## 0. Execution rule

Implement from latest main after strategy and product architecture are integrated.

Do not reuse closed PR #1492 as an implementation base.

Each PR must have one clear responsibility, exact source SHA, explicit non-goals, tests, and release-state report.

## 1. Canonical integration

### PR S1 — strategy #42

Purpose:

- finalize ZUKAN architecture and all-alert routing safety

Exit:

- strategy main contains taxon-side, link-independent, dispatcher-entry interlock

### PR S2 — strategy #43

Purpose:

- adopt Receipt-first, Map-later Kubiaka decision

Exit:

- strategy main fixes P0 scope, state axes, guest boundary, feedback truthfulness, public-map deferral

### PR P1 — platform #1489

Purpose:

- integrate ZUKAN product architecture contract

Required before merge:

- references current strategy exact SHA
- typecheck green
- Node tests green
- build green
- no runtime writer
- no DB change

### PR P2 — platform #1491

Purpose:

- integrate final Kubiaka SPEC / Master Plan / Coverage deferral

Required before merge:

- rebase to latest main
- docs/spec only
- no review prompt in active spec
- no reference to #1492 as current implementation
- no runtime, migration, staging, production change

## 2. Gate 0 implementation

### PR K0 — Managed-taxon all-alert interlock

Base:

- latest platform main

Files likely involved:

- alert dispatcher
- taxon normalization helper
- managed-taxon scope registry/config
- alert tests
- operations evidence

Implement:

- canonical normalized name + approved synonym set
- dispatcher-entry early return
- deny taxon match, novelty, researcher, invasive, webhook/mail/delivery paths
- deny independent of Record link
- deny during `link_pending`
- unmanaged taxon regression

Do not implement:

- Kubiaka UI
- Record link
- DB activation unless separately approved
- routing enablement
- external send

Exit:

- focused tests green
- full relevant alert tests green
- no external mutation

## 3. Private contribution foundation

### PR K1 — Kubiaka registry and route contract

Implement:

- source-only Kubiaka definition
- `/kubiaka` route registry
- normalized taxon scope reference
- status `active | read_only | retired`
- dedicated route resolution

Do not implement:

- DB
- composer save
- receipt
- map

Exit:

- deterministic contract tests
- no runtime behavior outside disabled/fixture-safe route registration

### PR K2 — Dedicated shell and static public pages

Implement:

- `/kubiaka`
- `/kubiaka/guide`
- `/kubiaka/about`
- `/kubiaka/faq`
- dedicated shell
- final copy
- accessibility / visual QA

Do not implement:

- public area map
- external routing
- real Record context

Exit:

- 320–1536 viewports
- text 200%
- keyboard and screen-reader checks
- one dominant CTA

### PR K3 — Additive persistence migrations

Source-only migration PR first.

Entities:

- `experience_managed_taxa` if runtime activation requires DB
- `kubiaka_record_links`
- `kubiaka_link_outbox`
- `kubiaka_participants`
- `kubiaka_receipts`
- `kubiaka_receipt_claims`

Required evidence:

- schema review
- PostgreSQL fixture
- D1 fixture only where active runtime requires
- idempotent apply
- rollback plan
- tenant isolation
- suppression compatibility

Do not apply migration without explicit approval.

### PR K4 — Composer context and outbox

Implement:

- `/kubiaka/record`
- server-side experience context
- existing composer reuse
- 1–6 photos
- login return
- retry context preservation
- Record save→link/outbox
- `link_pending` state

Blocking tests:

- Record save success + link failure
- outbox retry idempotency
- no Assessment before ready
- Gate 0 deny during pending
- no duplicate link

### PR K5 — Guest credential and private receipt

Implement:

- scoped guest credential
- private receipt
- current-session receipt only
- pre-submit empty guest state
- safe metadata
- no-store

Blocking tests:

- guest A/B isolation
- stale cookie
- replay
- enumeration
- link preview
- shared-device reset

### PR K6 — Receipt-scoped account claim

Implement:

- receipt claim transaction
- account attribution
- guest mutation invalidation
- duplicate prevention

Blocking tests:

- account A/B isolation
- claim merge
- partial failure rollback
- idempotent repeat
- logout
- no claim-all

### PR K7 — Dedicated member workspace

Implement:

- `/kubiaka/me`
- `/kubiaka/me/records`
- `/kubiaka/records/:recordId`
- `/kubiaka/places/:placeId`
- continuation priority
- annual revisit read model

Exit:

- post-save and login return remain in dedicated experience
- unrelated ZUKAN records do not dominate
- exact location remains owner-only

## 4. Closed pilot B1

No new PR until staging journey is proven.

Required staging journey:

```text
Guest open
→ select 1–6 photos
→ save
→ link pending or ready
→ private receipt
→ reopen same session
→ optional login
→ receipt claim
→ dedicated member detail
```

Verify:

- mobile real image
- offline/retry
- shared device
- Assessment unavailable
- no external delivery
- no public map

Record metrics in operations evidence.

## 5. Feedback implementation

### PR K8 — Asset-aware assessment adapter

Implement:

- asset ID in input/output
- deterministic batch handling
- submitted / assessed / failed IDs
- per-asset evidence roles
- no silent truncation

Blocking tests:

- 6 submitted / 3 assessed copy
- 6 submitted / 6 assessed copy
- finding references assessed IDs only
- failed asset retained as unassessed

### PR K9 — Orthogonal state projection

Implement pure projection from:

- persistence
- assessment
- feedback
- action
- review authority
- more-evidence flag
- revisit due

Blocking combinations:

- saved + assessment failed
- published + assessment stale
- published + specialist review ongoing
- sent + unacknowledged
- published + revisit due
- link pending

### PR K10 — FeedbackEdition persistence and publisher

Implement:

- append-only edition
- authority
- source assessment versions
- limitations
- supersedes link
- publish/withhold gate

Do not implement:

- survey non-detection
- external routing

### PR K11 — Operator inbox

Implement:

- candidate queue
- insufficient/contradiction queue
- feedback draft
- more-evidence request
- audit sample

No action both confirms and sends.

## 6. Closed pilot C1

Measure before further scope:

- review time
- feedback latency p50/p90/p99
- automatic completion
- false positives
- no-clear-sign false-negative audit
- more-evidence request rate
- feedback read rate

Stop if:

- feedback makes unsupported claim
- queue capacity is unsustainable
- submitted/assessed accounting mismatches
- privacy incident occurs

## 7. Operator coverage

### PR K12 — Operator coverage read model

Start only after C1 evidence.

Reuse:

- grid derivation
- snapshot cadence mechanism

Implement:

- separate operator read model
- no public route
- no generic public map feature schema
- evidence role / unique day / revisit / freshness

### PR K13 — Suppression and erase consumer

Implement:

- consume suppression/erase events
- exclude affected source data
- regenerate immutable edition
- switch operator pointer
- audit propagation

### PR K14 — Operator coverage UI

Implement:

- `/ops/kubiaka/coverage`
- authorized access
- map/list parity
- no public cache

## 8. Future public map

Not part of this plan's execution authorization.

Requires new Decision.

Minimum evidence:

- account-only participant threshold
- sparse-cell privacy tests
- empty/suppressed indistinguishability
- no raw count/date/centroid
- differencing protection
- suppression propagation
- operator owner
- rollback

Start with municipality or approved Place group, not 500m public cells.

## 9. Future approved routing

Not part of this plan's execution authorization.

Requires explicit approval for:

- recipient registration
- routing gate activation
- external send
- production operation

Gate 0 remains deny by default.

## 10. Validation commands and evidence

Each code PR should run the repository's current canonical commands after reading `AGENTS.md` and `docs/START_HERE.md`.

Minimum evidence:

- typecheck
- focused Node tests
- full relevant Node tests
- build
- security / secret scan
- migration fixture where applicable
- browser QA where visible
- exact SHA
- changed-files list
- release state

Do not state staging or production completion without runtime identity evidence.

## 11. Stop conditions

- strategy or product contract not on main
- branch based on superseded #1492
- any Gate 0 bypass
- experience link loss without outbox
- shared-device history exposure
- receipt URL bearer access
- feedback references unassessed asset
- casual photo becomes survey non-detection
- public map added before separate Decision
- external send added before explicit approval
- DB / production mutation without explicit approval
