# ZUKAN Area Encyclopedia Shared Renderer P0

Status: `OWNER-ADOPTED / P0 EXECUTION CONTRACT`
Date: 2026-09-02 JST
Priority: temporarily occupies the single executor implementation slot before further M7 implementation. M7 remains the active roadmap milestone; this is an App Experience / UX Quality correction, not a new milestone.

Canonical inputs:
- `docs/design/area_encyclopedia_growth_and_stewardship_contract_2026-09-02.md`
- `docs/design/area_encyclopedia_album_memory_spec_2026-05-23.md`
- `docs/spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md`
- `docs/spec/zukan-product-architecture/SPEC.md`
- `operations/ai_os/noah_operating_contract.md` from `yamaki0102/all-projects-management`

## Outcome

Make `/community/fields/:fieldId` a reusable Area Encyclopedia that becomes visibly useful from the first public Record, hides no-value data, guides contribution, and offers nearby Place discovery without any Place-specific static page fork.

## Required shared behavior

1. **No-value suppression**: hide empty metrics/cards, zero dashboards, unsupported trends, `準備中`, `集約条件待ち`, `Site Intelligence`, `source record`, `geometry` and other internal/pipeline copy from ordinary public UI.
2. **0 public Records**: show Place identity, only truthful available Place/Source facts, working `このエリアで記録する`, compact `この図鑑の育て方`, and safe nearby/related Places when available. Do not fabricate local species/season facts.
3. **1 public Record**: make that Record/media the main visible proof. Copy meaning: `最初の記録が入りました。次の記録で、この場所の違いが見えてきます。` Add a working next-record CTA.
4. **2–9 public Records**: show recent/found Records and useful next contribution; hide unsupported season/change claims.
5. **10+**: progressively reuse existing album/season/revisit/change surfaces only when their evidence gates are satisfied.
6. **Growth guidance**: explain that Records, repeated visits, authorized Place/official information and connected Programs can grow the page. Render only currently usable actions as CTAs.
7. **Manager/steward truth**: the complete normal-user Place editor is `NOT IMPLEMENTED`. Do not fake it. A compact manager/related-party note may explain that future bounded editing will cover summary/tags/official links/actors/spots/guides using existing `field_managers`; implementing that editor is NOT part of this P0.
8. **Nearby fallback**: show separate nearby/related Places from existing safe Place/Field truth. Never copy their Records into the current Place or imply they occurred here. Hide the section when no useful result exists.
9. **Safety**: preserve current rights, publication, sensitive-location and viewer-exact boundaries. Do not weaken location minimization to improve presentation.
10. **Visual direction**: media/editorial first, restrained cards, ZUKAN green/white/warm neutral, mobile-first. Avoid generic SaaS dashboard layout and nested card grids.

## Implementation constraints

- Trace the actual current `zukan.earth` field-detail runtime path/readmodel and modify the shared active implementation; do not improve only an inactive renderer.
- Reuse existing `AreaPlaceSnapshot`, `AreaEncyclopediaPayload`, Field/Place identity, nearby-field discovery and current capture route where valid.
- Do not create a Ryu-yo-specific renderer, hard-coded facility content, new CMS, new Place database, new auth model or new generic engine.
- Ryu-yo field `372eafbd-ea9c-4b2f-ab5f-434b81b928b2` is a real zero/thin-data acceptance fixture, not a special case.
- Preserve existing deep links and navigation semantics.

## Required fixtures / acceptance

- `zero_record_ordinary_place`: no empty dashboard; growth guidance + capture + nearby when available.
- `one_record_place`: first media is prominent and page visibly changes from zero state.
- `thin_place_2_to_9`: recent real Records; no unsupported trend claims.
- `mature_place`: richer existing sections appear only with evidence.
- `nearby_fallback`: separate Place identity and no Record contamination.
- `sensitive_record`: no rights/location regression.
- `ryuyo_zero_or_current_truth`: current Ryu-yo page uses the shared rules and contains no internal/pipeline vocabulary.

Browser QA: focused real-browser evidence at 375px and 1280px for zero/one-record states plus current Ryu-yo truth; no horizontal overflow, clipped CTA or nested-dashboard presentation.

## Done

- Shared source implementation + focused regression tests PASS.
- No Place-specific page fork.
- PR created with exact source SHA.
- Exact-source staging is `LIVE_VERIFIED` for the required fixtures and Ryu-yo current truth.
- Evidence records source identity, fixture state and browser widths.
- Production mutation is not authorized by this contract. Prepare promotion to the existing protected boundary; use production only if an already-valid exact-source owner approval independently covers it.
- Do not continue M7 implementation in the same mutable lane until this P0 reaches staging `LIVE_VERIFIED` or a concrete blocker is recorded.