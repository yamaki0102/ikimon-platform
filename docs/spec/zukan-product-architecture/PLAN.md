# ZUKAN Product Architecture — Implementation Plan

- Status: active plan
- Contract: `SPEC.md`
- Broad profile projection: `PROFILE_HORIZON.md`
- Paired execution-roadmap change: `yamaki0102/ikimon-business-strategy/decisions/2026-09-02-zukan-development-execution-roadmap-v3.md` r2 in strategy Draft PR `#116`; merged r1 remains canonical until `#116` is adopted
- Prior broad-scope provenance: `yamaki0102/ikimon-business-strategy/decisions/2026-09-01-zukan-broad-product-roadmap-v2.md`
- Current frontier / status projection: `platform_v2/product-registry/delivery.json` and the shared Resolver. This document does not repeat status.

## Goal

Keep ZUKAN's development sequence aligned with the adopted product definition while optimizing for repeated real-world use and reuse of the existing Knowledge Core and Program Core.

ZUKAN is a place-centered public commons and participation product across nature, history, culture, facilities, shops, people with explicit publication consent, documents, photos, activities and Publisher sources. Biodiversity is one Domain Pack. `観察会` is one Program profile.

The execution rule is not "finish milestone numbers in order". It is:

`keep the Core Loop delivered in production -> let organizations self-serve -> prove repeat and revisit -> reuse one Program/Publication core across profiles -> prove paid demand manually -> build software only for repeated demand -> generalize last`.

## What this document owns

Roadmap v3 owns wave order, the lane and landing rules, promotion boundaries, KPI names and non-goals. `PROFILE_HORIZON.md` owns M9-M12 profile contracts and fixtures. `delivery.json` owns the static frontier and dependency projection. This plan owns only:

- the Core Loop lane and its adopted corrections;
- the current execution frontier, stated so an executor can start without further product judgement;
- product-local slice contracts for M7 and M8;
- decisions the evidence determines, and the one decision that genuinely remains the owner's;
- the verification gates this repository runs.

## Milestone meaning

1. M1 Personal Record/media integrity · 2. M2 Safe Publication and rights/data lifecycle · 3. M3 Program/Event/Quest/Workspace collaboration · 4. M4 Regional knowledge, PublicationEdition, portability, correction · 5. M5 Live-camera POC (`deferred`) · 6. M6 Self-Serve Program Activation, which proves the observation-event Program profile · 7. M7 Program Continuity and Handover · 8. M8 Operational Summary and Raw Portability · 9. M9 Regional Program Profiles · 10. M10 Regional Publication Profiles · 11. M11 Source and Public Projection Exchange · 12. M12 Professional and Managed Outcomes

M1-M6 together are the Core Loop, not a closed foundation.

## Core Loop lane

The loop every ZUKAN user must complete without IKIMON help:

`撮る -> 保存 -> AI候補 -> Review -> Place/Areaに蓄積 -> 再訪 -> Program参加 -> governed Publication -> 次の参加`

Two rules govern this lane, both from roadmap v3 §2:

- **Delivered means running in production and observed working there**, bound to an exact source SHA. Source-verified and staging-verified are progress, not delivery.
- **Every stage owes the contributor a visible return.** A stage that consumes a contribution and returns nothing is a defect even when each component works.

Adopted corrections (owner-adopted and executor-eligible under the lane rule; the shared Resolver still owns resolved status):

