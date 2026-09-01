# ZUKAN Product Architecture — Implementation Plan

- Status: active plan
- Contract: `SPEC.md`
- Broad profile projection: `PROFILE_HORIZON.md`
- Current execution-roadmap authority: `yamaki0102/ikimon-business-strategy/decisions/2026-09-02-zukan-development-execution-roadmap-v3.md`
- Prior broad-scope provenance: `yamaki0102/ikimon-business-strategy/decisions/2026-09-01-zukan-broad-product-roadmap-v2.md`

## Goal

Keep ZUKAN's development sequence aligned with the adopted product definition while optimizing for repeated real-world use and reuse of the existing Knowledge Core / Program Core.

ZUKAN is a regional knowledge and participation product across nature, history, culture, facilities, shops, people with explicit publication consent, documents, photos, activities and Publisher sources.

Biodiversity is one Domain Pack. Observation Event / `観察会` is one Program profile. Neither is the product boundary.

The execution rule is not “finish milestone numbers in order.” It is:

`close current verified foundation -> complete shared cross-profile foundations -> prove the smallest real non-biological Program profile -> compose governed Publications -> exchange Sources -> standardize repeated paid outcomes`.

## Current verified foundation

The Product Registry / shared Resolver owns current implementation status. The roadmap meaning remains:

1. M1 — Personal Record/media integrity
2. M2 — Safe Publication + rights/data lifecycle
3. M3 — Program/Event/Quest/Workspace collaboration
4. M4 — Regional knowledge / PublicationEdition / portability / correction
5. M5 — Live-camera POC (`deferred`)
6. M6 — Self-Serve Program Activation; the current production implementation proves the observation-event Program profile
7. M7 — Program Continuity & Handover
8. M8 — Operational Summary & Raw Portability
9. M9 — Regional Program Profiles
10. M10 — Regional Publication Profiles
11. M11 — Source & Public Projection Exchange
12. M12 — Professional & Managed Outcomes

M5 remains deferred until real demand and authorized source evidence make it more valuable than the current frontier.

## Execution waves

### Wave 0 — Current foundation closure

M1–M6 and App Experience should leave active feature-development mode once the following are true for the latest material source:

- current main and current-state packet agree on exact source identity;
- exact-source staging verification is fresh after material source changes;
- critical authenticated Journeys are verified or explicitly retained as `UNKNOWN` rather than assumed;
- production preparation may be brought to its protected approval/materialization boundary without blocking later safe work;
- future changes to these capabilities are treated primarily as regression, defect or rights/safety work rather than recurring redesign.

A pending production approval is not a reason to stop safe design/source work on later waves.

## Rolling frontier

Current product-planning projection:

- `ACTIVE`: M7 Program Continuity & Handover
- `READY_NEXT`: M8 Operational Summary & Raw Portability
- `SHAPED_NEXT`: M9 Regional Program Profiles
- M10–M12: dependency-shaped only
- M5: deferred

Only one executor implementation Task may be active at a time. Independent read-only/design work may proceed in parallel. Roadmap presence never grants implementation authority.

## M7 — Program Continuity & Handover

Purpose: make Programs durable across school years, fiscal periods, organizers and responsible-person changes.

M7.0 and M7.1 are source-verified on current main. M7.2+ remain `implementation_allowed=false` until explicit promotion.

Required invariants:

- source/target Program provenance;
- outgoing/incoming responsible actor;
- selected Place / Record / Quest / template refs only;
- participant / consent / Review / publication approval reset;
- canonical Place/Record identity reuse without duplication;
- retry/idempotency;
- partial failure never reports completion;
- unknown or unapproved incoming actor fails closed.

Promotion status (2026-09-02): **M7.0 was explicitly promoted to executor-eligible** after exact-source Wave 0 production `LIVE_VERIFIED` at `ed39ef808b9284b972f82b8b142b1448e12e4323` and completion of the planner promotion conditions. **M7.1 is now source-verified** as the provider-neutral immutable snapshot contract plus D1-first deterministic adapter/tests. Its migration remains unapplied outside the test database; no runtime UI, participant/consent/Review/publication-state carry-over, or production mutation is authorized.

Implementation order after promotion:

