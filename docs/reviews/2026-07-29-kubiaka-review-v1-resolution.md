# Kubiaka Architecture Review v1 — Resolution Matrix

- Date: 2026-07-29
- Status: corrections prepared / second review pending
- Source review: external read-only architecture review supplied by project owner

## P0 resolution

| Finding | Decision | Correction | Verification gate |
|---|---|---|---|
| Existing invasive auto-routing bypass | Accepted | strategy #42 interlock; independent first runtime PR | failing→passing alert/delivery tests |
| Submitted vs assessed photo count | Accepted | distinct submitted/assessed asset IDs; honest copy | mismatch contract tests; existing model-limit inspection |
| Public `privacy_suppressed` existence oracle | Accepted | removed from public state; unified `no_public_data` | empty/suppressed indistinguishability |
| k-threshold uses Record count only | Accepted | participant OR Record insufficiency suppresses; raw date removed | one-participant-many-Records fixture |
| Degenerate target fail-open | Accepted | positive target validation; invalid→no_public_data | zero/NaN/missing/stale-denominator tests |
| Shared-device guest history leak | Accepted | latest receipt only; explicit device history/reset; receipt-scoped claim | school tablet browser tests |
| Linear workflow state | Accepted | Persistence / Assessment / Feedback / Action + `link_pending`; authority separate | six simultaneous-state scenarios |
| `survey_non_detection` caller boolean | Accepted | Foundation v2 Survey/Detection/Coverage source of truth; `partial` excluded | PG/D1 mapping tests |
| Case implies specialist authority | Accepted | workflow cannot infer authority | projection/copy tests |

## P1 resolution

| Finding | Decision | Correction / status |
|---|---|---|
| Foundation v2 duplication | Accepted | Survey, Detection, Coverage reused; Kubiaka coverage is read projection only |
| suppression cannot reach new projection | Accepted in design | use existing ProjectionSnapshot/map snapshot; verify propagation before Release D |
| grid scheme duplication | Accepted | reuse existing gridM ladder; standards crosswalk/export only |
| species privacy solves wrong threat | Accepted | contributor sensitivity floor added to map/receipt contract; implementation review pending |
| routing reimplemented | Accepted | extend existing invasive reporting behind interlock; no new routing source of truth |
| usability enum collapses axes | Accepted | boolean flags instead of exclusive enum |
| registry disabled breaks receipt rollback | Accepted | next pure contract uses `active | read_only | retired`; lookup remains available |
| scientific name used as taxon ID | Accepted | require opaque canonical taxon ID; name is display field |
| PR stack duplicate patch | Accepted | #1492 closed; no successor stack until #1491 merged |
| outbox underdefined | Accepted | explicit link outbox / idempotency / `link_pending` contract |

## Simplifications adopted

- No generic `focused_experiences` DB table in P0.
- No separate focused-experience survey/non-detection tables.
- No separate area grid or map publication subsystem.
- No separate routing subsystem.
- Kubiaka-specific persistence remains Kubiaka-specific until a second real experience proves commonality.
- P0 routes exclude settings, config, Case UI and routing UI.
- Static Release A is folded into private contribution Release B.
- Old review packet removed from `docs/spec/` and replaced under `docs/reviews/`.
- #1492 closed as superseded; branch retained.

## Items requiring second-review confirmation

1. Correct enforcement point for auto-routing interlock.
2. Whether common Record-context link is justified at n=1.
3. Exact existing suppression propagation coverage.
4. PostgreSQL / D1 Foundation v2 parity.
5. Existing composer and assessment image-limit behavior.
6. Participant/Sybil model for public k-threshold.
7. Whether existing location privacy hooks can implement contributor sensitivity without another parallel subsystem.
8. Minimum migration objects for link, receipt and claim.

## Current mutation boundary

Completed changes are strategy/spec/review docs and closing the unmerged Draft PR #1492. No runtime route, DB, migration, staging, production, secret, DNS, permission or external-send change has been made.
