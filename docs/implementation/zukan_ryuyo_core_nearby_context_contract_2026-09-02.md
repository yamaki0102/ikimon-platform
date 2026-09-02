# ZUKAN Ryuyo Core + Nearby Context Contract

Status: `OWNER-ADOPTED / CANONICAL PRODUCT DECISION`
Date: 2026-09-02 JST
Applies to: Ryuyo Insect Nature Observation Park Area Encyclopedia and its publication projection
Parent P0: `docs/implementation/zukan_area_encyclopedia_shared_renderer_p0_2026-09-02.md`

## Outcome

Render the Ryuyo Area Encyclopedia as `core + nearby context` without weakening canonical Place membership, publication truth, map safety or reusable shared-renderer architecture.

This is a fixed product decision. Executors implement and verify it; they do not redesign the boundary.

## Identifiers

- ZUKAN field: `372eafbd-ea9c-4b2f-ab5f-434b81b928b2`
- canonical core geometry: OSM way `530835577` polygon
- publication target: `ryuyo-insect-park`
- nearby boundary distance: polygon exterior to polygon boundary `<= 300m`

If the OSM geometry or publication target is not yet materialized in current source/runtime, add or bind the minimum required source truth. Do not substitute a hand-drawn static page boundary.

## Core

A public-safe Record is `core` only when its observation point is inside the OSM way `530835577` polygon.

Core Records:

- may have canonical Ryuyo field membership under the existing field-resolution rules;
- appear in `園内の新着` in newest-first order;
- contribute to Ryuyo in-park observation/species and other evidence-gated core aggregates;
- are eligible for the `ryuyo-insect-park` publication feed when existing publication/rights rules allow;
- remain subject to all existing Record, Review, rights, withdrawal and location-minimization rules.

## Nearby context

A public-safe Record is `nearby` only when:

- it is outside the core polygon; and
- its minimum distance to the polygon boundary is greater than `0m` and `<= 300m`.

Nearby Records:

- are read-time contextual projection only;
- MUST NOT receive permanent Ryuyo field membership;
- MUST NOT add the Ryuyo field ID to `visits.resolved_field_ids`;
- MUST NOT contribute to Ryuyo core observation/species/effort/change aggregates;
- MUST NOT enter the `ryuyo-insect-park` external publication feed;
- may appear only in the Area Encyclopedia section `周辺で見つかったもの`, newest-first;
- remain Records of their actual canonical Place/field context, if any.

A Record farther than `300m` from the polygon boundary is neither Ryuyo core nor Ryuyo nearby context.

## Query and classification

Nearby classification is read-time geometry-distance logic. Do not alter the normal write-time `resolveFieldsForPoint` semantics merely to create nearby context.

Required query order:

1. derive the Ryuyo polygon bbox;
2. expand the candidate DB query to approximately the polygon bbox + 300m public-context margin;
3. query only that bounded candidate set using indexed/coarse coordinate predicates available in the current schema;
4. classify candidates in application/geometry logic as `core`, `nearby`, or `outside`;
5. apply existing public/safe/withdrawal/location projection rules before returning visible items;
6. return `core` and `nearby` as explicitly separate collections/contracts.

Forbidden:

- fetch global/latest Records and filter them afterward;
- write nearby membership into `resolved_field_ids`;
- merge nearby items into `AreaPlaceSnapshot` core aggregates as if they occurred in the park;
- infer core membership from a 300m radius around the park center;
- expose exact private/sensitive coordinates in UI or API solely to support classification.

Reuse existing geometry helpers and bounded-query patterns where possible. Add only the minimum polygon-boundary distance helper/adapter missing from current source.

## Map

Reuse the existing `/api/v1/map/observations` pipeline.

Acceptance:

- public/safe core Records remain visible on the normal ZUKAN map according to existing map rules;
- public/safe nearby Records also remain visible on the normal ZUKAN map according to their own safe projected coordinates;
- no Ryuyo-specific map endpoint, layer, ingestion pipeline or parallel public-map snapshot is created;
- map visibility does not imply Ryuyo field membership or Ryuyo publication-feed eligibility.

## Privacy and rights

Preserve all existing public-location, sensitive-species/content, risk, Review, withdrawal/deletion and visibility rules.

Exact observation coordinates may be used internally for authorized geometry classification when current policy/runtime permits, but this contract grants no new UI/API exposure of exact coordinates.

The core Place itself may use its approved public Place geometry/location policy; Record-level sensitivity remains independent.

## Renderer

Use the shared Area Encyclopedia renderer. Ryuyo is a fixture/configured publication behavior, not a separate page implementation.

When data exists, order the relevant Record sections as:

1. `園内の新着` — core only;
2. `周辺で見つかったもの` — nearby only.

Hide either section when it has no visible Records. The generic first-Record/growth-state contract still applies to core Records. Nearby Records alone do not pretend that the park itself has a first core Record.

Nearby Place discovery from the generic P0 may coexist below these sections; do not confuse `nearby Places` with `nearby context Records`.

## Required fixtures

- `ryuyo_inside_polygon_core`: point inside OSM way `530835577` -> `core`.
- `ryuyo_outside_30m_nearby`: outside polygon, boundary distance ~30m -> `nearby`.
- `ryuyo_outside_300m_nearby`: outside polygon, boundary distance <=300m -> `nearby`.
- `ryuyo_outside_over_300m`: boundary distance >300m -> excluded from Ryuyo Area Encyclopedia.
- `ryuyo_nearby_no_membership`: nearby classification never adds Ryuyo to `resolved_field_ids`.
- `ryuyo_nearby_no_core_aggregate`: nearby does not alter core observation/species/effort counts.
- `ryuyo_nearby_no_external_feed`: nearby never enters `ryuyo-insect-park` feed.
- `ryuyo_map_reuse`: public/safe core and nearby fixtures appear through existing `/api/v1/map/observations` without a new map pipeline.
- `ryuyo_sensitive_location`: classification does not increase public coordinate precision.

## Browser acceptance

At `375px` and `1280px`, with suitable fixture data:

- `園内の新着` shows only core Records, newest-first;
- `周辺で見つかったもの` shows only nearby Records, newest-first;
- empty sections are absent;
- no horizontal overflow/clipped CTA;
- no internal membership/distance/debug terminology is shown to ordinary users.

## Done

This contract is complete only when source tests prove geometry classification and non-contamination, staging proves the shared renderer sections and normal map reuse, and Evidence binds the result to exact source SHA and fixture coordinates/classifications.

Production mutation remains subject to the existing protected release boundary.