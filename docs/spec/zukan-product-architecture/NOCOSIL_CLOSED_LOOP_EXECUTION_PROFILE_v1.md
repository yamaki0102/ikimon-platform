# ZUKAN × NOCOSIL Closed-Loop Execution Profile v1

- Status: `DRAFT PRODUCT-LOCAL PROJECTION / NOT EXECUTOR-ACTIVE BY THIS FILE`
- Date: 2026-09-01 JST
- Base: `yamaki0102/ikimon-platform@8baa0bf221c0243dbb28f77d2534f8fb285f02d7`
- Upstream family Decision candidate: `yamaki0102/ikimon-business-strategy#112`
- Upstream execution spec: `docs/ikimon-os/03_product_architecture/NOCOSIL_ZUKAN_CLOSED_LOOP_EXECUTION_SPEC_v1.md` in PR #112
- Current product authority remains `SPEC.md`, `PLAN.md`, `PROFILE_HORIZON.md`, Product Registry and shared Resolver.
- Runtime effect: none.

## 1. Purpose

This file removes implementation judgment for the ZUKAN half of the NOCOSIL closed loop while preserving ZUKAN's current roadmap and ownership.

It does not activate M7/M8/M11. Executor eligibility remains owned by `platform_v2/product-registry/delivery.json` plus the shared status resolver.

## 2. Fixed mapping

| Family profile | ZUKAN owner | Current milestone |
|---|---|---|
| `ExternalProgramReference.v1` | expose/reference existing Program only | M6/M7 existing Program surface; no new canonical object |
| `ProgramContinuationManifest.v1` | Program continuation planner | M7 |
| `ProgramOperationalSummary.v1` | Program free operational output | M8 |
| `PublicCandidate.v1` | Source/Record/Claim candidate receiver | M11 |
| `PublicationResult.v1` | Review/Publication state projection | M11 |
| `ParticipationCredential.v1` | participant-selected externally verifiable participation output | after organizer loop proof; no current milestone promotion by this file |
| `CorrectionRevocationNotice.v1` | rights/correction/publication lifecycle receiver/result | M11 + existing M2/M4 lifecycle semantics |

No NOCOSIL-specific field is added to Program, Record, Claim, Place, Rights, Review or PublicationEdition Core objects.

## 3. Current frontier rule

At this base:

- M7: active design/frontier, task planned, implementation flag false;
- M8: ready-next design;
- M9: shaped-next;
- M11: dependency-shaped.

Therefore:

- this design may define exact contracts, fixtures and future file placement now;
- runtime/source implementation occurs only when current Product Registry/Resolver makes the corresponding slice eligible;
- do not create M11 executor tasks early;
- do not widen an unrelated open M6 integrity PR to include family integration.

## 4. M7 exact output — ProgramContinuationManifest.v1

M7 remains profile-neutral. The planner emits ZUKAN-owned continuation meaning that can later be projected to NOCOSIL or another ZUKAN Program.

Canonical application shape:

```ts
type ProgramContinuationManifestV1 = {
  schema: 'ikimon.program-continuation-manifest/v1'
  source_program_reference: string
  target_program_reference?: string
  selected_place_refs: string[]
  selected_record_refs: string[]
  selected_quest_refs: string[]
  selected_template_refs: string[]
  selected_publication_refs: string[]
  outgoing_accountable_role_ref: string
  incoming_accountable_role_ref: string
  continuation_rationale: string
  effective_period: { from: string; to?: string }
  reset_requirements: [
    'participant_membership',
    'consent',
    'review_approval',
    'publication_authority',
    'invitation_secret'
  ]
  subject_version: string
  payload_digest: string
}
```

Required semantics:

- selected Place/Record/Quest/template/Publication are references, not duplicated canonical objects;
- outgoing and incoming accountable roles are explicit;
- participant membership never carries active state;
- consent never carries active state;
- Review approval never carries active state;
- publication authority never carries active state;
- invitation codes/secrets never carry;
- target Program starts with reset lifecycle state;
- same normalized input gives the same semantic digest;
- planning is side-effect zero;
- source Program remains unchanged.

