# ZUKAN クビアカツヤカミキリ見守り — Architecture Review Packet v2

- Date: 2026-07-29
- Status: ready for second external review
- Review type: adversarial architecture / privacy / data / operations review
- No code, DB, migration, staging, production or external-send action is authorized by this packet

## 1. Review objective

前回レビューで検出されたP0/P1を計画正本へ反映した。第二回レビューでは、修正が本当に成立しているか、別の矛盾や既存実装との重複を作っていないかを確認する。

「前回指摘を直したように見える」ことを承認条件にしない。GitHub上の実ファイル、PR topology、main上の既存実装を読み、反証可能な根拠で判定する。

## 2. Repositories and current source of truth

Read latest main first:

- strategy: `yamaki0102/ikimon-business-strategy@main`
- implementation: `yamaki0102/ikimon-platform@main`
- cross-project operations: `yamaki0102/all-projects-management@main`

Review PRs:

- strategy `yamaki0102/ikimon-business-strategy#42`
  - three-layer product architecture and routing safety boundary
- strategy `yamaki0102/ikimon-business-strategy#43`
  - corrected Kubiaka decision
- platform `yamaki0102/ikimon-platform#1489`
  - parent product architecture / shadow envelope
- platform `yamaki0102/ikimon-platform#1491`
  - corrected product spec / area contract / master plan / slice plan
- platform `yamaki0102/ikimon-platform#1492`
  - closed and superseded; inspect only to confirm it cannot be accidentally merged or treated as current

## 3. Required files

Strategy:

- `decisions/2026-07-29-zukan-product-architecture-and-safety-boundary.md`
- `decisions/2026-07-29-zukan-kubiaka-focused-experience.md`

Platform PR #1491:

- `docs/spec/kubiaka-focused-experience/SPEC.md`
- `docs/spec/kubiaka-focused-experience/AREA_COVERAGE.md`
- `docs/spec/kubiaka-focused-experience/IMPLEMENTATION_MASTER_PLAN.md`
- `docs/spec/kubiaka-focused-experience/PLAN.md`

Existing implementation to inspect on main:

- `platform_v2/src/services/alertDispatcher.ts`
- `platform_v2/src/services/invasiveReporting.ts`
- invasive law/status curator and timer paths
- `platform_v2/src/services/mapSnapshot.ts`
- public map privacy / aggregation tests
- `platform_v2/src/services/recordPhotoFeedback.ts`
- current 1–6 photo composer, retry, draft ownership and login return
- event-scoped guest credential / participant promotion
- Foundation v2 PostgreSQL and D1 Survey / Detection / Coverage migrations and adapters
- suppression / correction / erase propagation
- taxon canonical identity usage

## 4. Previous P0 findings and expected correction

### P0-A Existing invasive auto-routing bypass

Expected correction:

- strategy #42 defines deny-by-default interlock
- implementation plan makes an independent safety PR the first runtime step
- law status / AI confidence / Case alone cannot generate delivery for an experience-scoped occurrence

Review:

- Is the proposed interlock located at the correct enforcement layer?
- Can another alert/delivery path bypass it?
- Does it preserve existing unscoped behavior?
- Is Record save/private feedback available while send remains denied?

### P0-B Submitted vs assessed photos

Expected correction:

- `submittedPhotoCount` and `assessedPhotoCount` separated
- assessed count derived from distinct assessed asset IDs
- partial assessment copy is mandatory

Review:

- Can any caller still claim more photos than were assessed?
- Does existing MAX_IMAGES behavior conflict with the spec?
- Are asset validation and feedback provenance sufficient?

### P0-C Public suppression existence oracle

Expected correction:

- public `privacy_suppressed` removed
- empty and suppressed return `no_public_data`
- suppression reasons operator-only

Review:

- Can payload shape, freshness, tile existence, cache metadata or edition timing still reveal suppressed activity?
- Can adjacent-cell or temporal differencing re-identify school/home activity?

### P0-D Record threshold instead of contributor threshold

Expected correction:

- participant and Record thresholds both required
- one participant cannot publish a cell
- raw date/count removed from public payload

Review:

- Is participant identity robust against guest reset / account switching / Sybil behavior?
- Are freshness bands coarse enough?

### P0-E Degenerate target fail-open

Expected correction:

- positive target validation
- zero/NaN/missing/stale denominator fails closed

Review:

- Enumerate malformed config cases and prove none produces `current_target_met`.

### P0-F Shared-device guest viewing

Expected correction:

- default guest view is latest receipt only
- device history requires explicit action
- `use as another person` is persistent
- receipt-scoped claim default

Review:

- Test school/family shared device flows, including browser restore, stale cookies and logout.

### P0-G Linear state model

Expected correction:

- Persistence / Assessment / Feedback / Action axes
- `link_pending`
- Review authority separate

Review:

Prove these combinations are representable without state loss:

1. Record saved, Assessment failed
2. old Feedback published, new Assessment stale/running
3. Feedback published, specialist Review running
4. Action sent, acknowledgement missing
5. Action active, revisit due
6. Record saved, experience link pending

### P0-H Caller boolean creates survey non-detection

Expected correction:

