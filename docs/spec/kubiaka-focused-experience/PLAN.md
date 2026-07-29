# ZUKAN クビアカツヤカミキリ Focused Experience — Implementation Plan

- Status: active plan
- Contract: `SPEC.md`
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
- `docs/spec/kubiaka-focused-experience/PLAN.md`
- `docs/START_HERE.md`
- `PROJECT.json`

Exit:

- source-of-truth links are reachable
- parent product architecture is explicit
- route, state, privacy, ownership, and non-goals are fixed

### Slice 2 — Experience registry and pure read models

Add:

- `src/services/focusedExperienceRegistry.ts`
- `src/services/kubiakaExperience.ts`
- `src/services/kubiakaReadModels.ts`
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
- privacy-safe area counters

Exit:

- no route or DB write yet
- deterministic tests
- no current behavior change

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

Proposed D1 compatibility/runtime equivalents only where the active runtime requires them.

Key rules:

- additive only
- opaque IDs
- tenant and experience scope
- append-only feedback editions
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

A separate operation approves and executes external send.

Exit:

- no single action both confirms and sends
- audit trail complete
- recipient consent expiry fails closed

### Slice 10 — Privacy-safe area view

Start with aggregate coverage, not a detection map.

Inputs:

- aggregate cell or approved Place group
- record count
- repeat count
- evidence quality distribution
- review state

Public output:

- no Record IDs
- no exact coordinates
- no school/home/private land exposure
- percentages only with explicit denominator

Exit:

- public map privacy contract tests green
- false impression of completeness avoided

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
- seasonal content expiry
- recipient consent
- public aggregation

### Persistence

- migrations
- cross-dialect semantic fixtures
- claim transaction
- append-only feedback
- idempotency
- rollback
- tenant isolation

### Route and security

- guest/session matrices
- receipt bearer isolation
- CSRF / same-origin mutation
- login return
- no-store private responses
- cache separation
- suppression

### Browser

- guest landing→save→receipt
- guest save→login→claim→member detail
- member save→dedicated detail
- feedback view
- more evidence
- logout/shared device
- public area privacy

### Visual

- 320, 375x667, 390, 412, 768, 1024, 1280, 1440, 1536
- text 200%
- reduced motion
- image missing / slow
- AI pending / failed / unavailable
- long Japanese copy

### Accessibility

- keyboard
- screen reader order
- labels
- focus return after photo add/remove
- non-color status
- touch target size

## 5. Observability

Required operational evidence:

- save success/failure
- assessment queue age
- feedback ready age
- more-evidence response
- claim success/failure
- route send/acknowledge
- suppression propagation
- public projection freshness

No raw media, exact location, free text, receipt token, or child identity in analytics.

## 6. Release gates

### Source gate

- typecheck
- focused tests
- full Node tests
- Worker parity tests where changed
- build
- secret scan
- security review
- diff scope review

### Staging gate

- exact SHA
- runtime identity
- migration dry-run and apply evidence if needed
- guest/member browser QA
- mobile/desktop visual QA
- real image upload
- login return and claim
- feedback state transitions
- public location privacy

### Production gate

Requires explicit approval for:

- production deploy
- PostgreSQL / D1 migration
- secret
- recipient routing
- external send
- public dataset or findings

Production promotion must preserve exact source identity and rollback evidence.

## 7. Initial PR stack

Recommended ordered stack:

1. specification and pointers
2. registry and read models
3. shell and public static routes
4. scoped composer and return path
5. additive persistence
6. guest receipt and claim
7. member workspace
8. assessment and feedback
9. operator review
10. public area coverage
11. routing and Case
12. external standards/publication

Each PR should be reviewable, keep current runtime behavior unchanged outside the explicit scope, and state whether it changes DB, runtime, external send, or public projection.

## 8. Stop conditions

Stop before staging or production when any of the following is unresolved:

- ownership isolation
- duplicate Record risk
- receipt token exposure
- unknown-sensitive public media
- exact location leak
- AI authority overclaim
- absence overclaim
- recipient consent missing or expired
- migration rollback unavailable
- current ZUKAN upload regression
- dedicated experience cannot return through login
- public area denominator is undefined but presented as coverage percentage
