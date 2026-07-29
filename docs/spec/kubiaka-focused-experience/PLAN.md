# ZUKAN クビアカツヤカミキリ見守り — Ordered Implementation Plan v2

- Status: second-review candidate
- Contract: `SPEC.md`
- Area contract: `AREA_COVERAGE.md`
- Master plan: `IMPLEMENTATION_MASTER_PLAN.md`
- Superseded implementation: `#1492`

## 1. Purpose

このファイルは実装sliceの順序だけを定義する。設計判断は`SPEC.md`、privacyは`AREA_COVERAGE.md`、移行・運用・pilotは`IMPLEMENTATION_MASTER_PLAN.md`を正本とする。

## 2. Ordered slices

### Slice 0 — External architecture review

Targets:

- strategy #42
- strategy #43
- platform #1489
- platform #1491
- current main implementation that will be reused

Exit:

- P0 = 0
- accepted P1 reflected in source of truth
- unresolved items are explicitly deferred with owner and gate

### Slice 1 — Existing invasive auto-routing interlock

Independent PR from latest main.

Implement:

- detect active experience-scoped occurrence
- deny existing invasive delivery by default
- explicit experience routing gate
- existing unscoped behavior regression tests
- recipient consent / operator approval tests

No UI, migration, Kubiaka feedback, public map.

Exit:

- law status alone cannot generate delivery for scoped occurrence
- no external send executed in verification

### Slice 2 — Product architecture integration

- complete strategy #42
- rebase / verify platform #1489
- merge only after typecheck, Node tests, product contract tests

Exit:

- active product architecture exists on main
- no runtime route / DB writer introduced by #1489

### Slice 3 — Kubiaka strategy and specification

- complete strategy #43
- rebase platform #1491 onto latest main
- keep docs/review packet separate from product spec directory
- ensure state, Foundation, map privacy, routing all agree

Exit:

- no linear workflow enum in source of truth
- no public `privacy_suppressed`
- no generic DB platform commitment at n=1

### Slice 4 — Pure contracts, new PR from main

Add only pure TypeScript and tests:

- experience registry with `active | read_only | retired`
- opaque canonical taxon reference
- 4-axis contributor projection
- `link_pending`
- submitted / assessed asset accounting
- Kubiaka evidence role flags
- Foundation Survey mapping validator
- public coverage projection validator

No route, DB, migration, external send.

Exit:

- degenerate target, one participant, partial evidence, assessed mismatch tests green
- full typecheck / Node tests / build green

### Slice 5 — Link and receipt migration

Candidate new entities:

- common Record-context link
- link outbox
- `kubiaka_participants`
- `kubiaka_receipts`
- `kubiaka_receipt_claims`

Requirements:

- additive
- opaque IDs
- hashed guest secret
- idempotency
- rollback
- suppression compatibility
- PostgreSQL / D1 parity only where runtime requires

Exit:

- staging apply / rollback rehearsal
- transaction and outbox recovery tests
- no production apply

### Slice 6 — Release B routes

Implement:

- dedicated shell
- landing / guide / about / FAQ
- `/kubiaka/record` using existing composer
- private receipt
- receipt-scoped claim
- dedicated member Home / records / detail

Exit:

- guest/member 1–6 photos
- save before AI
- link retry / login return
- shared-device viewing isolation
- authenticated and guest staging browser QA

### Slice 7 — Closed pilot B1

- one region
- invite-controlled
- external routing disabled
- no public live coverage
- operator read-only Evidence access

Measure save, receipt, claim, shared-device, recovery, privacy.

### Slice 8 — Release C feedback

Add:

- asynchronous Assessment edition
- assessed asset IDs
- Kubiaka coverage items
- FeedbackEdition
- automated feedback
- reviewer override
- random no-clear-sign audit
- operator inbox

Exit:

- honest photo count copy
- backpressure / Assessment-off behavior
- feedback latency evidence
- no expert authority overclaim

### Slice 9 — Release D area coverage

Reuse:

- Foundation Survey / Detection / Coverage
- existing public map snapshot / ProjectionSnapshot

Add:

- Kubiaka target validator
- participant + Record privacy threshold
- freshness bands
- denominator staleness
- accessible list parity
- operator coverage QA

Exit:

- sparse, one-participant, school/home, stale, no-denominator fixtures green
- empty/suppressed indistinguishable

### Slice 10 — Release E approved routing

Extend existing invasive reporting only after explicit approval.

- routing gate
- human Review
- operator separate send approval
- idempotent delivery
- acknowledgement / expiry / follow-up

Exit:

- real recipient and consent
- operational owner
- incident and rollback runbook
- production / external-send approval

## 3. PR discipline

- one parent branch at a time
- no three-level long-lived stack
- docs and runtime changes separated
- safety interlock independent from product UI
- migrations separated from route implementation when reviewability requires
- exact SHA in every staging gate
- old #1492 branch retained only as reference

## 4. Completion definition

`CODE_VERIFIED`, `STAGING_UX_VERIFIED`, `PRODUCTION_DEPLOYED`, `PRODUCTION_UX_VERIFIED`を別々に報告する。

Production、DB apply、secret、DNS、権限、外部送信、削除は個別の明示承認なしに行わない。
