# Universal Place Atlas independent review packet

Review mode: read-only, defensive product/architecture/privacy review.

Repository: `yamaki0102/ikimon-platform`

Parent issue: #1421

Stacked Draft PRs: #1427, #1428, #1429, #1430, #1431

## Objective

Evaluate the implementation that expands Place Atlas from park/school area
profiles into a general regional-atlas foundation for theme parks, shopping
malls, cultural/tourism facilities, farms, event venues, and other named areas.

The experience must let a person discover a Place, understand its safe
boundary and provenance, reuse historic Records without reposting, browse
non-biological regional themes, respect facility/privacy rules, and contribute
without exposing exact locations or private memory.

## Canonical review inputs

- `SPEC.md`
- `ADR-0002-canonical-place-registry.md`
- `CURRENT_AUDIT.md`
- `SCORECARD.md`
- `ROLLOUT.md`
- `PRIVACY_REVIEW.md`
- `PERFORMANCE_AND_RESILIENCE.md`
- `TEST_AND_VISUAL_QA.md`
- `platform_v2/src/services/placeDomain.ts`
- `platform_v2/src/services/placeRegistry.ts`
- `platform_v2/src/services/recordPlaceBackfill.ts`
- `platform_v2/src/services/placeAtlasProfile.ts`
- `platform_v2/cloudflare_shadow/src/placeAtlasProfileNative.ts`
- `platform_v2/cloudflare_shadow/migrations/observations/0068_universal_place_atlas.sql`
- `platform_v2/src/ui/mapPlaceAtlasProfile.ts`
- `platform_v2/src/ui/mapExplorer.ts`

## Evidence already produced

- Node: 1,403 passed, 0 failed.
- Worker: 397 passed, 0 failed.
- Chromium/WebKit/Firefox local E2E: 28 passed, 2 declared skips,
  0 failed.
- Six viewport widths: 375, 390, 768, 1024, 1280, 1536.
- Fresh/existing D1, seed replay, forward rollback: passed.
- Staging Worker bundle dry-run: passed.
- Historic staging/shadow read-only dry-run: 94 unique Records,
  255 Occurrences, 85 matched, 70 confirmed memberships, 15 candidates,
  9 outside all boundaries.

No production migration, backfill, or deployment has been performed.

## Reconciliation

Raw review outputs and the Japanese adoption record are preserved under:

`operations/ai_os/external_review_evidence/2026-07/universal-place-atlas-1421/20260723-232412/`

Gemini's stale-membership, Worker geometry CPU, snapshot cap, and media-path
allowlist findings were adopted and fixed. Claude could not read the target
source and its zero-byte/EXIF claims were disproved from target-SHA Git blobs;
that lane is retained as limited evidence rather than a valid code audit.

## Required review focus

Classify findings as P0/P1/P2 and provide concrete file/contract evidence.

1. GIS:
   Polygon/MultiPolygon holes, relation/way dedupe, mall+retail overlap,
   boundary edge, GPS uncertainty, gigantic geometry, hierarchy.
2. Identity:
   stable internal IDs, aliases, multilingual names, OSM replacement,
   merge/supersede audit, source/kind separation.
3. Privacy and facility policy:
   exact coordinates, school/children, private land, sensitive places,
   public Place Memory opt-in/moderation, contributor identity, official vs
   user content, browse vs photography/record permission.
4. Record correctness:
   Record vs Occurrence count, multiple Place membership, ambiguous
   candidates, idempotency, correction/removal, source Record immutability.
5. Migration and rollback:
   expand-first, fail-closed defaults, replay, evidence-preserving forward
   rollback, production approval boundary.
6. OSM/runtime resilience:
   cache/negative cache, timeout, external outage, Node/Worker parity,
   bounded geometry and D1 binds.
7. Media:
   imported derivatives, path validation, responsive transform, EXIF/XMP,
   fallback, staging/production storage differences.
8. Mobile/desktop UX:
   map remains primary, Place profile hierarchy, CTA suppression, empty/error
   states, fixed UI overlap, keyboard/focus/reduced motion.
9. Performance/observability:
   profile/search timing, cache signals, false-empty contradiction, image
   errors, meaningful staging p95 evidence.

Do not infer that a test passed unless it is listed in the evidence. Do not
recommend exposing exact location, weakening fail-closed defaults, bypassing
review queues, or using GitHub Actions as a deploy backend.

## Questions to answer

1. Is there any P0 or P1 that blocks staging deployment?
2. Which requirements appear implemented but insufficiently proven?
3. Are any tests likely to be false-positive or miss a critical edge case?
4. What is the smallest safe fix for each adopted issue?
5. Which recommendations should be deferred because they expand scope or
   require production approval?
