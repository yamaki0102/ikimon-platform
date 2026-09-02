# ZUKAN Product Architecture — Implementation Plan

- Status: active plan
- Contract: `SPEC.md`
- Broad profile projection: `PROFILE_HORIZON.md`
- Current execution-roadmap authority: `yamaki0102/ikimon-business-strategy/decisions/2026-09-02-zukan-development-execution-roadmap-v3.md` (r2)
- Prior broad-scope provenance: `yamaki0102/ikimon-business-strategy/decisions/2026-09-01-zukan-broad-product-roadmap-v2.md`
- Current frontier / status projection: `platform_v2/product-registry/delivery.json` (`rolling_frontier`, `execution_roadmap`, `planning_metrics`) and the shared Resolver. This document does not repeat status.

## Goal

Keep ZUKAN's development sequence aligned with the adopted product definition while optimizing for repeated real-world use and reuse of the existing Knowledge Core / Program Core.

ZUKAN is a regional knowledge and participation product across nature, history, culture, facilities, shops, people with explicit publication consent, documents, photos, activities and Publisher sources.

Biodiversity is one Domain Pack. Observation Event / `観察会` is one Program profile. Neither is the product boundary.

The execution rule is not "finish milestone numbers in order." It is:

`keep the Core Loop verified -> let organizations self-serve -> complete calendar-gated cross-profile foundations -> prove the smallest real non-biological Program profile from a demand probe -> compose governed Publications from the existing feed -> exchange Sources -> standardize repeated paid outcomes`.

## What this document owns

Roadmap v3 owns wave order, lane rule, promotion boundaries, KPI names and non-goals. `PROFILE_HORIZON.md` owns M9-M12 profile contracts and fixtures. `delivery.json` owns the static frontier/dependency projection. This plan owns only:

- the Core Loop lane: what real-user loop the product must keep working and which corrections are adopted;
- product-local slice contracts for the active foundation frontier (M7, M8);
- open product decisions (`NEEDS_DECISION`) that an executor must not infer;
- the verification gates this repository runs.

## Milestone meaning

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

M1-M6 together are the Core Loop, not a closed foundation. M5 remains deferred until real demand and authorized source evidence make it more valuable than the current frontier.

## Core Loop lane

The loop every ZUKAN user must be able to complete without IKIMON help:

`撮る -> 保存 -> AI候補 -> Review -> Areaに蓄積 -> 再訪 -> Program参加 -> Publication -> 次の参加`

Each stage must show a truthful state on the owner surface. A blank or silent stage is a defect with Core Loop lane priority (roadmap v3 §2.1), even when the underlying capability is source-verified.

Adopted Core Loop corrections (owner-adopted, executor-eligible under the lane rule; the Product Registry / shared Resolver still owns resolved status):

| Loop stage | Correction | Canonical contract |
|---|---|---|
| 撮る -> 保存 -> AI候補 | AI reassessment enqueued durably at photo finalize; owner surface shows `queued -> processing -> completed \| failed`; completed shows candidate identification, visible evidence, needs-more-evidence, environment summary and short feedback; AI stays a candidate | `yamaki0102/ikimon-platform#1647` (open), fix in flight `#1649` |
| Publication | Public feed reflects eligible Records at eligibility time; owner view shows exclusion/pending reason; per-observation diagnostic for media derivative / face safety / rights / risk / verification / AI request / feed eligibility | `#1647` |
| Areaに蓄積 -> 再訪 | Shared Area Encyclopedia renderer: no-value suppression, growth states from 0 Records, first Record creates visible value, nearby Place fallback, steward truth without fake controls | `docs/design/area_encyclopedia_growth_and_stewardship_contract_2026-09-02.md`, `docs/implementation/zukan_area_encyclopedia_shared_renderer_p0_2026-09-02.md` |
| Areaに蓄積 (facility fixture) | Ryuyo `core + nearby context` over shared primitives; nearby never contaminates membership, aggregates or the external feed | `docs/implementation/zukan_ryuyo_core_nearby_context_contract_2026-09-02.md` |

Rules for this lane:

- a Core Loop correction reuses the current active runtime path and existing capabilities; it never creates a Place-specific renderer, per-region consumer code, a new map pipeline or a new engine;
- rights, sensitive-location, minor/guardian, withdrawal and publication-authority boundaries are never relaxed to improve presentation or speed;
- the lane records `ai_feedback_visible_latency`, `first_record_completion` and `place_revisit_rate` baselines as its own Evidence;
- when the lane has no ready Task, the slot returns to self-serve foundation (M8-A) and then the roadmap frontier.

## First real-user loop to verify

The first loop to prove end-to-end with real users, in this order:

