# ZUKAN Profile Horizon — Product-local Projection

- Status: `CANONICAL PRODUCT-LOCAL PROJECTION` after merge
- Date: 2026-09-01
- Upstream roadmap authority: `yamaki0102/ikimon-business-strategy/decisions/2026-09-01-zukan-broad-product-roadmap-v2.md`
- Product architecture authority: `docs/spec/zukan-product-architecture/SPEC.md`
- Delivery projection: `platform_v2/product-registry/delivery.json`

## Purpose

This document prevents the successful biodiversity and observation-event implementations from silently narrowing the ZUKAN product.

ZUKAN is a regional knowledge and participation product. Biodiversity is one Domain Pack. `観察会` is one Program profile.

The common cores are reused across multiple regional experiences and publications. A new municipal program, contest, tourism initiative or publication does not automatically get a new backend, database, auth system or canonical Place model.

## Reusable layers

### Knowledge Core

- Record
- Claim / ClaimRevision
- Place / Entity / Subject identity
- Source / Evidence
- Rights / Consent
- Review / Correction
- Publication / PublicationEdition

### Program Core

- Program
- Event
- Quest
- participant / team
- contribution
- consent / visibility
- Review
- recap
- handover

### Program Profiles

Program Profile is configuration and product contract over the shared Program Core.

Initial horizon:

1. `observation_event` — current proven M6 profile
2. `photo_contest`
3. `sketch_drawing_event`
4. `mission_town_walk`
5. `stamp_rally`
6. `children_citizen_editorial`
7. `tourism_regional_engagement`

No profile may weaken Record identity, privacy, consent, Review, correction, publication history or portability.

### Publication Profiles

Initial horizon:

- regional/theme encyclopedia
- tourism map / guide / route
- history / culture collection
- facility / shop / organization collection
- consented people/profile encyclopedia
- Program/campaign result page
- standard paper/PDF manifest
- API/dataset projection

Standard Views remain separate from paid custom production.

### Source / Exchange Profiles

- municipal open data
- government / DMO / tourism-association sources
- PDF / Web / paper/map SourceEditions
- school/company/community Publisher sources
- selected NOCOSIL public-safe candidates
- explicit external Publisher correction/write-back paths

## M9 — Regional Program Profiles

### Outcome

A school, municipality, company, DMO/tourism organization or community group can run different participatory regional programs without ZUKAN becoming an observation-event-only product.

### Profile contracts

#### Photo Contest

Use Record submission + purpose-specific rights + organizer Review + selected Publication.

Required boundaries:

- ordinary public display and promotional reuse are separate rights
- rejected/private entries stay private
- withdrawal/correction remains possible according to the Program policy
- public voting is optional, not a core requirement
- likes/rankings do not become canonical truth

#### Sketch / Drawing Event

Artwork media is a Record. School/minor/guardian consent remains fail-closed. The Program may connect the artwork to a theme or Place and publish only reviewed/authorized selections.

#### Mission / Town Walk / Stamp Rally

Reuse Quest + Place + Record/check-in evidence. Continuous precise-location tracking is not required. QR, bounded check-in or Record evidence may be used depending on the concrete Program. Reward/coupon operation is a separate optional lane.

#### Children / Citizen Editorial

Reuse team + Quest + Source/Place investigation + Record + staff/teacher Review + selected Publication.

#### Tourism / Regional Engagement

Support routes, Places, stories, missions, visitor/resident participation, selected Records, multilingual Publication where justified, and operational evidence such as participation, circulation, continuation and publication.

The product may support outcomes commonly sought by tourism/regional-revitalization funding—deeper local understanding, circulation, repeat engagement, content renewal and local collaboration—but must not hard-code one subsidy scheme as a domain model.

### Required M9 fixtures before executor activation

- `municipal_photo_contest_with_selected_publication`
- `school_sketch_event_with_guardian_consent_and_withdrawal`
- `tourism_place_quest_without_continuous_location_tracking`
- `children_editorial_program_with_staff_review`
- `same_record_reused_by_program_and_regional_view_without_duplication`
- `promotional_media_rights_are_separate_from_standard_public_display`

## M10 — Regional Publication Profiles

### Outcome

The same governed source truth can be composed into different audience-specific regional outputs without copying it into new content silos.

### People/profile boundary

A person may appear in a ZUKAN Publication only through an accountable rights basis, such as explicit subject consent or a Publisher-authorized public role/profile.

Allowed examples include a consenting shop owner, producer, craftsperson, guide, researcher, student project participant or other regional actor whose public profile is intentionally published.

Forbidden:

- face/biometric identification
- scraping unknown people into a person registry
- inferring private identity from a photograph
- default publication of private contact/location data
- irreversible profile publication without correction/withdrawal

Person-profile Claims retain Source/Evidence/Review and PublicationEdition history.

## M11 — Source & Public Projection Exchange

### Outcome

ZUKAN can safely receive selected regional information from multiple Publishers and exchange explicitly selected public-safe information with NOCOSIL while keeping canonical/private domains separate.

### NOCOSIL bridge

Canonical flow:

`NOCOSIL private/source truth -> explicit selected public-safe projection -> exchange package -> ZUKAN Source/Record/Claim candidate -> ZUKAN rights/review/publication -> returned versioned public locator/status`

Rules:

- NOCOSIL owns its private Current State/source truth.
- ZUKAN owns ZUKAN publication eligibility/state after exchange.
- no raw private auto-publication
- no shared giant database
- no common abstraction built first merely because both products use Record/Evidence concepts
- revocation/correction must be representable across the boundary
- external receipt/acceptance must not be invented

## M12 — Professional & Managed Outcomes

Repeated real demand may become paid output/support without making the free product incomplete.

Candidate outcomes:

- specialist/guaranteed reports
- biodiversity/taxon inventory where appropriate
- expert/official review and QA
- custom tourism/campaign/LP/booklet/print production
- rights/data preparation
- facilitation / field operation
- integration / managed operation / FDE / SLA
- coupon/promotion operation where evidence justifies it

Billing/checkout is not the first implementation. First standardize request, scope, rights readiness, output and delivery evidence.

## Rolling frontier

Current projection after M6 production verification:

- `ACTIVE`: M7 Program Continuity & Handover
- `READY_NEXT`: M8 Operational Summary & Raw Portability
- `SHAPED_NEXT`: M9 Regional Program Profiles
- M10–M12: dependency-shaped only
- M5: deferred

No M9–M12 implementation Task is executor-eligible merely because the milestone exists.

## Anti-drift acceptance

A roadmap or implementation plan is invalid if it:

- defines ZUKAN as a biodiversity/species observation product
- treats `観察会` as the only Program type
- makes Observation the parent type for unrelated regional Records
- injects species/taxon fields into generic Program/Profile contracts
- creates a municipality/customer-specific core for a photo contest, stamp rally or publication
- adds person identification/tracking
- auto-publishes private NOCOSIL information
- moves custom production responsibilities into truth/safety semantics
- activates M5 due only to sequence/rank

## Product breadth test

The same foundation should be able to support, without product-forking:

- biodiversity observation event
- municipal photo contest
- school sketch/editorial activity
- tourism/town-walk mission
- regional history/culture View
- rights-safe people encyclopedia
- facility/shop regional guide
- selected NOCOSIL public projection
- professional paid output

while preserving provenance, time, rights, Review, correction, PublicationEdition and portability.