- Foundation v2 SurveyEvent / DetectionOutcome / CoverageAssessment is source of truth
- `partial` cannot satisfy required evidence
- no caller-only protocol boolean

Review:

- Verify PostgreSQL and D1 parity.
- Verify no duplicate non-detection source of truth remains.

### P0-I Case implies specialist authority

Expected correction:

- authority independent from workflow
- `case_opened` alone cannot show `専門確認中`

Review:

- Search all proposed copy/projection paths for implicit authority escalation.

## 5. Architecture questions

1. Is keeping only a TypeScript experience registry plus a common Record-context link the correct abstraction at n=1?
2. Should any proposed `kubiaka_*` object be moved to an existing Foundation/Biodiversity model now?
3. Is `focused_experience_record_links` genuinely domain-neutral, or should even that remain Kubiaka-specific until a second example?
4. Is `link_pending` sufficient, or does the Record save path require stronger transaction coupling?
5. Does extending existing invasive routing create excessive coupling? Propose the smallest enforcement-layer interlock.
6. Does existing suppression machinery cover receipts, FeedbackEdition and ProjectionSnapshot without schema expansion?
7. Is using the existing gridM ladder correct for a Japan pilot and global future?
8. Is yearly/seasonal revisit the correct product cadence rather than weekly retention?
9. Can automated feedback remain sustainable at tens of thousands of daily Records?
10. Which pilot metrics are genuinely required before municipal paid delivery?

## 6. Adversarial scenarios

Review at minimum:

1. School tablet: child A submits, child B opens the experience next.
2. One participant submits daily until Record threshold is exceeded.
3. Record saves but experience link write fails.
4. Six photos submitted, only three reach the assessment model.
5. Assessment fails after an older FeedbackEdition is already published.
6. Model version changes, making the latest assessment stale.
7. Frass candidate backlog waits seven days.
8. Empty cell changes after a school event but remains privacy suppressed.
9. Attacker compares adjacent cells and projection editions.
10. Guest resets identity repeatedly to simulate many participants.
11. Protocol config is missing, zero, NaN or partially renamed.
12. Target-tree ledger is five years old.
13. Recipient consent expires between operator approval and send.
14. Law-status curator updates Aromia-like taxon before Release E.
15. Contributor requests deletion after a public area edition is published.
16. Specialist review starts while automated feedback remains valid.
17. Case is open but no specialist is involved.
18. Assessment service is disabled during a traffic spike.
19. Tens of thousands of normal Records arrive in one day.
20. A second focused experience uses aquatic plants and shares none of the Kubiaka evidence roles.

## 7. Required output

Use this exact structure.

### Verdict

Choose one:

- GO
- GO WITH BLOCKERS
- NO-GO

### Executive summary

Maximum 12 numbered points.

### P0 blockers

For each:

- title
- exact file / symbol / line or PR evidence
- failure scenario
- minimum correction
- consequence if not corrected

### P1 findings

Same evidence standard.

### P2 improvements

Only non-blocking improvements.

### Duplicate / remove / simplify

List objects, routes, tables, abstractions and PRs to remove or defer.

### Corrected architecture

Show:

- source-of-truth mapping
- state axes
- guest/claim boundary
- public map payload and privacy threshold
- routing interlock
- migration objects

### PR disposition

For #42, #43, #1489, #1491 and closed #1492:

- merge
- revise
- split
- supersede
- close

with order and rationale.

### Corrected critical path

Ordered phases and exit criteria.

### Validation matrix

- unit
- integration
- security
- privacy
- migration
- browser
- operations
- model evaluation

### Unverified facts

Clearly separate facts not actually inspected.

### Final recommendation

Name the single next operation.

## 8. Reviewer constraints

- Use GitHub actual state, not pasted assumptions alone.
- Read latest main before PR branches.
- Do not execute production, DB, migration, secret, DNS, permission, deletion or external-send mutations.
- Do not infer tests are green from PR descriptions.
- Do not accept a design merely because previous findings are mentioned.
- Prefer existing platform models when semantics truly match; reject reuse by semantic abuse.

## 9. Ready-to-use review prompt

Review the ZUKAN Kubiaka focused experience plan as an adversarial principal architect, privacy engineer and operations reviewer.

Start by reading the latest main of:

- yamaki0102/ikimon-business-strategy
- yamaki0102/ikimon-platform
- yamaki0102/all-projects-management

Then inspect strategy PRs #42 and #43, platform PRs #1489 and #1491, and closed/superseded #1492. Read `docs/reviews/2026-07-29-kubiaka-focused-experience-architecture-review-v2.md` in #1491 and all files it requires. Verify the existing implementations named in that packet, especially invasive auto-routing, public map privacy, photo assessment limits, guest/shared-device handling, Foundation v2 Survey/Detection/Coverage, suppression propagation and taxon identity.

The first review found P0 issues. Do not assume they are fixed because the new plan mentions them. Attempt to break each correction with concrete code paths and adversarial scenarios. Identify duplicate models, premature abstractions and PR topology problems.

Return the exact Required output structure from the packet. Work read-only. Do not change code, DB, migrations, staging, production or external systems.