1. one real contributor posts a photo at an existing Place and sees AI candidate feedback within the same session (`#1647` Done);
2. that Record visibly changes the Place's Area Encyclopedia from its previous growth state (shared renderer P0 Done);
3. once explicit syndication consent exists (`NEEDS_DECISION-1`), the same Record reaches an external regional consumer feed with recency order and visible eligibility state;
4. the contributor returns and records at the same Place again (`place_revisit_rate` first baseline).

Only after 1-2 hold on staging with real Evidence does frontier implementation resume in the executor slot.

## M7 — Program Continuity & Handover

Purpose: make Programs durable across school years, fiscal periods, organizers and responsible-person changes.

Status is owned by `delivery.json` tasks. Slice provenance:

- M7.0 planner and M7.1 persistence: source-verified (`delivery.json` tasks `task.zukan.m7.program-handover-planner`, `task.zukan.m7.program-handover-persistence`);
- M7.2 outgoing offer: source-verified (`task.zukan.m7.program-handover-outgoing-selection`);
- M7.3 incoming acceptance: promoted by `M7_3_PROMOTION_2026-09-02.md`; the executor adds its Registry task in the implementing PR;
- M7.4 real staging handover Journey: requires the runtime-mutation promotion (roadmap v3 §9) because it is the first slice that mutates Program responsibility;
- M7.5 production promotion: normal protected release boundary.

Calendar gate: M7.4 staging `LIVE_VERIFIED` by 2027-01, M7.5 production by 2027-02, ahead of the April school/fiscal-year turnover. Until that window M7 is roadmap-frontier lane work and does not pre-empt Core Loop or M8-A Tasks.

Required invariants (unchanged):

- source/target Program provenance;
- outgoing/incoming responsible actor;
- selected Place / Record / Quest / template refs only;
- participant / consent / Review / publication approval reset;
- canonical Place/Record identity reuse without duplication;
- retry/idempotency;
- partial failure never reports completion;
- unknown or unapproved incoming actor fails closed.

M7.0 fixtures are `school_new_academic_year_new_teacher`, `guardian_withdrawal_fail_closed`, `unresolved_review_reference_not_approval`, `same_place_record_reused_without_duplication`, `outgoing_actor_removed_after_acceptance`, `unknown_unapproved_incoming_actor_fail_closed`, `retry_converges_to_one_logical_plan`, `same_key_different_payload_rejected`, `invalid_selected_ref_fail_closed`, and `participant_consent_review_publication_carry_over_forbidden`. The terminal check is deterministic replay plus all negative fixtures with zero DB/UI side effects.

### M7.1 — persisted handover plan / idempotency

M7.1 persists only an accepted immutable `ProgramHandover` plan snapshot; it does not execute the handover or mutate the target Program.

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

### M7.2 — outgoing handover offer

M7.2 lets the currently authorized outgoing responsible actor select one immutable persisted M7.1 plan and append one `ProgramHandoverOffer` in `pending_acceptance` state. It does not accept the handover, transfer responsibility, mutate the target Program, or remove the outgoing actor.

The offer MUST reference the stored logical plan/plan identity without editing its selected refs or reset-state declaration. If different refs are needed, create and persist a new M7.0/M7.1 plan rather than mutating the old plan.

M7.2 rules:

- re-read the persisted plan and current source Program revision before offering; stale/missing/mismatched plan bindings fail closed;
- outgoing actor must still be authorized for the source Program at offer time;
- incoming actor/target scope is recorded as the intended recipient only; M7.2 grants no acceptance or transfer authority;
- the offer is append-only and carries `pending_acceptance`; no participant, consent grant, Review decision, publication approval, visibility state, Place/Record copy or target Program mutation is written;
- same idempotency key + same offer payload converges to one logical offer; same key + different payload fails closed; concurrent retries converge;
- an offered plan cannot be silently rewritten; changing plan identity or selected refs requires a new plan and new offer;
- source/migration/repository definitions are allowed, but no staging/production migration application, route/UI activation, outgoing-role removal or incoming acceptance is authorized.

### M7.3 — incoming acceptance

Contract: `M7_3_PROMOTION_2026-09-02.md`. Source-only; terminal state `accepted_pending_apply`; no responsibility mutation, no outgoing removal, no lifecycle policy invention.

## M8 — Operational Summary & Raw Portability

M8 is two separate contracts. They MUST NOT be collapsed. Neither waits for M7: M8-A depends on the M6 closeout/free-output boundary and reports continuation/handover state as `unknown` until M7 is live; M8-B depends on the M1/M2 Record and rights lifecycle. M8-A is the self-serve foundation lane's first Task once its fixtures and Evals are shaped.

### M8-A — Free OperationalActivitySummary