Implementation placement when M7 becomes eligible:

1. Reuse existing Program/Quest/closeout primitives in `platform_v2/src/services/guidePrograms.ts`.
2. If adding planner logic to `guidePrograms.ts` would mix unrelated responsibilities, create exactly one file: `platform_v2/src/services/programContinuationPlanner.ts`.
3. Add its focused test beside it.
4. Extend current M7 Product Registry Evals/Requirements only; do not create family-specific duplicate status.
5. Keep `platform_v2/src/productRegistryM7M8.test.ts` as roadmap/registry invariant coverage.

Required test IDs/meaning:

- `family.program_continuation_resets_lifecycle_authority`
- `family.duplicate_delivery_converges_by_idempotency` for the eventual exported projection, not planner-side network delivery
- existing `prop.m7.participant-copy-forbidden`
- existing `prop.m7.consent-copy-forbidden`
- existing incoming-actor fail-closed property
- existing handover retry/idempotency property

## 5. M8 exact output — ProgramOperationalSummary.v1

This is a free operational summary, not a biodiversity report and not participant export.

Canonical application shape:

```ts
type ProgramOperationalSummaryV1 = {
  schema: 'ikimon.program-operational-summary/v1'
  program_reference: string
  program_profile: string
  phase: string
  window_start: string
  window_end: string
  as_of: string
  freshness_state: 'CURRENT' | 'STALE' | 'UNKNOWN'
  record_count: number | null
  review_backlog_count: number | null
  consent_completeness_state: 'COMPLETE' | 'INCOMPLETE' | 'NOT_APPLICABLE' | 'SUPPRESSED' | 'UNKNOWN'
  published_count: number | null
  withdrawn_count: number | null
  handover_readiness_state: 'READY' | 'NOT_READY' | 'SUPPRESSED' | 'UNKNOWN'
  event_count?: number | null
  next_event_at?: string | null
  quest_completion_aggregate?: { completed: number; eligible: number } | null
  publication_references: string[]
  limitations: string[]
}
```

### 5.1 Deterministic field meanings

`record_count`

- count Program-linked contributed Record references active for organizer operational scope at `as_of`;
- withdrawn/deleted/nonexistent Records do not count as active;
- the count never exposes which participant contributed them;
- return null with a limitation when current source cannot determine the set safely.

`review_backlog_count`

- count Program contribution Review items that require organizer/reviewer action and are not in a terminal resolved state at `as_of`;
- do not count private details, only aggregate count;
- return null/UNKNOWN if current Review state cannot be resolved deterministically.

`consent_completeness_state`

- `COMPLETE`: every Record currently eligible for the intended Program publication path has the required applicable rights/consent state;
- `INCOMPLETE`: at least one publication-eligible Record lacks required consent/right state;
- `NOT_APPLICABLE`: current Program has no publication-eligible contribution requiring such consent at `as_of`;
- `SUPPRESSED`: policy prevents reporting an identifying aggregate;
- `UNKNOWN`: source state is missing/conflicted.

`published_count`

- count current Program-result/contribution references actually represented in a public PublicationEdition at `as_of`;
- Review acceptance alone is not publication.

`withdrawn_count`

- count Program-related previously public/eligible contribution/publication references whose current public lifecycle is withdrawn within the reporting window;
- this is operational count only, not a list.

`handover_readiness_state`

- `READY` only when the current M7 planner/requirements can establish all required accountable actors and no mandatory lifecycle-reset prerequisite is unresolved;
- `NOT_READY` when a known required item is unresolved;
- `UNKNOWN` when M7 state is not available enough to decide;
- never infer READY merely because Program is closed.

### 5.2 Privacy suppression

Before emitting any optional aggregate that could reveal an individual in a small cohort or minor context, apply current Program/minor/privacy policy.

