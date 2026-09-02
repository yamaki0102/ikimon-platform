# Area Encyclopedia Growth & Stewardship Contract

Status: `OWNER-ADOPTED / CANONICAL PRODUCT DESIGN`
Date: 2026-09-02 JST
Applies to: ZUKAN Place / Area public pages, especially `/community/fields/:fieldId`
Upstream: `docs/spec/zukan-product-architecture/SPEC.md`, `docs/spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md`
Related: `docs/design/area_encyclopedia_album_memory_spec_2026-05-23.md`

## Outcome

An Area Encyclopedia must be useful and inviting at every data maturity level without hand-building a static page for each Place. One improvement to the shared renderer should improve all Places.

The page is a governed projection of Place/Field truth, Records, Sources, Programs and approved steward/editorial data. Place-specific facts are data, not bespoke page code.

## 1. Missing-data rule

Do not render empty metrics, empty cards, `準備中`, `集約条件待ち`, zero-value dashboards, or internal processing explanations merely to preserve a fixed layout.

If a section has no user-value-bearing data, hide the section. Safety/rights state may still be shown when materially needed, but it must not dominate the public experience.

## 2. Growth states

Use deterministic data maturity to choose what is visible.

- `0 public Records`: show the Place hero, truthful available Source/Place facts, a clear `この図鑑の育て方` affordance, capture CTA, and nearby/related Places when available. Do not fabricate species, season or local facts.
- `1 public Record`: the first Record becomes a prominent proof that the encyclopedia has started. Show a concise expectation such as `最初の記録が入りました。次の記録で、この場所の違いが見えてきます。` and a next-record CTA.
- `2–9 public Records`: show recent Records / found items and the next useful contribution. Avoid pretending that thin data proves a seasonal trend.
- `10+ public Records`: progressively enable richer album/season/revisit views only when the required evidence exists.
- Higher-order change/watch claims remain evidence-gated; quantity alone does not authorize a claim.

Thresholds may be revised by evidence, but empty-state suppression and `first Record creates visible value` are stable product rules.

## 3. How the page grows

A visitor must be able to understand, without internal terminology, what can make more information appear.

Public contribution guidance may explain that the page grows through:

1. Records made at this Place: photo, audio, video or memo where currently supported and rights-safe;
2. repeated Records across time/seasons;
3. reviewed/authorized Place information and official Sources;
4. Programs/activities connected to the Place;
5. approved steward/editorial information when that capability is available.

Only actions that are currently usable may be rendered as active CTAs. Planned capabilities must be labeled as not yet available; never render a fake working editor or submission path.

## 4. Stewardship / manager model

Reuse the existing Field/Place identity, `field_managers` authorization foundation and public-profile policy. Do not create a customer-specific CMS or a parallel Place database.

Current source foundation includes manager roles and public-profile states, but the public Area Encyclopedia does not yet provide a complete normal-user steward editor for arbitrary managed Places. Treat that editor as `NOT IMPLEMENTED` until a real authenticated Journey proves otherwise.

Target bounded editor responsibility:

- `owner` / authorized `steward`: propose or edit safe presentation facts such as summary, tags, public official links, public actors/roles, public spot descriptions and guide/editorial material;
- `viewer_exact`: must not gain editorial write authority merely from exact-location access;
- verification level, manager grants, exact/sensitive geometry, rights and safety policy remain separate governed responsibilities;
- edits retain provenance, reviewer/actor identity, version/correction history and withdrawal/correction semantics;
- public publication remains explicit and rights-safe.

Do not make the basic Area page depend on this future editor. Records and safe Sources must already let the page grow.

## 5. Nearby / related Place fallback

When local content is thin, nearby or related Places are a valid public discovery fallback if they can be derived safely from existing Place truth.

- clearly label them as separate Places; never imply their Records occurred in the current Place;
- prefer existing safe nearby-Field/Place discovery rather than copying nearby Records into the current encyclopedia;
- use distance/region/category only at public-safe precision;
- hide the section if no useful nearby result exists.

This fallback is especially useful at `0–9` Records and should reduce dead-end pages without contaminating Place truth.

## 6. Presentation priority

Public priority is:

`Place identity -> visible real Record/media value -> what can be discovered next -> participation/contribution -> contextual Source/trust -> detailed safety/evidence`

Internal terms such as `Site Intelligence`, `source record`, `geometry`, aggregation readiness and database/pipeline state are not ordinary public copy.

## 7. Reusable renderer acceptance

Prove the shared implementation with at least these fixtures:

1. `zero_record_ordinary_place`: no empty dashboard; contribution/growth explanation + nearby fallback where available;
2. `one_record_place`: first Record visibly changes the page and creates expectation for the second;
3. `thin_place_2_to_9`: recent real Records shown; unsupported trend claims hidden;
4. `mature_place`: richer season/revisit sections appear only with evidence;
5. `managed_place_without_editor`: public page remains useful and tells a manager what is currently possible without fake controls;
6. `managed_place_with_steward`: authorized steward sees only the edit surface allowed by role; public result remains review/rights governed;
7. `nearby_fallback`: nearby Places are clearly separate and never contribute false local Records;
8. `sensitive_record`: sensitive location/content remains minimized even while the Place page itself can show a safe public Place location where policy allows.

Use at least one facility/park, one ordinary low-data Place, and one mature Place fixture. No Place-specific rendering fork is allowed merely to make a fixture pass.

## Roadmap interpretation

This contract refines the existing Area/Place experience and does not by itself activate M10 or M11.

- adaptive empty/thin/first-Record rendering and nearby fallback are shared Place UX work over existing capabilities;
- the bounded steward editor is a missing Place stewardship capability and should reuse existing manager/profile foundations rather than wait for a bespoke Publication CMS;
- M10 later composes broader Publication Profiles;
- M11 later adds external Publisher/source exchange and correction/write-back adapters.

Implementation authority and current frontier remain owned by Product Registry / the shared status resolver. This document authorizes product meaning, not production mutation.