1. `M7.0` side-effect-zero deterministic `ProgramHandover` planner + synthetic fixtures;
2. `M7.1` persistence/idempotency;
3. `M7.2` outgoing handover selection;
4. `M7.3` incoming actor acceptance / responsibility transfer;
5. `M7.4` real staging handover Journey;
6. `M7.5` production promotion under the normal protected release boundary.

M7 design exit before promotion:

- no unresolved product/rights decision in planner scope;
- Requirement / dependency / Journey / negative Eval / fixture coverage complete;
- outgoing/incoming authorization and lifecycle-reset semantics fixed;
- source revision, target continuation, selected refs and actor identities are explicit inputs;
- unknown, stale, scope-mismatched or unauthorized refs/actors fail closed without a target side effect;
- the same canonical intent and source revision return the same plan digest, while same-key different-payload is a conflict;
- partial failure is itemized and never reported as a completed handover;
- source, authorization, rights, participant, review, lifecycle and target-scope changes invalidate a prior plan;
- first implementation slice can be expressed as short `Source / Delta / Done` without executor product invention.

M7.0 fixtures are `school_new_academic_year_new_teacher`, `guardian_withdrawal_fail_closed`, `unresolved_review_reference_not_approval`, `same_place_record_reused_without_duplication`, `outgoing_actor_removed_after_acceptance`, `unknown_unapproved_incoming_actor_fail_closed`, `retry_converges_to_one_logical_plan`, `same_key_different_payload_rejected`, `invalid_selected_ref_fail_closed`, and `participant_consent_review_publication_carry_over_forbidden`. The terminal check is deterministic replay plus all negative fixtures with zero DB/UI side effects. M7.0 is source-verified on current main `17e5fcf60f290d97f9aba64cdec63be869cbe402`.

### M7.1 — persisted handover plan / idempotency

M7.1 is explicitly promoted after M7.0 source verification. It persists only an accepted immutable `ProgramHandover` plan snapshot; it does not execute the handover or mutate the target Program.

Reuse the existing Foundation D1 write-receipt/idempotency pattern rather than introducing a new generic idempotency subsystem. The active-runtime adapter is D1; keep the repository contract provider-neutral and do not require a second persistence backend unless an existing active path needs it.

Persist only the minimum plan identity and provenance needed for later M7.2/M7.3 work: tenant/workspace scope, logical plan ID, plan identity, payload digest, source Program/revision, target Program/continuation, selected reference IDs, reset-state declaration, outgoing/incoming responsibility refs, observed-at, actor/audit ref and immutable created-at. Participant rows, consent grants, Review decisions, publication approvals, visibility state, Record/Place copies and target Program mutations remain forbidden.

Persistence rules:

- only an M7.0 `accepted/planned` result with matching current source/target scope may be stored;
- same idempotency key + same payload digest returns the same stored logical plan/receipt;
- same idempotency key + different payload digest fails closed;
- concurrent retries converge to one logical stored plan;
- write failure leaves no falsely completed handover state;
- the stored plan is immutable in M7.1; later acceptance/transfer is a separate append/state-transition concern owned by M7.2/M7.3;
- source/migration files may be added, but no staging/production migration application, route/UI activation or production mutation is authorized by M7.1.

M7.1 is source-verified on current main with the repository contract, unapplied migration definition, D1 deterministic tests, and registry/Eval bindings proving one logical row under replay/concurrency, conflict rejection, immutable plan snapshot, no participant/consent/Review/publication-state copy and no target Program side effect. M7.2 remains blocked until Noah explicitly promotes it.

## M8 — Operational Summary & Raw Portability

M8 is two separate contracts. They MUST NOT be collapsed.

### M8-A — Free OperationalActivitySummary

Purpose: a school, municipality, organization or company can understand normal Program operations without IKIMON support and without buying a specialist report.

Allowed operational information:

- participant/team/activity counts and state;
- Quest progress;
- Record/Place counts;
- Review distribution;
- visibility state;
- consent completeness;
- continuation/handover state;
- Publication references.

The projection is bound to an identified Program/Event and source watermark. Unknown, missing or partial metric inputs stay explicit as `unknown`/unavailable or itemized partial results; they are never coerced to zero or presented as complete. Repeating the same watermark is read-idempotent, and mixed visibility follows the existing audience/projection policy.