The first implementation may use the conservative rule:

- if product-local policy cannot prove the aggregate safe, return `null`/`SUPPRESSED` with a limitation;
- do not invent a numeric cohort threshold in this file.

This deliberately keeps legal/minor policy in the existing policy authority rather than hard-coding a guessed threshold.

### 5.3 Forbidden output

Never emit:

- participant name/email/phone;
- school roster;
- raw media locator;
- participant free text;
- individual exact-location history;
- private/rejected contribution payload;
- taxon/species list, unique taxa count or taxonomic composition;
- participant ranking/score;
- invitation secret;
- organizer auth state.

### 5.4 Implementation placement when M8 becomes eligible

1. Reuse current Program/closeout/recap data owners.
2. Create exactly one builder only if no current service owns this responsibility: `platform_v2/src/services/programOperationalSummary.ts`.
3. Builder takes an explicit `as_of` and resolved governed inputs; it does not query UI caches.
4. Builder is deterministic and side-effect zero.
5. Add focused tests for each field, unknown state and privacy suppression.
6. Add M8 Product Registry Eval bindings to the exact source.

Required fixture IDs:

- `family.program_summary_updates_current_state` — output contract fixture only on ZUKAN side;
- `family.no_participant_pii_in_organizer_summary`;
- `family.program_continuation_resets_lifecycle_authority`;
- `family.no_exact_location_without_destination_policy` where optional Place/location context is later added;
- `family.withdrawn_media_cannot_resurrect_from_cache_export_or_restore` via existing lifecycle tests.

## 6. Thin-link surface

The first visible family integration is not an M11 exchange.

ZUKAN may expose a contextual CTA from an organizer-visible/public Program page:

`NOCOSILで運営を続ける`

Allowed hand-off payload is public reference only:

```text
schema/version marker
public Program locator/reference
public title if safe/needed
return locator
```

Forbidden:

```text
participant identity
invitation code/secret
auth/session token
private organizer note
private Record
exact private location
```

The ZUKAN page does not create NOCOSIL state. It only navigates to NOCOSIL. NOCOSIL independently previews and stores a local reference.

If the current Program surface can generate the deep link without new backend state, implement it in existing Program UI when the paired NOCOSIL reference receiver is source-ready. Do not create a bridge service for this CTA.

## 7. M11 receiver — PublicCandidate.v1

M11 implementation starts only when current registry permits it.

First supported candidate fixture is fixed:

- one adult-owned NOCOSIL regional Record;
- one rights-cleared public-safe image derivative;
- non-person-profile candidate;
- no minor;
- location `COARSENED` unless exact-public policy is independently already proven;
- explicit submitter authorization.

Receiver order:

```text
schema/version validation
→ destination purpose validation
→ idempotency key + payload digest
→ submitter/authority validation
→ rights/consent validation
→ privacy/location validation
→ media derivative validation
→ AI-candidate labels retained
→ create ZUKAN Source/Record/Claim candidate using existing Core semantics
→ return PublicationResult state
```

Unknown field in a public-effect payload fails closed. Do not silently ignore an unsupported semantic field.

Same idempotency key + same semantic digest returns prior/current receipt. Same key + different digest returns conflict and creates no second candidate.

## 8. PublicationResult.v1 mapping

ZUKAN is authoritative for these returned states:

```text
RECEIVED
UNDER_REVIEW
NEEDS_CHANGE
REJECTED
ACCEPTED
PUBLISHED
CORRECTED
WITHDRAWN
EFFECT_UNKNOWN
```

Mapping rules:

- candidate insert/receipt → `RECEIVED`;
- active Review → `UNDER_REVIEW`;
- reviewer requests source/candidate correction → `NEEDS_CHANGE`;
- final review denies eligibility → `REJECTED`;
- eligible/accepted but no public edition yet → `ACCEPTED`;
- public PublicationEdition read-back succeeds → `PUBLISHED`;
- a later edition/supersession reflects a correction → `CORRECTED`;
- public exposure is withdrawn and read back → `WITHDRAWN`;
- external effect may have happened but read-back cannot prove it → `EFFECT_UNKNOWN`.