| Loop stage | Correction | Contract |
|---|---|---|
| 撮る → 保存 → AI候補 | AI reassessment enqueued durably at photo finalize; the owner surface shows `queued -> processing -> completed \| failed` in the same session; completed shows candidate identification, visible evidence, needs-more-evidence, environment summary and a short feedback; AI remains a candidate | incident `#1647`; candidate fix `#1649` |
| Review | The contributor is told the outcome of a human Review of their own record, not only the reviewer's queue state. `quality.zukan.workspace.review` currently contracts the reviewer's side only | this plan; new requirement `quality.zukan.review.contributor-return` |
| Place/Areaに蓄積 → 再訪 | Shared Area Encyclopedia renderer: no-value suppression, growth states from zero Records, the first Record visibly changes the page, nearby Place fallback, steward truth without fake controls | `docs/design/area_encyclopedia_growth_and_stewardship_contract_2026-09-02.md`, `docs/implementation/zukan_area_encyclopedia_shared_renderer_p0_2026-09-02.md` |
| Place/Areaに蓄積 (facility fixture) | Ryuyo `core + nearby context` over shared primitives; nearby never contaminates membership, aggregates or the external feed | `docs/implementation/zukan_ryuyo_core_nearby_context_contract_2026-09-02.md` |
| governed Publication | The public feed reflects eligible Records at eligibility time; the owner sees the exclusion or pending reason; the contributor is told where their record was published; corrections and withdrawals propagate to consumers; a per-observation diagnostic covers media derivative, face safety, rights, risk, verification, AI request and feed eligibility | `#1647`, roadmap v3 §3 Track A |

Rules for this lane:

- reuse the current active runtime path and existing capabilities. Never create a Place-specific renderer, per-region consumer code, a new map pipeline or a new engine;
- rights, sensitive-location, minor and guardian consent, withdrawal and publication-authority boundaries are never relaxed to improve presentation or speed;
- offline, degraded-network, draft-recovery and retry behaviour is part of every Core Loop slice, not separate quality work. The loop is used outdoors on a phone;
- the lane records `first_record_completion`, `ai_feedback_delivery_delay`, `review_lead_time` and `place_revisit_rate` baselines as its own Evidence;
- when the lane has no ready slice, the slot returns to self-serve foundation and then to the roadmap frontier.

### Why this lane exists

Core Loop requirements have been contracted and tested at staging and still failed for real users. `quality.zukan.capture.truthful-status` already requires that AI state is shown separately and that unconfirmed is never displayed as confirmed. `record-feedback-loop.staging.spec.ts` already exercises the loop. Incident `#1647` happened anyway in production because the capture obligations were bound to `source` and `staging`, while production obligations were concentrated in rights requirements. The product was contractually required to be safe in production but not explicitly required to prove the capture loop worked there.

## Current execution frontier

One slice, stated so an executor can start without further product judgement. Everything else waits.

### Frontier 1 — Deliver the capture-to-feedback loop to production

**Source.** Current main; candidate fix `#1649` and its files under `platform_v2/cloudflare_shadow/src`; `platform_v2/e2e/record-feedback-loop.staging.spec.ts`; the existing production release and verification scripts under `scripts/` (`run_cloudflare_production_release.sh`, `build_production_verification_report.mjs`, `publish_production_verification_status.mjs`); requirements `quality.zukan.capture.truthful-status`, `quality.zukan.capture.ai-candidate`, `quality.zukan.capture.idempotent-save`, `quality.zukan.capture.draft-recovery`. Before writing code, read `#1302` and `#1578`: they contain undelivered overlapping enqueue/idempotency fixes that must be reconciled or explicitly superseded, not re-implemented. Read `#1441` separately: it addresses historical backlog reprocessing rather than the same-session defect and must receive its own delivery/revert/close disposition.

**Delta.** Land the capture-to-AI-feedback path so a real contributor sees candidate feedback in the same session in production. Bind the four requirements above to the `operation` environment. Promote the existing staging feedback-loop journey to also run against production with a disposable fixture account, reusing the existing cleanup path. Surface the owner-visible exclusion or pending reason for publication eligibility. No new service, queue, telemetry system or gate.

**Done.** A real post on production shows `queued -> processing -> completed | failed` within the session; the four requirements are green in the `operation` environment with read-back evidence bound to the exact SHA; `ai_feedback_delivery_delay` and `first_record_completion` have a first baseline; the overlapping work in `#1302` and `#1578` is delivered or explicitly superseded, and `#1441` has a separately recorded disposition; production mutation stays inside the existing approval boundary.

### Frontier 2 — Area Encyclopedia shared renderer P0

Queued behind Frontier 1 in the same lane. Its contract is already adopted and complete; it lacked only a Product Registry task, which this change adds. It must not start while Frontier 1 is source-verified and undelivered.

### Frontier 3 — Publication return and syndication hardening