Forbidden as free operational summary:

- species/taxon list or count;
- biodiversity aggregate/comparison;
- normalized scientific inventory;
- report-ready specialist tables/charts.

M8-A design fixtures are `operational_summary_excludes_taxon_counts`, `operational_summary_partial_source_is_explicit`, `operational_summary_mixed_visibility_respects_projection`, `operational_summary_empty_program_is_not_error`, and `operational_summary_retry_same_watermark`. Failure of one metric source must not silently upgrade the summary to `complete`.

### M8-B — RawRecordPortabilityArchive

Purpose: users/organizations can retain and move their own source Records without lock-in.

Preserve Record granularity, source/media refs, user input, time, Place/location policy, consent, visibility, Review, provenance/history and withdrawal state. Rights are evaluated per Record and field: ambiguous rights narrow or block the affected item, and private, withdrawn, deleted, quarantined or unauthorized data never becomes public through archive creation. Retention/deletion/withdrawal remain observed states rather than inferred completion.

Do not reuse `researchExport.ts` as the RawRecordPortabilityArchive contract. Raw portability MUST NOT silently become taxonomy normalization, deduplicated inventory, species/taxon list/count, biodiversity summary or professional report.

Each item may report an explicit partial failure; retry converges to the same archive manifest/digest without duplicate Records or media. M8-B design fixtures are `raw_record_archive_preserves_record_granularity`, `raw_record_archive_mixed_visibility_is_field_scoped`, `raw_record_archive_withdrawal_is_explicit`, `raw_record_archive_partial_item_failure_is_recoverable`, `raw_record_archive_retry_same_manifest`, and `raw_record_archive_does_not_emit_taxon_inventory`.

M8 promotion requires M8-A and M8-B to remain separately testable, separately explainable and separately failure-isolated.

## M9 — Regional Program Profiles

Purpose: prove that the existing Program Core is genuinely broader than observation events.

Do not build a universal Program Profile Engine first. Add the minimum vertical slice over existing Program / Quest / Record / Rights / Review / Publication assets.

Default demand-informed implementation order after M7/M8 promotion conditions are satisfied:

1. `photo_contest`
2. `mission_town_walk`
3. shared school/editorial lane: `children_citizen_editorial` + `sketch_drawing_event`
4. `tourism_regional_engagement` as a composite of already-proven Place + Mission + participation + Publication + multilingual capabilities

`stamp_rally` initially remains a Mission/Town-Walk profile variation rather than a dedicated Core/platform.

A real-demand owner/product decision may reorder these profiles. Executors may not infer or change that priority.

### Photo Contest first proof

Use the smallest reusable flow:

`Program -> Record submission -> purpose-specific rights -> organizer Review/selection -> result Publication`.

Do not add public voting, likes, rankings or a social graph as core requirements.

Ordinary display rights and promotional reuse rights remain separate.

### Mission / Town Walk

Reuse Quest + Place + Record/check-in evidence. Continuous precise-location tracking is not a requirement. QR, bounded check-in or Record evidence may be used when the concrete Program needs them.

### Citizen Editorial / Sketch

Reuse team + Quest + Source/Place investigation + Record/artwork media + teacher/staff Review + selected Publication. Minor/guardian consent remains fail-closed.

### Tourism / Regional Engagement

Compose proven capabilities rather than create a separate tourism platform: routes, Places, stories, missions, visitor/resident participation, selected Records, multilingual Publication where justified and repeat-engagement/continuation evidence.

Before executor activation, M9 fixtures and rights/Review differences from `PROFILE_HORIZON.md` must be represented in Product Registry / Eval contracts.

## M10 — Regional Publication Profiles

Purpose: compose governed source truth into useful outputs without new content silos or a replacement truth store.

Default implementation order:

1. Program/campaign result Publication;
2. regional/theme encyclopedia;
3. history/culture collection;
4. tourism map/guide/route;
5. facility/shop/organization collection;
6. consented people/profile Publication;
7. standard paper/PDF publication manifest;
8. API/dataset projection.

Reuse PublicationEdition/source truth. A Publication Profile is a governed View, not a new canonical database.