Purpose: a school, municipality, organization or company can understand normal Program operations without IKIMON support and without buying a specialist report.

Allowed operational information:

- participant/team/activity counts and state;
- Quest progress;
- Record/Place counts;
- Review distribution;
- visibility state;
- consent completeness;
- continuation/handover state (`unknown` until M7 is live);
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

## M9-M12

Profile contracts, fixtures, default order, people/profile boundary, NOCOSIL bridge and paid outcome families are owned by `PROFILE_HORIZON.md`; wave order, demand probe, existing M10 feed seed and manual M12 delivery are owned by roadmap v3 §2 Wave 3, §3 and §5. This plan adds no second copy.

Product-local notes only:

- M9 demand probe: run with an existing partner Place/organization on the current `observation_event` profile with manual organizer Review; record needed/manual/missing Core delta as Demand Learning Evidence; no profile code before one completed probe.
- M10 seed: the existing publication feed and its external consumers are the live API/dataset projection; harden consent surfacing, recency and eligibility observability inside the Core Loop lane before any new Publication Profile.
- M12: manual paid delivery of Professional Report / Publication Production / Managed Program is allowed now and recorded as `paid_outcome_conversion` baseline; product software follows the second repeated delivery.

## NEEDS_DECISION

Open product choices. Executors must not infer them; the recommendation is the lead's proposal, not an adopted decision.

### NEEDS_DECISION-1 — where explicit external-syndication consent is captured

Records default to `recordConsent=private`, `researchUseConsent=none`, `externalExportAllowed=false`; the public feed requires explicit external-export/public-export/licence state (`#1647`). Without a capture point, no personal Record reaches an external regional site.

| Option | Description | Trade-off |
|---|---|---|
| A. Capture-time toggle | Per-Record opt-in `地域の図鑑・連携サイトにも掲載` at save, default off | Simplest; adds a decision to the first-record moment and may lower `first_record_completion` |
| B. Program-scope consent + owner-detail prompt (recommended) | Joining a Program shows and records the Program's publication scope once; personal Records get a one-tap prompt on the owner detail after AI feedback | Keeps capture friction zero and ties consent to a visible benefit; requires two consent paths and Program-scope withdrawal semantics |
| C. Post-hoc batch consent | Owner grants syndication per Place or per period from `自分` | Lowest friction, but feeds stay empty until the owner returns; weakest provenance per Record |

Hard boundary in all options: default stays private; minors require guardian consent; withdrawal revokes derived publication; ordinary display and promotional reuse remain separate rights.

### NEEDS_DECISION-2 — staging consumer environment contract for external regional sites

The LENRI staging consumer reads the staging publication feed, so a production Record can never appear there (`#1647` follow-up).

| Option | Description | Trade-off |
|---|---|---|
| A. Staging consumer reads production public feed read-only (recommended) | Real public-safe data for real-data preview; feed is already public-only | Cannot preview unreleased feed changes on staging; needs an explicit env label |
| B. Staging consumer reads staging feed with seeded public fixtures | Full isolation | No real-user Evidence; fixtures must be maintained |
| C. Env toggle, default A | Both, with visible source label | Small extra configuration surface |

### NEEDS_DECISION-3 — first manual paid outcome to pursue

| Option | Description | Trade-off |
|---|---|---|
| A. Managed Program with an existing partner (recommended) | Facilitate one real Program for a current partner (facility/community site) and deliver the free operational recap plus human facilitation | Uses existing capability only; highest support minutes per delivery |
| B. Publication Production for an existing consumer site | Produce one custom regional Publication from the existing feed | Proves M10 demand; production work is bespoke until M10 profiles exist |
| C. Professional Report for a municipal/facility partner | Specialist report with expert review | Highest price point; needs an accountable specialist and separate rights basis |

## Verification

Product Registry changes must continue to pass:

```bash
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
npm --prefix platform_v2 run test:product-registry
```

Roadmap validation additionally must assert:

- current strategy authority points to execution roadmap v3;
- M1-M12 stable ordering;
- M5 remains deferred;
- M7/M8/M9 frontier stays explicit until product promotion changes it;
- executor-slot lane priority is recorded and is not executor-autonomous;
- M9 default profile order starts with Photo Contest and then Mission/Town Walk, with Stamp Rally as a variation initially;
- M10 Publication order and people-profile safety remain explicit;
- M11 keeps NOCOSIL/source authority boundaries;
- M12 remains demand-gated and billing-first is forbidden;
- no executor Task exists for M9-M12 before frontier promotion;
- KPI names remain baseline/measurement contracts, not invented target promises.

## Production boundary

This plan does not authorize any production mutation, DB migration, secret/IAM change, billing activation or external/customer send.
