# ZUKAN クビアカツヤカミキリ Focused Experience — Implementation Plan

- Status: active plan
- Contract: `SPEC.md`
- Area coverage contract: `AREA_COVERAGE.md`
- Strategy: `yamaki0102/ikimon-business-strategy#43`
- Parent platform PR: `#1489`

## 0. Goal

Implement the first Focused Experience without duplicating ZUKAN accounts, Records, assets, Places, rights, or review history.

The first releasable slice must support:

- public landing
- guest and member 1–6 photo submission
- immediate save / delayed feedback
- private guest receipt
- transactional guest→account claim
- dedicated member Home and Record detail
- evidence coverage and feedback projection
- privacy-safe public area summary

External routing, specialist SLA, production deployment, and public findings are separate gates.

## 1. Reuse map

Reuse first:

- current `/record` upload, draft, retry, MIME, EXIF, place and visibility behavior
- current auth session and login return handling
- current member Home/read-model primitives
- current observation detail media and AI provenance
- current immersive shell controls
- event-scoped guest credential and promotion patterns
- current invasive species catalog and recipient selection logic
- current location privacy, sensitive contexts, correction and suppression

Do not reuse by semantic abuse:

- time-bounded Observation Event as a perpetual program
- event participant tables as the canonical Kubiaka model
- generic `confirmed` flag for AI, reviewer, specialist, and recipient
- invasive notification send state as contributor feedback state

## 2. Ordered slices

### Slice 1 — Active product contract

Files:

- `docs/spec/kubiaka-focused-experience/SPEC.md`
- `docs/spec/kubiaka-focused-experience/AREA_COVERAGE.md`
- `docs/spec/kubiaka-focused-experience/PLAN.md`
- `docs/START_HERE.md`
- `PROJECT.json`

Exit:

- source-of-truth links are reachable
- parent product architecture is explicit
- route, state, privacy, ownership, non-goals, and area coverage claim boundary are fixed

### Slice 2 — Experience registry and pure read models

Add:

- `src/services/focusedExperienceRegistry.ts`
- `src/services/kubiakaExperience.ts`
- `src/services/kubiakaReadModels.ts`
- `src/services/kubiakaAreaCoverage.ts`
- tests

Registry contract:

```ts
interface FocusedExperienceDefinition {
  experienceKey: string;
  canonicalPath: string;
  title: LocalizedText;
  taxonId?: string;
  protocolProfile: string;
  protocolVersion: string;
  seasonalContentVersion: string;
  shell: "focused";
  publicAreaPrecision: string;
  enabled: boolean;
}
```

Pure read models:

- landing content
- member continuation priority
- contributor-facing state
- evidence coverage summary
- feedback edition
- privacy-safe area coverage classification
- explicit-denominator percentage boundary
- stale/revisit projection

Exit:

- no route or DB write yet
- deterministic tests
- no current behavior change
- Record count alone cannot satisfy an area target
- public area state never implies species absence

### Slice 3 — Dedicated shell and public routes

Add or update:

- `src/siteMap.ts`
- `src/ui/siteShell.ts`
- `src/ui/kubiakaShell.ts`
- `src/routes/kubiaka.routes.ts`
- localized content contracts
- visual tests

Routes:

- `/kubiaka`
- `/kubiaka/guide`
- `/kubiaka/about`
- `/kubiaka/faq`
- placeholder privacy-safe `/kubiaka/area`

Exit:

- final copy rendered
- one dominant CTA
- ZUKAN brand preserved
- dedicated mobile navigation
- no exact location or unverified detections
- no DB migration

### Slice 4 — Shared composer context

Reuse the current `/record` composer through an explicit scoped route or controller, not a forked uploader.

Preferred route:

- `/kubiaka/record`

Required changes:

- experience context injected server-side
- login return path preserved
- post-save destination scoped
- common draft owner partition retained
- global launcher hidden
- existing upload/retry/security behavior unchanged

A durable context link is required. Query string alone is insufficient.

Exit:

- guest and member save through the same underlying Record path
- one to six images accepted
- save is independent of AI
- experience context round-trips through retry and login

### Slice 5 — Additive persistence

A migration is required for durable scoped ownership and feedback. Do not hide the contract in free-text JSON only.