Never return `PUBLISHED` from source commit, queue receipt, DB row, review acceptance or URL construction alone.

## 9. CorrectionRevocationNotice.v1

When M11 is eligible, support:

```text
corrects
supersedes
restricts
withdraws
```

The destination resolves the current referenced exchange/candidate and applies normal ZUKAN rights/correction/publication lifecycle.

Unknown prior effect is read back before a second mutation attempt.

Withdrawal terminal proof includes public read-back and existing non-resurrection constraints.

## 10. ParticipationCredential.v1

This is not part of ordinary organizer summary and must not be implemented as a participant export by default.

After the organizer loop is staging verified, an eligible participant may explicitly choose:

`この参加実績をNOCOSILに残す`

First output contains only:

- ZUKAN issuer identity;
- Program reference;
- participation/contribution role;
- verified period/state;
- issuance/revocation state;
- optional selected public supporting locator.

Never include personality/talent score, private organizer evaluation, another participant's identity, movement history or recruiting/CRM authority.

## 11. Product Registry projection rules

When each runtime/source slice becomes eligible, add or modify Product Registry entries only in the owning milestone.

M7:

- existing handover Requirements/Evals remain authority;
- do not add `nocosil` as a required dependency to M7 semantics.

M8:

- `quality.zukan.operational-summary.free` owns the free summary acceptance;
- add exact source Eval for privacy-safe ProgramOperationalSummary;
- keep raw portability separate.

M11:

- add receiver/public projection exchange Requirements only when frontier promotes M11;
- bind `PublicCandidate`, `PublicationResult`, idempotency, correction/withdrawal and contract-version fail-closed Evals;
- do not create product-local resolved status fields outside shared Resolver rules.

## 12. Required ZUKAN adversarial tests

Before a family runtime claim, ZUKAN must prove:

- `family.no_private_workspace_search_from_zukan` by contract: no NOCOSIL private query surface exists;
- `family.no_participant_pii_in_organizer_summary`;
- `family.no_exact_location_without_destination_policy`;
- `family.no_minor_credential_without_applicable_authority`;
- `family.site_publish_does_not_imply_zukan_publish` at receiver authority boundary;
- `family.read_access_does_not_imply_cross_product_write`;
- `family.revoked_or_expired_grant_fails_closed` for any signed exchange grant;
- `family.ai_candidate_never_self_promotes_to_public_fact`;
- `family.unknown_field_or_contract_version_fails_closed`;
- `family.duplicate_delivery_converges_by_idempotency`;
- `family.same_idempotency_key_different_payload_conflicts`;
- `family.unknown_effect_is_read_back_before_retry`;
- `family.source_correction_supersedes_projection`;
- `family.withdrawn_media_cannot_resurrect_from_cache_export_or_restore`.

## 13. Done states

This file itself reaches only `DESIGN_READY` when reviewed.

Subsequent slice reporting uses:

- `SOURCE_VERIFIED`
- `STAGING_LIVE_VERIFIED`
- `PRODUCTION_APPROVAL_READY`
- `PRODUCTION_LIVE_VERIFIED`
- `BLOCKED_DEPENDENCY`
- `BLOCKED_PROTECTED_BOUNDARY`
- `SUPERSEDED`

Do not use percentage completion.

## 14. LUNA rule

LUNA does not choose the feature set, fields, privacy model, milestone placement, transport progression or UX copy.

At execution time it may only:

1. fresh-read current source;
2. update stale file locators/SHAs without changing semantics;
3. implement the currently eligible slice exactly as above;
4. run the required tests/QA/read-back;
5. record Evidence and advance only when current Product Registry/Resolver permits it;
6. continue independent safe work when a protected boundary blocks one candidate.
