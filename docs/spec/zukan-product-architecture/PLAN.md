# ZUKAN Product Architecture — Implementation Plan

- Status: active plan
- Contract: `SPEC.md`
- Broad profile projection: `PROFILE_HORIZON.md`
- Strategy decision: `yamaki0102/ikimon-business-strategy/decisions/2026-09-01-zukan-broad-product-roadmap-v2.md`

## Goal

Keep ZUKAN's implementation roadmap aligned with the adopted product definition: regional knowledge and participation across nature, history, culture, facilities, shops, people with explicit publication consent, documents, photos, activities and Publisher sources.

Biodiversity is one Domain Pack. Observation Event / `観察会` is one Program profile. Neither is the product boundary.

## Current verified foundation

The Product Registry / shared Resolver owns current implementation status. The roadmap meaning is:

1. M1 — Personal Record/media integrity
2. M2 — Safe Publication + rights/data lifecycle
3. M3 — Program/Event/Quest/Workspace collaboration
4. M4 — Regional knowledge / PublicationEdition / portability / correction
5. M5 — Live-camera POC (`deferred`)
6. M6 — Self-Serve Program Activation; the production implementation proves the observation-event Program profile
7. M7 — Program Continuity & Handover
8. M8 — Operational Summary & Raw Portability
9. M9 — Regional Program Profiles
10. M10 — Regional Publication Profiles
11. M11 — Source & Public Projection Exchange
12. M12 — Professional & Managed Outcomes

M5 remains deferred until real demand and authorized source evidence make it more valuable than the current frontier.

## Rolling frontier

Current product-planning projection after M6 production verification:

- `ACTIVE`: M7 Program Continuity & Handover
- `READY_NEXT`: M8 Operational Summary & Raw Portability
- `SHAPED_NEXT`: M9 Regional Program Profiles
- M10–M12: dependency-shaped only
- M5: deferred

Only one executor implementation Task may be active at a time. Later milestone design may progress without creating executor-eligible Tasks.

## M7 — Program Continuity & Handover

Keep the existing executor-ready design direction:

- source/target Program provenance
- outgoing/incoming responsible actor
- selected Place / Record / Quest / template refs
- participant / consent / Review / publication approval reset
- canonical Place/Record identity reuse without duplication
- retry/idempotency

First source slice remains a side-effect-zero deterministic handover planner and fixtures. DB/UI work follows only after the planner contract is verified.

## M8 — Operational Summary & Raw Portability

### M8-A Free OperationalActivitySummary

Allowed operational information includes participant/team/activity, Quest progress, Record/Place counts, Review distribution, visibility, consent completeness, continuation and Publication references.

The free summary must not silently become a biodiversity/taxon derived report.

### M8-B RawRecordPortabilityArchive

Preserve Record granularity, source/media refs, user input, time, Place/location policy, consent, visibility, Review, provenance/history and withdrawal state.

Do not reuse a research/taxonomy export as the raw portability contract.

## M9 — Regional Program Profiles

Do not build separate products for each activity. Add reusable profiles over the shared Program Core.

Initial profile horizon:

- current observation event
- photo contest
- sketch/drawing event
- mission/town walk
- stamp rally
- children/citizen editorial program
- tourism/regional-engagement program

M9 implementation does not start until M7/M8 frontier conditions permit it. Before executor activation, the fixtures and rights boundaries in `PROFILE_HORIZON.md` must be represented in the Product Registry / Eval contract.

The first selected profile should be the smallest reusable vertical slice backed by real demand, not the one with the most features.

## M10 — Regional Publication Profiles

Compose the same governed source truth into multiple Views/Publications:

- regional/theme encyclopedia
- tourism map/guide/route
- history/culture collection
- facility/shop/organization collection
- rights-safe people/profile encyclopedia
- Program/campaign result page
- standard paper/PDF manifest
- API/dataset projection

Do not duplicate source truth into publication-specific databases.

People/profile publication requires an explicit rights basis and must never introduce face identification or tracking.

## M11 — Source & Public Projection Exchange

Support Publisher/source exchange through bounded adapters and explicit rights/review state.

Source horizon:

- municipal open data
- government/DMO/tourism-association sources
- PDF/Web/paper editions
- school/company/community Publisher sources
- selected NOCOSIL public-safe projection packages

NOCOSIL and ZUKAN remain separate canonical domains. The exchange is projection/package based, not a shared database or automatic private publication path.

## M12 — Professional & Managed Outcomes

Convert repeated demand into paid outputs/support without gating ordinary participation, Record truth, Review or standard Publication.

Candidate lanes:

- specialist/guaranteed reports
- expert/official review
- custom campaign/LP/booklet/print production
- rights/data preparation
- facilitation/field operation
- integration/managed operation/FDE/SLA
- coupon/promotion operation when evidence justifies it

Do not build billing SaaS before a recurring output workflow exists.

## Product breadth fixtures

The roadmap must preserve a path for all of the following without a customer-specific Core:

1. biodiversity observation event
2. municipal photo contest
3. school sketch/editorial activity
4. tourism/town-walk mission or stamp rally
5. regional history/culture View
6. facility/shop guide
7. rights-safe people encyclopedia
8. selected NOCOSIL public projection
9. professional paid output

## Anti-drift rules

Reject changes that:

- define ZUKAN as a biodiversity/species observation product
- treat `観察会` as the only Program type
- reuse taxon/Occurrence/Identification semantics as generic domain objects
- make person identification/tracking a product capability
- auto-publish NOCOSIL/private information
- create a municipality-specific database/auth/Place model for a Program profile
- promote M5 because of rank alone

## Verification

Product Registry changes must continue to pass:

```bash
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify_zukan_product_registry.ps1
```

Roadmap validation additionally must assert:

- M1–M12 stable ordering
- M5 remains deferred
- M9 is the shaped-next broad Program-profile milestone
- M10 includes publication breadth and people-profile safety
- M11 preserves NOCOSIL/source authority boundaries
- M12 remains demand-gated and does not redefine free-core truth
- no executor Task exists for M9–M12 before frontier promotion

## Production boundary

This plan does not authorize any production mutation, DB migration, secret/IAM change, billing activation or external/customer send.
