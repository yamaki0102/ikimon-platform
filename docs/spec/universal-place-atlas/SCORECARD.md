# Universal Place Atlas 100-point scorecard

Assessed: 2026-07-23 JST

Candidate SHA: `22f98f596109d2b0617c29b6e1c7c3797bed6e4e`

Status: `BLOCKED_ACCESS`

`READY_100` is prohibited because the exact SHA has not reached staging,
physical Android/iOS proof is unavailable, staging p95 is unmeasured, and
production verification is not approved or performed.

## Score

| Category | Score | Evidence | Deduction |
| --- | ---: | --- | --- |
| A. Generic area recognition and identity | 15/15 | `placeDomain.test.ts`, `placeRegistry.test.ts`, `namedAreaOsm.test.ts`, canary seed reports | none in local/contract scope |
| B. Historic Record membership and reuse | 15/15 | `recordPlaceBackfill.test.ts`, `staging-backfill-dry-run.json`, public-contract privacy tests | none in dry-run/contract scope |
| C. Regional atlas content | 12/15 | `placeAtlasContent.test.ts`, public-memory Worker tests, deterministic theme backfill | real deployed facilities/history/activity/Memory content is not staging-proven |
| D. Search, map, and UI | 10/12 | `placeRegistryApi.test.ts`, `mapPlaceAtlasProfile.test.ts`, local E2E and screenshots | real staging hierarchy and facility-boundary interaction not proven |
| E. Facility rules and privacy | 12/12 | `PRIVACY_REVIEW.md`, policy/domain/API/UI tests, restricted screenshot | none in local/contract scope |
| F. Data integrity and provenance | 10/10 | additive migrations, fresh/existing/replay/forward-rollback evidence | none in migration rehearsal scope |
| G. Performance and resilience | 6/8 | cache/outage/geometry/bind/partial/parity tests, `PERFORMANCE_AND_RESILIENCE.md` | staging p50/p95/error rate and real Worker CPU profile missing |
| H. Real-environment QA | 4/8 | production baseline, live OSM/official-source audit, local Chromium/WebKit/Firefox six-width matrix | exact-SHA staging, physical Android, physical iOS, deployed canary QA missing |
| I. Operations and evidence | 3/5 | spec/ADR/rollout/rollback, #1421–#1431, W-review raw/adoption | staging receipt absent; production gate not reached |
| **Total** | **87/100** | reproducible local/shadow evidence | no unexecuted check counted green |

## A. Generic area recognition and identity

Verified locally:

- generic named polygon discovery covers park, school, nature area, theme park,
  mall/commercial, museum, zoo, aquarium, stadium/sports, resort, market, farm,
  worship/cultural/public/event and other named areas;
- source and kind are separate;
- source references merge OSM way/relation and managed fields under a stable
  internal Place;
- display-name precedence is separate from Japanese/English/brand/old-name
  aliases;
- merge, supersede and source-ref uniqueness are audited;
- 常盤/常磐 resolves to one canonical Place;
- overlapping mall and retail polygons dedupe while parking and single stores
  are excluded from the parent candidate.

## B. Historic Record membership and reuse

Verified locally and in a read-only staging/shadow data dry-run:

- source Record rows are not changed;
- one Record is counted once independently of its Occurrence count;
- one Record can have confirmed/candidate membership in multiple hierarchy
  levels;
- exact internal position drives membership and public projection omits it;
- uncertainty, edge and overlapping siblings remain candidates;
- stale calculated memberships retire on re-evaluation while human-reviewed
  corrections/removals remain authoritative;
- replay is idempotent and re-entry restores the calculated membership.

Dry-run: 94 Records / 255 Occurrences / 85 matched / 70 confirmed /
15 candidates / 9 outside. See `evidence/staging-backfill-dry-run.json`.

## C. Regional atlas content

Implemented and unit/integration verified:

- deterministic Record themes with provenance, confidence, rule/model version,
  accepted/rejected/provisional state and correction contract;
- non-biological scenery, daily-life, facility, activity, history,
  audio/visual and insight themes without synthetic Occurrences;
- sourced facilities, activities and stories;
- public Place Memory requires explicit opt-in, approval, public Record and
  public-ready media, and omits contributor identity;
- private/owner-only memory is excluded;
- missing data remains a gap rather than a fabricated zero or generated claim.

Deduction remains because these content lanes have not been verified against
the deployed exact-SHA staging canaries.

## D. Search, map and UI

Local E2E proves six widths in Chromium, WebKit and Firefox, mobile peek/full,
desktop panel, loading/partial/empty/suppressed/error, image fallback,
keyboard/focus, reduced motion, back/close recovery and no horizontal overflow.
Search returns name, kind, locality, verification and canonical alias results.

Recursive-ready children/relationship APIs exist, but real nested facility
zones are intentionally not invented and have not been staging-proven.

## E. Facility rules and privacy

Verified contracts keep browsing independent from recording permission.
Unknown mall/theme-park rules default to `check_rules`; OSM `access=yes` never
becomes photography permission. `customers_only`, `permission_required`,
`prohibited` and restricted/school CTA suppression are covered. Public APIs
omit exact coordinates, private Records, private Memory and contributor lists.
Images require privacy-verified derivatives; WebP EXIF/XMP chunks remain
blocked.

## F. Data integrity and provenance

All Place objects carry source/confidence. Source precedence, manual override
without provenance loss, theme provenance, merge/supersede audit, idempotent
backfill and evidence-preserving forward rollback are tested. D1 migration
`0068` passes fresh, existing, replay and forward-rollback rehearsal. No real
staging or production D1 mutation was performed.

## G. Performance and resilience

TTL/negative cache, bounded Overpass attempts/timeouts, lazy profile fetch,
AbortController/sequence guard, hole/MultiPolygon handling, D1 bind chunking,
1,000-vertex request-time budget, 500-row snapshot cap, outage fallback and
Node/Worker contract parity are covered. Oversized work returns honest
`partial`, not false zero.

Staging p50/p95/error-rate and real Worker CPU samples are missing because
deployment was blocked before runtime verification.

## H. Real-environment QA

- production before-change baseline: 常磐公園 profile shows 23 Records;
- live OSM/official-source audit: 常磐公園 way `125727939`, JUNGLIA way
  `1281984233`, AEON Hamamatsu Ichino way `189307274`, Shitoro way
  `189307792`;
- local canary/browser fixtures cover alias, theme park, mall dedupe,
  restricted Place and public-cell fallback;
- 375/390/768/1024/1280/1536 and Chromium/WebKit/Firefox are green locally.

No physical Android/iOS was available. WebKit is not represented as real iOS.

## I. Operations and evidence

Specification, ADR, migrations, rollout, forward rollback, privacy,
performance, backfill, Visual QA and review-adoption evidence are committed.
Parent/child Issues and five stacked Draft PRs exist. Evaluator migration
baseline was updated and validated.

The central command bus resolved `ikimon-life`, confirmed zero active leases,
then rejected dry-run before issuing an operation ID with
`oauth_mutation_authorization_expired`. See `STAGING_ATTEMPT_2026-07-23.md`.
No direct Wrangler bypass, production mutation, secret change or DB apply was
performed.