Queued behind Frontier 2 in the same lane. Reuse the existing PostgreSQL/D1 publication feeds and rights services. Add the purpose/version/term-bound syndication consent path, fail-closed minor/guardian resolution, owner-visible eligibility or exclusion reason, contributor-visible publication destination, correction/withdrawal propagation, and the explicit read-only production-feed environment label for staging consumers. Do not add a new feed, per-region adapter, analytics system or publication database.

### Then

Self-serve foundation lane: M8-A. Roadmap frontier lane: M7.3 source-only, then M7.4 under the runtime-mutation promotion within the calendar gate.

## First real-user loop to verify

1. a real contributor posts a photo at an existing Place and sees AI candidate feedback within the same session, in production;
2. that Record visibly changes the Place's Area Encyclopedia from its previous growth state;
3. a human Review decision on that Record is returned to the contributor;
4. the Record reaches an external regional consumer feed with recency order, visible eligibility state, and the contributor can see where it was published;
5. the contributor returns and records at the same Place again.

Step 1 holds on production Evidence before Frontier 2 starts. Step 2 holds after Frontier 2 and before Frontier 3 starts. Later steps become the acceptance sequence for Frontier 3 and the first repeat-use measurement; none is a precondition for implementing the stage that makes it possible.

## M7 — Program Continuity & Handover

Purpose: make Programs durable across school years, fiscal periods, organizers and responsible-person changes.

Status is owned by `delivery.json`. Slice provenance: M7.0 planner, M7.1 persistence and M7.2 outgoing offer are source-verified; M7.3 incoming acceptance is promoted by `M7_3_PROMOTION_2026-09-02.md`; M7.4 needs the runtime-mutation promotion because it is the first slice that mutates Program responsibility; M7.5 is the production boundary. Calendar gate: M7.4 staging `LIVE_VERIFIED` by 2027-01, M7.5 delivered by 2027-02.

Scope boundary: M7 transfers a Program to a *different* responsible actor. The same organizer repeating next period is already covered by the implemented `quality.zukan.program.closeout-rehost` contract, which reuses only the plan settings and carries no participant, consent, Review or publication state forward. Verify and surface repeat-via-rehost rather than rebuilding repeat inside M7.

Invariants: source/target Program provenance; outgoing and incoming responsible actor; selected Place/Record/Quest/template refs only; participant, consent, Review and publication approval reset; canonical Place/Record identity reuse without duplication; retry idempotency; partial failure never reports completion; unknown or unapproved incoming actor fails closed.

M7.0 fixtures: `school_new_academic_year_new_teacher`, `guardian_withdrawal_fail_closed`, `unresolved_review_reference_not_approval`, `same_place_record_reused_without_duplication`, `outgoing_actor_removed_after_acceptance`, `unknown_unapproved_incoming_actor_fail_closed`, `retry_converges_to_one_logical_plan`, `same_key_different_payload_rejected`, `invalid_selected_ref_fail_closed`, `participant_consent_review_publication_carry_over_forbidden`. Terminal check: deterministic replay plus all negative fixtures with zero DB/UI side effects.

### M7.1 persisted plan / idempotency

Persists only an accepted immutable `ProgramHandover` plan snapshot; it does not execute the handover or mutate the target Program. Reuse the existing Foundation D1 write-receipt/idempotency pattern; do not introduce a generic idempotency subsystem. Keep the repository contract provider-neutral with D1 as the active adapter.

Persist only tenant/workspace scope, logical plan ID, plan identity, payload digest, source Program/revision, target Program/continuation, selected reference IDs, reset-state declaration, outgoing/incoming responsibility refs, observed-at, actor/audit ref and immutable created-at. Participant rows, consent grants, Review decisions, publication approvals, visibility state, Record/Place copies and target Program mutations remain forbidden.

Rules: only an accepted M7.0 result with matching current scope may be stored; same key and payload returns the same logical plan; same key with a different payload fails closed; concurrent retries converge to one logical plan; write failure leaves no falsely completed state; the stored plan is immutable; migrations may be defined but not applied outside the test database.

### M7.2 outgoing handover offer