Proposed PostgreSQL entities:

1. `focused_experiences`
2. `focused_experience_record_links`
3. `focused_experience_participants`
4. `focused_experience_guest_receipts`
5. `focused_experience_assessments`
6. `focused_experience_feedback_editions`
7. `focused_experience_routing_events`
8. `focused_experience_area_projection_editions`

Proposed D1 compatibility/runtime equivalents only where the active runtime requires them.

Key rules:

- additive only
- opaque IDs
- tenant and experience scope
- append-only feedback editions
- immutable/versioned area projection editions
- hashed guest secrets
- idempotency keys
- explicit authority level
- sent and acknowledged routing states separated
- no duplicate Record or asset
- foreign keys or equivalent integrity checks
- suppression and erase event compatibility

Before apply:

- migration review
- backup and rollback plan
- staging apply
- cross-dialect fixture
- exact-SHA evidence
- no production apply without explicit approval

### Slice 6 — Guest receipt and claim

Generalize the merged event reference implementation into an experience-scoped credential.

Add:

- `focusedExperienceGuestCredential.ts`
- `focusedExperienceParticipantAccess.ts`
- receipt routes and read models
- transactional claim
- Node / Worker parity tests where applicable

Required tests:

- guest A/B isolation
- account A/B isolation
- stale cookie
- replay
- claim merge
- partial failure rollback
- idempotent repeat
- logout and shared device
- receipt metadata privacy

Exit:

- guest can see saved state and feedback
- account claim creates no duplicate
- guest mutation access is invalidated after claim

### Slice 7 — Dedicated member workspace

Routes:

- `/kubiaka/me`
- `/kubiaka/me/records`
- `/kubiaka/records/:recordId`
- `/kubiaka/places/:placeId`
- `/kubiaka/settings`

Reuse common read-model primitives but create dedicated projections.

Member continuation priority:

1. unread feedback
2. more evidence request
3. assessment in progress
4. comparable Place revisit
5. first submission

Exit:

- scoped login and post-save actions return to dedicated pages
- unrelated ZUKAN records do not dominate the view
- one primary continuation
- owner location and notes remain private

### Slice 8 — Evidence coverage and feedback generation

Add:

- coverage vocabulary and classifier
- model/rule provenance
- contributor feedback builder
- reviewer override and edition publisher
- random audit sampling for no-clear-sign assessments

Do not require a new model call for every page render. Persist assessment and feedback editions.

Feedback generation gate:

- original evidence saved
- model/rule version allowed
- limitations rendered
- authority label correct
- sensitive content filtered

Exit:

- the contributor receives concrete scope, finding, unknowns, and next options
- no absence overclaim
- AI and human authority separated

### Slice 9 — Operator review

Routes:

- `/ops/kubiaka/inbox`
- `/ops/kubiaka/records/:recordId`
- `/ops/kubiaka/cases`
- `/ops/kubiaka/coverage`
- `/ops/kubiaka/config`

First operator capabilities:

- review evidence coverage
- accept/edit feedback
- request more photos
- reject candidate
- escalate to specialist
- propose routing
- inspect raw/deduplicated area counts
- inspect coverage denominator source and freshness
- inspect privacy suppression and stale cells

A separate operation approves and executes external send.

Exit:

- no single action both confirms and sends
- audit trail complete
- recipient consent expiry fails closed

### Slice 10 — Privacy-safe area view

Start with aggregate coverage, not a detection map. Implement `AREA_COVERAGE.md` as the active contract.

Inputs:

- aggregate cell or approved Place group
- Record and photo count
- `screenable_record` and `survey_usable` count
- unique survey days
- unique observed units and repeat units
- latest relevant observation time
- known denominator only when source and scope are explicit
- protocol version and target thresholds
- public privacy threshold

Public output:

- `no_observations`
- `privacy_suppressed`
- `more_observation_useful`
- `observation_progressing`
- `current_target_met`
- `revisit_due`
- no Record IDs
- no exact coordinates
- no school/home/private land exposure
- percentages only with explicit denominator
- one concrete missing condition or next action per selected area

Exit:

