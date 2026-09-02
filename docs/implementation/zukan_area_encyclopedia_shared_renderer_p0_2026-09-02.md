# ZUKAN Area Encyclopedia Shared Renderer P0

Status: `OWNER-ADOPTED / P0 EXECUTION CONTRACT`
Date: 2026-09-02 JST
Priority: temporarily occupies the single executor implementation slot before further M7 implementation. M7 remains the active roadmap milestone; this is an App Experience / UX Quality correction, not a new milestone.

Canonical inputs:
- `docs/design/area_encyclopedia_growth_and_stewardship_contract_2026-09-02.md`
- `docs/design/area_encyclopedia_album_memory_spec_2026-05-23.md`
- `docs/implementation/zukan_ryuyo_core_nearby_context_contract_2026-09-02.md`
- `docs/spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md`
- `docs/spec/zukan-product-architecture/SPEC.md`
- `operations/ai_os/noah_operating_contract.md` from `yamaki0102/all-projects-management`

## Outcome

Make `/community/fields/:fieldId` a reusable Area Encyclopedia that becomes visibly useful from the first public Record, hides no-value data, guides contribution, and offers nearby discovery without any Place-specific static page fork.

The same P0 MUST also satisfy the fixed Ryuyo `core + nearby context` contract. Ryuyo is an acceptance fixture/configured publication behavior over shared primitives, not a separate renderer.

## Required shared behavior

1. **No-value suppression**: hide empty metrics/cards, zero dashboards, unsupported trends, `準備中`, `集約条件待ち`, `Site Intelligence`, `source record`, `geometry` and other internal/pipeline copy from ordinary public UI.
2. **0 public Records**: show Place identity, only truthful available Place/Source facts, working `このエリアで記録する`, compact `この図鑑の育て方`, and safe nearby/related Places when available. Do not fabricate local species/season facts.
3. **1 public Record**: make that Record/media the main visible proof. Copy meaning: `最初の記録が入りました。次の記録で、この場所の違いが見えてきます。` Add a working next-record CTA.
4. **2–9 public Records**: show recent/found Records and useful next contribution; hide unsupported season/change claims.
5. **10+**: progressively reuse existing album/season/revisit/change surfaces only when their evidence gates are satisfied.
6. **Growth guidance**: explain that Records, repeated visits, authorized Place/official information and connected Programs can grow the page. Render only currently usable actions as CTAs.
7. **Manager/steward truth**: the complete normal-user Place editor is `NOT IMPLEMENTED`. Do not fake it. A compact manager/related-party note may explain that future bounded editing will cover summary/tags/official links/actors/spots/guides using existing `field_managers`; implementing that editor is NOT part of this P0.
8. **Nearby Place fallback**: show separate nearby/related Places from existing safe Place/Field truth. Never copy their Records into the current Place or imply they occurred here. Hide the section when no useful result exists.
9. **Safety**: preserve current rights, publication, sensitive-location and viewer-exact boundaries. Do not weaken location minimization to improve presentation.
10. **Visual direction**: media/editorial first, restrained cards, ZUKAN green/white/warm neutral, mobile-first. Avoid generic SaaS dashboard layout and nested card grids.

## Ryuyo fixed extension

Implement `docs/implementation/zukan_ryuyo_core_nearby_context_contract_2026-09-02.md` in this same P0.

Fixed product semantics:

- core geometry = OSM way `530835577` polygon;
- core Records may receive canonical Ryuyo field membership, feed core aggregates and `ryuyo-insect-park` publication eligibility;
- outside polygon but boundary distance `<=300m` = nearby context only;
- nearby MUST NOT receive Ryuyo `resolved_field_ids`, MUST NOT affect core aggregates and MUST NOT enter `ryuyo-insect-park` publication feed;
- nearby is read-time classification after a DB query prebounded to the Ryuyo bbox + ~300m; global-latest-then-filter is forbidden;
- renderer returns/displays core and nearby separately as `園内の新着` and `周辺で見つかったもの`, newest-first, hiding empty sections;
- reuse existing `/api/v1/map/observations`; no Ryuyo-specific map pipeline;
- classification must not increase public coordinate precision or weaken existing sensitive/risk/withdrawal rules.

Do not confuse this `nearby context Records` concept with the generic `nearby Places` fallback. Both may coexist while keeping canonical Place truth separate.

## Implementation constraints

- Trace the actual current `zukan.earth` field-detail runtime path/readmodel and modify the shared active implementation; do not improve only an inactive renderer.
- Reuse existing `AreaPlaceSnapshot`, `AreaEncyclopediaPayload`, Field/Place identity, nearby-field discovery, `resolveFieldsForPoint` semantics, existing geometry helpers, current capture route and current public-map pipeline where valid.
- Do not modify normal write-time field resolution just to create Ryuyo nearby context.
- Do not create a Ryu-yo-specific renderer, hard-coded facility page, new CMS, new Place database, new auth model, new map pipeline or new generic engine.
- Ryu-yo field `372eafbd-ea9c-4b2f-ab5f-434b81b928b2` is a real acceptance fixture, not a static-page special case.
- Preserve existing deep links and navigation semantics.

## Required fixtures / acceptance

Shared renderer:
- `zero_record_ordinary_place`: no empty dashboard; growth guidance + capture + nearby Place fallback when available.
- `one_record_place`: first media is prominent and page visibly changes from zero state.
- `thin_place_2_to_9`: recent real Records; no unsupported trend claims.
- `mature_place`: richer existing sections appear only with evidence.
- `nearby_fallback`: separate Place identity and no Record contamination.
- `sensitive_record`: no rights/location regression.

Ryuyo:
- `ryuyo_inside_polygon_core`: inside OSM way `530835577` -> core.
- `ryuyo_outside_30m_nearby`: outside, boundary distance ~30m -> nearby.
- `ryuyo_outside_300m_nearby`: outside, boundary distance <=300m -> nearby.
- `ryuyo_outside_over_300m`: >300m -> not in Ryuyo Area Encyclopedia.
- `ryuyo_nearby_no_membership`: nearby never adds Ryuyo to `resolved_field_ids`.
- `ryuyo_nearby_no_core_aggregate`: nearby does not affect core observation/species/effort counts.
- `ryuyo_nearby_no_external_feed`: nearby does not enter `ryuyo-insect-park` feed.
- `ryuyo_map_reuse`: public/safe core + nearby are visible through existing `/api/v1/map/observations` without a new map pipeline.
- `ryuyo_sensitive_location`: classification does not increase public coordinate precision.

Browser QA: focused real-browser evidence at `375px` and `1280px` for zero/one-record shared states and Ryuyo with suitable core/nearby fixture state. Confirm `園内の新着` and `周辺で見つかったもの`, no horizontal overflow, clipped CTA or nested-dashboard presentation.

## Done

- Shared source implementation + focused regression tests PASS.
- Ryuyo geometry classification + non-contamination tests PASS.
- No Place-specific page fork or new map pipeline.
- PR created with exact source SHA.
- Exact-source staging is `LIVE_VERIFIED` for shared fixtures, Ryuyo core/nearby presentation and existing-map visibility.
- Evidence records source identity, fixture coordinates/classifications, core/nearby separation, feed/aggregate non-contamination and browser widths.
- Production mutation is not authorized by this contract. Prepare promotion to the existing protected boundary; use production only if an already-valid exact-source owner approval independently covers it.
- Do not continue M7 implementation in the same mutable lane until this P0 reaches staging `LIVE_VERIFIED` or a concrete blocker is recorded.