The authorized outgoing actor selects one immutable persisted plan and appends one `ProgramHandoverOffer` in `pending_acceptance`. It does not accept, transfer responsibility, mutate the target Program or remove the outgoing actor. The offer references the stored plan without editing its selected refs or reset-state declaration; different refs require a new plan.

Rules: re-read the persisted plan and current source revision before offering, failing closed on stale, missing or mismatched bindings; the outgoing actor must still be authorized at offer time; the incoming actor is recorded as intended recipient only and gains no authority; the offer is append-only; same key and payload converge to one logical offer; an offered plan is never silently rewritten; no migration application, route or UI activation, outgoing-role removal or incoming acceptance is authorized.

### M7.3 incoming acceptance

Contract: `M7_3_PROMOTION_2026-09-02.md`. Source-only; terminal state `accepted_pending_apply`; no responsibility mutation, no outgoing removal, and no invented lifecycle policy.

## M8 — Operational Summary & Raw Portability

Two separate contracts that must not be collapsed. Neither waits for M7. M8-A depends on the M6 closeout and free-output boundary and reports continuation state as `unknown` until M7 is delivered; M8-B depends on the M1/M2 Record and rights lifecycle. M8-A is the self-serve lane's first slice once its fixtures and Evals are shaped.

### M8-A Free OperationalActivitySummary

Purpose: a school, municipality, organization or company understands normal Program operations without IKIMON support and without buying a specialist report. It is the answer to "why would we run this again", so contributor return across events is part of it.

Allowed: participant, team and activity counts and state; Quest progress; Record and Place counts; Review distribution; visibility state; consent completeness; continuation and handover state; contributor return across events; Publication references.

The projection is bound to an identified Program/Event and a source watermark. Unknown, missing or partial inputs stay explicit as `unknown`, unavailable or itemized partial results, and are never coerced to zero or presented as complete. The same watermark is read-idempotent, and mixed visibility follows the existing audience and projection policy.

Forbidden: species or taxon list or count; biodiversity aggregate or comparison; normalized scientific inventory; report-ready specialist tables or charts.

Fixtures: `operational_summary_excludes_taxon_counts`, `operational_summary_partial_source_is_explicit`, `operational_summary_mixed_visibility_respects_projection`, `operational_summary_empty_program_is_not_error`, `operational_summary_retry_same_watermark`. A failed metric source must never silently upgrade the summary to complete.

### M8-B RawRecordPortabilityArchive

Purpose: users and organizations retain and move their own source Records without lock-in.

Preserve Record granularity, source and media refs, user input, time, Place/location policy, consent, visibility, Review, provenance/history and withdrawal state. Rights are evaluated per Record and per field: ambiguous rights narrow or block the affected item, and private, withdrawn, deleted, quarantined or unauthorized data never becomes public through archive creation. Retention, deletion and withdrawal remain observed states rather than inferred completion.

Do not reuse `researchExport.ts` as this contract. Raw portability must not become taxonomy normalization, deduplicated inventory, species or taxon list or count, biodiversity summary or a professional report.

Each item may report an explicit partial failure; retry converges to the same manifest digest without duplicate Records or media. Fixtures: `raw_record_archive_preserves_record_granularity`, `raw_record_archive_mixed_visibility_is_field_scoped`, `raw_record_archive_withdrawal_is_explicit`, `raw_record_archive_partial_item_failure_is_recoverable`, `raw_record_archive_retry_same_manifest`, `raw_record_archive_does_not_emit_taxon_inventory`.

M8 promotion requires M8-A and M8-B to remain separately testable, explainable and failure-isolated.

## M9-M12

Profile contracts, fixtures, default order, the people/profile boundary, the NOCOSIL bridge and paid outcome families are owned by `PROFILE_HORIZON.md`. Wave order, the demand probe, the M10 two-track split and manual M12 delivery are owned by roadmap v3. This plan adds no second copy.

Product-local notes:

