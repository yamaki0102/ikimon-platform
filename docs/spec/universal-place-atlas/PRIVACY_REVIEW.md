# Universal Place Atlas privacy and facility-policy review

Generated: 2026-07-23 JST

## Decision

Local implementation review: **no open P0/P1 found**.

Production remains closed until staging evidence and the central production
approval gate are both green.

## Trust boundaries

1. Membership calculation uses internal exact coordinates only in the
   backfill/runtime calculation boundary.
2. Public Place APIs return canonical Place identity, safe geometry, aggregate
   counts, and place/zone/cell precision. They do not return source Record
   coordinates.
3. One Record is counted once even when it contains multiple Occurrences.
4. Ambiguous overlaps, approximate boundaries, and boundary-edge uncertainty
   produce candidate membership instead of confirmed membership.
5. A Record may belong to Place, Zone, and administrative parents while one
   meaningful, reviewed membership is primary.

## Facility policy

- Place visibility and recording permission are separate fields.
- OSM `access=yes` is never converted into photography permission.
- Unverified venues default to `check_rules`.
- `customers_only`, `permission_required`, and `prohibited` are distinct
  policy states.
- Schools and restricted/private areas suppress the direct recording CTA while
  preserving browse access when the Place profile itself is public.
- Official rule links are rendered only as sourced external links; user memory
  and official/curated facts remain separate.

## Public Place Memory

Place Atlas accepts a memory only when all of the following are true:

- explicit public opt-in;
- moderation state is approved;
- attached Record is publicly eligible;
- public-ready media requirements are satisfied;
- no sensitivity suppression applies.

Owner-only/private memory remains excluded. Contributor identifiers are not
projected into the public Place profile; anonymous attribution is the default.

## Media

- imported `/derived/import/.../display.webp` paths are normalized through the
  canonical derived transform;
- responsive `srcset` and bounded width are generated centrally;
- query strings and fragments cannot bypass path validation;
- public derivative readiness remains a data gate;
- image failures render a visible fallback instead of an empty block;
- existing Worker checks reject WebP EXIF/XMP metadata and malformed WebP.

## Regression evidence

- Node: 1,403/1,403 tests passed;
- Worker: 397/397 tests passed;
- school/restricted CTA browser checks passed in Chromium, WebKit, and Firefox;
- exact-coordinate and contributor-identity leakage tests passed;
- private Place Memory exclusion and opt-in moderation tests passed;
- public-cell fallback tests passed.

## Remaining review boundary

Staging must confirm real D1 policy rows, public API projections, and canary
profiles. Physical-device privacy presentation is not verified. Production D1
migration/backfill and production rollout are approval-bound operations.