- public map privacy contract tests green
- Record count alone cannot create `current_target_met`
- normal photos and survey-usable records remain separate
- distinct days, repeat units, and freshness affect state
- stale cells return to `revisit_due`
- denominator-free cells expose no coverage percentage
- false impression of completeness or species absence is avoided
- map-equivalent accessible area list exists

### Slice 11 — Routing and Case

Do not begin until approved recipients exist.

Required registry:

- recipient identity
- geography
- taxon or issue scope
- purpose
- allowed data
- consent start and expiry
- operational owner
- acknowledgement mechanism

Flow:

```text
Assessment/Review
→ routing candidate
→ operator approval
→ idempotent send
→ sent
→ acknowledged or failed
→ Case follow-up
→ result returned as a new Record
```

No recipient means no send. Generate official-contact guidance only from verified current sources.

### Slice 12 — Standards and publication

After real data and review quality are proven:

- versioned protocol
- model card
- Darwin Core Event / Humboldt mapping
- rights-safe dataset edition
- annual technical report
- external publication gate

## 3. Content implementation

Store fixed and seasonal content separately.

Fixed:

- H1 and lead
- safety
- feedback promise
- privacy
- FAQ

Seasonal:

- current signs to look for
- revisit suggestion
- emphasis banner

Each seasonal claim requires:

- source URL or SourceEdition reference
- reviewed date
- geographic applicability
- content version
- expiry or review date

Do not hard-code a one-year date into the canonical page title or route.

## 4. Test matrix

### Unit / contract

- registry
- route resolution
- state projection
- feedback authority
- coverage classification
- area coverage classification
- area freshness and revisit state
- known-denominator percentage boundary
- privacy suppression
- seasonal content expiry
- recipient consent
- public aggregation

### Persistence

- migrations
- cross-dialect semantic fixtures
- claim transaction
- append-only feedback
- immutable area projection editions
- idempotency
- rollback
- tenant isolation

### Security and privacy

- guest credential entropy and digest storage
- cookie flags and scope
- receipt authorization
- no token in URL or analytics
- cross-user isolation
- minor/shared-device defaults
- exact location redaction
- public metadata and link-preview leakage
- aggregate-cell minimum threshold and neighbor merge

### Browser / UX

- guest landing→record→receipt
- guest receipt→login→claim→member detail
- member record→dedicated Home
- feedback ready
- more evidence
- no-clear-sign limitation copy
- candidate awaiting specialist
- public area map default coverage layer
- selected area shows condition gaps and one CTA
- accessible non-map area list parity
- mobile widths 320 / 375 / 390 / 412
- tablet 768
- notebook 1024
- desktop 1280 / 1440
- wide 1536
- text 200%
- keyboard and screen reader order
- no horizontal overflow

### Runtime parity

Where current writes or reads occur in Node and Worker:

- context persistence
- guest access
- claim
- receipt
- state projection
- public area suppression
- area coverage classification or shared materialized result
- no duplicate path-specific behavior

## 5. Staging gate

Before any production request:

1. parent PRs merged in order
2. exact source SHA fixed
3. migrations reviewed but production unapplied
4. staging backup and migration apply
5. fixtures and rollback rehearsal
6. Node / Worker parity
7. guest/member E2E
8. actual 1–6 photo uploads
9. delayed assessment simulation
10. feedback edition publication
11. public area privacy test with sparse and dense cells
12. area target, stale revisit, and denominator-free states verified
13. mobile and accessibility QA
14. security review
15. operator runbook rehearsal
16. runtime identity evidence

## 6. Production boundary

Explicit approval is required for:

- production migration
- production deploy
- secret changes
- recipient registration
- external notification
- public aggregate findings
- public area projection based on live data
- partner or municipality naming

Launch may proceed without external routing if copy accurately states that records are stored and checked but are not automatically sent.

## 7. Stop conditions

Stop and return to design if:

- guest receipt can be guessed or leaked
- guest claim duplicates or misattributes a Record
- focused pages lose the original Record or rights boundary
- AI result is shown as specialist confirmation
- free-form upload becomes a scientific absence claim
- public map leaks exact or inferable sensitive location
- public map implies completeness without a denominator
- raw Record volume can satisfy the area target
- a fresh casual photo incorrectly resets stale survey coverage
- external send is possible without approved recipient and operator gate
- summer content becomes the permanent product identity
- the implementation forks the uploader or account system