- **M9 demand probe.** Run one real non-biological program with an existing partner organization on the current Program Core, using the existing `observation_event` configuration plus manual organizer work. Record what the partner needed, what was manual and which Core delta was missing, as Demand Learning Evidence. No profile code before one completed probe.
- **M10.** Track A, hardening the existing publication feed, is Core Loop lane work available now. Track B, new Publication Profiles, stays frontier. The existing feed has both a PostgreSQL and a Cloudflare D1 implementation enforcing the same consent rules; keep them in sync rather than forking behaviour.
- **M11 and shared identity.** Source exchange and the owner-approved Draft Shared Identity & Activity plane are separate lanes. ZUKAN's bounded obligations if that decision is adopted are in roadmap v3 §4.1 and `SPEC.md` §12.
- **M12.** Manual paid delivery of Professional Report, Publication Production or Managed Program is allowed now and recorded as `paid_outcome_conversion` evidence; software follows the second repeated delivery.

## Adopted decisions

These were open in the previous draft. The evidence determines them, so they are decided here rather than deferred.

### Syndication consent is captured at Program scope plus an owner-detail prompt

Records default to `recordConsent=private`, `researchUseConsent=none`, `externalExportAllowed=false`, and the publication feed independently requires external-export, public-export, licence, withdrawal, risk and face-safety state. The database and feed already determine *that* consent is required; only *where it is captured* was open.

Adopted: joining a Program shows and records that Program's purpose-, version- and term-bound publication scope once; this does not make every Program Record externally eligible. Each Record still passes its own rights, review, risk, withdrawal and audience checks. A personal Record gets a one-tap prompt on the owner detail surface after AI feedback, when the contributor can see the destination, purpose and licence. Capture-time friction stays zero.

Boundaries that are not negotiable in this design:

- default stays private, and consent is never inferred from visibility. Program visibility and external syndication are independent: a Record may be visible to Program members and still not syndicated;
- **the consent path must resolve minor status and fail closed.** Guardian authority is purpose-, version- and term-bound and independently withdrawable. Guardian consent is currently enforced only on the Program participation path (`observationEventApi.ts`, `observationRally.ts`); neither `observationDataRights.ts` nor either publication feed implementation checks it. A new syndication path that does not resolve current minor/guardian status must remain ineligible;
- withdrawal revokes derived publication and propagates to external consumers;
- ordinary display rights and promotional reuse rights remain separate.

### The staging consumer reads the production public feed read-only

External regional consumer sites preview real data by reading the production public feed read-only, with an explicit environment label in the response so the consumer can tell which feed it is showing. The feed is public-safe by construction, so this exposes nothing that publication rules do not already permit. Unreleased feed changes are still previewed by pointing a consumer at the staging feed deliberately.

## NEEDS_DECISION

One decision genuinely remains the owner's, because it is a commercial and relationship choice that no source evidence settles.

### NEEDS_DECISION-1 — the first manual paid outcome to pursue

| Option | Description | Trade-off |
|---|---|---|
| A. Managed Program with an existing partner (recommended default) | Facilitate one real Program for a current partner and deliver the free operational recap plus human facilitation | Uses existing capability only; highest support minutes per delivery, which is exactly the number worth baselining first |
| B. Publication Production for an existing consumer site | Produce one custom regional Publication from the existing feed | Proves M10 Track B demand; production work stays bespoke until Publication Profiles exist |
| C. Professional Report for a municipal or facility partner | Specialist report with expert review | Highest price point; needs an accountable specialist and a separate rights basis |

The plan recommends A, but choosing a partner, making an offer, contracting, invoicing and external delivery remain owner decisions. Record the chosen option as Demand Learning only after that decision is made.

## Verification

Product Registry changes must continue to pass:

```bash
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
npm --prefix platform_v2 run test:product-registry
```

Roadmap validation additionally asserts: the current strategy authority points to execution roadmap v3; stable M1-M12 ordering; M5 deferred; the M7/M8/M9 frontier explicit until product promotion changes it; the executor-slot lane priority recorded and not executor-autonomous; Core Loop requirements carrying a production obligation; the M9 default profile order; the M10 Publication order and people-profile safety; M11 NOCOSIL and source authority boundaries; M12 demand-gated with billing-first forbidden; no executor Task for M9-M12 before frontier promotion; and KPI names as measurable baselines rather than invented target promises.

## Production boundary

This plan does not authorize production mutation, DB migration, secret, IAM, DNS or billing change, or external customer send. Production *verification* of a delivered slice runs inside the existing approval boundary under the central deploy registry.