People/profile Publication requires explicit subject/Publisher rights basis, correction/withdrawal and must never introduce face identification, biometric recognition or tracking.

## M11 — Source & Public Projection Exchange

Purpose: receive and return regional information while keeping source authority explicit and keeping NOCOSIL private truth separate.

Implementation order:

1. `M11-A Source Exchange Package v1` — small bounded envelope for Source/Edition/Publisher/rights/content-or-locator/Place-Entity candidates/provenance/revocation;
2. `M11-B NOCOSIL -> ZUKAN adapter` — explicit selected public-safe projection only;
3. `M11-C external Publisher adapters` — municipal open data, government/DMO/tourism sources, PDF/Web/paper and school/company/community sources;
4. `M11-D correction/revocation/write-back` — explicit version/status/receipt only when an accountable path exists.

NOCOSIL and ZUKAN remain separate canonical/private domains. No shared giant database and no automatic private publication.

## M12 — Professional & Managed Outcomes

Purpose: monetize repeated outcome demand without degrading the free truth/safety core.

Initial commercial outcome families:

1. `Professional Report`
2. `Publication Production`
3. `Managed Program`
4. `Integration / Data Work`

Do not build billing/checkout first. First standardize request, scope, rights readiness, output, delivery evidence and repeatability. Billing follows a recurring reusable delivery workflow.

## Always-on tracks

Every wave runs with four continuous tracks:

1. `UX Quality` — real browser Journey, mobile, PWA, auth, accessibility, performance, empty/degraded/error/retry;
2. `Rights & Safety` — privacy, consent, minor/guardian, location minimization, withdrawal, person safety, Publication correction;
3. `Product Registry / Evidence` — Outcome -> Journey -> Requirement -> Dependency -> Task -> Eval -> Runtime Evidence -> Learning with the shared Resolver as sole status authority;
4. `Demand Learning` — record which Programs/Publications/outcomes are requested, repeated, support-heavy and commercially valuable.

## Future-profile selection rule

When more than one future profile/output is eligible, product authority selects using the ordering principle:

`real demand x reuse value x existing Core fit x adoption/revenue effect / implementation and operational burden`.

The numeric scale is not canonical. Executors do not choose product priority from this formula on their own.

## KPI baseline set

Do not invent target percentages until baseline data exists. First capture:

- `first_record_completion`
- `program_self_start_rate`
- `join_completion`
- `review_lead_time`
- `support_minutes_per_program`
- `handover_completion`
- `raw_portability_success`
- `publication_reuse`
- `repeat_program_rate`
- `paid_outcome_conversion`

Measurement must not weaken privacy or justify unnecessary tracking.

## Explicit non-goals

Do not build:

- municipality/customer-specific backend, database, auth or canonical Place model;
- photo-contest-specific Core database;
- stamp-rally-specific auth/platform;
- universal Program Profile Engine before repeated invariant demand;
- Observation as the parent for unrelated Records;
- generic regional semantics by renaming Taxon/Occurrence/Identification;
- face-recognition/person-tracking people encyclopedia;
- giant shared NOCOSIL/ZUKAN database;
- all M9 profiles in parallel;
- billing-first SaaS;
- mandatory likes/rankings/social primitives;
- coupon fraud infrastructure before repeat demand;
- M5 because its milestone number is lower.

## Verification

Product Registry changes must continue to pass:

```bash
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
npm --prefix platform_v2 run test:product-registry
```

Roadmap validation additionally must assert:

- current strategy authority points to execution roadmap v3;
- M1–M12 stable ordering;
- M5 remains deferred;
- M7/M8/M9 frontier stays explicit until product promotion changes it;
- M9 default profile order starts with Photo Contest and then Mission/Town Walk, with Stamp Rally as a variation initially;
- M10 Publication order and people-profile safety remain explicit;
- M11 keeps NOCOSIL/source authority boundaries;
- M12 remains demand-gated and billing-first is forbidden;
- no executor Task exists for M9–M12 before frontier promotion;
- KPI names remain baseline/measurement contracts, not invented target promises.

## Production boundary

This plan does not authorize any production mutation, DB migration, secret/IAM change, billing activation or external/customer send.
