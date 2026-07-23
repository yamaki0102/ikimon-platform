# Universal Place Atlas specification

Status: implementation

Parent issue: #1421

Base SHA: `e0f424c6424e04c27c662899f170e54a4a00b1cf`

## 1. Goal

Place Atlas is a place-first regional atlas. A visitor can find a named place,
understand its supported boundary, reuse already-public Records that belong to
it, browse sourced regional knowledge, and decide whether a new public Record
is appropriate without exposing exact coordinates or private memory.

The domain is not limited to parks and schools. It supports:

- `park`
- `school`
- `nature_area`
- `theme_park`
- `shopping_mall`
- `commercial_complex`
- `museum`
- `zoo`
- `aquarium`
- `stadium`
- `sports_facility`
- `resort`
- `market`
- `farm`
- `temple_shrine`
- `cultural_facility`
- `public_facility`
- `event_venue`
- `neighborhood`
- `administrative_area`
- `other_named_area`

Unknown tags stay `other_named_area` or unverified. They are never coerced to a
similar kind merely to make the UI look complete.

## 2. Existing assets and responsibility

The implementation expands existing assets instead of creating a parallel CMS.

| Existing asset | Kept responsibility | New relationship |
| --- | --- | --- |
| PostgreSQL `places` | stable place row for legacy and current visits | expanded into the canonical identity root |
| PostgreSQL `place_boundaries` | stored boundary geometry | expanded with source, confidence, validity, precision, version, and validation state |
| `observation_fields` / field profile | administrator or registry supplied field and public profile | a `PlaceSourceReference`; it is not the canonical place identity |
| OSM way/relation | discoverable public map evidence | a replaceable `PlaceSourceReference` and versioned boundary |
| `observations` / `visits` | source Record with internal exact point | linked through multi-valued `RecordPlaceMembership`; source rows are unchanged |
| Place Memory | owner memory and privacy controls | only explicit, moderated public opt-in may enter a public place profile |
| Guide/rally/event data | existing activity sources | linked as sourced place content; no duplicated event CMS |
| Place Atlas v1 | stable public read contract | retained through a v1 adapter while v2 carries identity, policy, hierarchy, and provenance |

Cloudflare D1 receives a contract-compatible projection because the production
map is Cloudflare native. PostgreSQL remains compatible with the current
platform and migration tooling.

## 3. Place domain contract

### 3.1 PlaceEntity

- stable internal `place_id`; never an OSM ID
- canonical display name and normalized search name
- aliases and multilingual names
- `place_kind`
- verification status
- public profile status
- official/unofficial status
- optional primary boundary
- source references
- optional superseding place
- created/updated timestamps

An external source can disappear, split, or change ID without changing
`place_id`. Resolution first matches an existing source reference, then aliases
and locality, then geometry. A new internal ID is allocated only if no existing
entity is a safe match.

### 3.2 PlaceBoundary

- Polygon or MultiPolygon with inner holes preserved
- source reference
- confidence
- valid from/to
- exact or approximate precision
- monotonic version
- optional superseding boundary
- validation state
- primary flag

Invalid, oversized, or incomplete geometry is stored only as rejected or
candidate evidence and is never used to confirm Record membership.

### 3.3 PlaceSourceReference

Supported source types include:

- OSM way/relation
- official facility page
- municipality/open data
- IKIMON observation field
- administrator verification
- user proposal

`source_type` and `place_kind` are independent. Source precedence is:

1. IKIMON administrator verification backed by an official/municipal source
2. current official facility or municipal publication
3. certified IKIMON observation field
4. current OSM object
5. moderated user proposal
6. unverified inference

A higher-precedence correction does not delete lower-precedence evidence.

### 3.4 PlaceRelationship

Relationships are recursive and are not limited to one level:

- `parent`
- `child`
- `contains`
- `part_of`
- `overlaps`
- `replaces`
- `same_as_candidate`

The public hierarchy is typically Place → Zone → Spot, but APIs and storage do
not assume a fixed depth.

### 3.5 RecordPlaceMembership

- Record ID and place ID
- `confirmed`, `candidate`, `corrected`, or `removed`
- `inside`, `near_boundary`, `manual`, `imported`, or hierarchy-derived type
- derivation source and calculation version
- confidence
- internal and public precision
- primary flag
- review state
- correction/removal timestamps

One Record can belong to a zone, its parent facility, and an administrative
area. Occurrences never create additional membership counts for the same
Record.

Membership uses the internal exact point and its uncertainty. Public responses
contain place/zone/cell precision only. A point within its uncertainty distance
of a boundary, an approximate boundary, or equally ranked overlapping siblings
creates candidates instead of a confirmed primary membership.

### 3.6 PlacePolicy

```ts
type RecordingPolicy =
  | "allowed"
  | "check_rules"
  | "customers_only"
  | "permission_required"
  | "prohibited"
  | "unknown";
```

Place visibility and recording/publication permission are independent. OSM
`access=yes`, `public`, or `permissive` may support browsing/access guidance but
never proves photography or public posting permission.

Default fail-closed policy:

- schools and restricted/private places: `permission_required`, CTA suppressed
- theme parks, malls, resorts, museums, zoos, aquariums and commercial
  facilities without a verified rule: `check_rules`
- explicit official prohibition: `prohibited`, CTA suppressed
- explicit official customer restriction: `customers_only`
- `allowed` requires an applicable verified official rule
- all other unknown cases: `unknown` or `check_rules`

Official rule URL, source, verification time, and affected scope are displayed
when available.

### 3.7 PlaceAtlasProfile v2

V2 extends rather than changes v1:

- canonical place identity, aliases, verification, official status
- safe boundary summary and hierarchy
- sourced policy
- Record summary counted by Record
- theme assertions with provenance and status
- facilities, activities, stories, and public memories with sources
- partial/suppressed/empty/error state per section
- profile-level provenance and freshness

V1 remains available at `/api/v1/map/place-profile`. V2 is returned only from
v2 endpoints or explicit negotiation and is adapted to v1 where required.

## 4. OSM named-area discovery

Supported tags include the requested tourism, shop, landuse, leisure, amenity,
place-of-worship, resort, farm, orchard, vineyard, and farmyard families.

A map candidate must:

1. be a closed way or relation with valid Polygon/MultiPolygon geometry;
2. have a usable proper name;
3. map to a meaningful place kind;
4. satisfy kind/context area thresholds;
5. be requested at high zoom, through search, near a selected Record, or as a
   selected candidate.

Commercial and tourism polygons are not loaded on every low-zoom pan. Tile TTL,
negative cache, request timeout, and sequence/abort guards are mandatory.

Display-name candidates are separated from search aliases. The normal order is
`official_name:ja`, `name:ja`, `name`, `official_name`, then brand/short name.
If a localized name is only the brand while the general name is a strictly more
specific facility name, the specific name wins. All remaining values from
`brand`, `short_name`, `alt_name`, `old_name`, and language-specific names
become aliases.

Way/relation duplicates and mall/retail overlaps resolve into one candidate when
name/brand aliases agree and geometry is contained or strongly overlaps.
Parking lots, single shops, and unrelated buildings are excluded from parent
place selection.

## 5. Record themes and regional content

Theme assertions are additive, versioned evidence:

- `nature`
- `scenery`
- `daily_life`
- `facility`
- `activity`
- `history`
- `audio_visual`
- `insight`
- `unclassified`

Initial classification is deterministic from media kind, existing taxon data,
note/context fields, Place Memory tags, guide/rally/event links, and facility
links. AI assertions are asynchronous and `provisional`; they include model,
prompt/rule version, and input provenance. Owner/curator assertions can accept,
reject, add, or remove a theme without deleting the original assertion.

Facilities, stories, and activities require source references and freshness.
AI is never the sole source for facility facts or history.

Public Place Memory requires all of:

- explicit public-place opt-in
- visible moderation status
- public-ready source Record/media
- non-sensitive content
- privacy-safe attribution

Private notes and owner-only memory are not selectable by the public query.

## 6. API contract

Public APIs:

- v1 profile compatibility
- place search
- source-ref resolve
- place profile v2
- children/parents
- public facilities/content/memories

Authenticated proposal API:

- name, boundary, policy, or merge correction proposal
- proposals enter a review queue and never overwrite canonical data

Every response:

- omits exact coordinates and private/limited Records
- distinguishes null from zero
- distinguishes partial, suppressed, empty, and error
- includes source, confidence, verification, freshness, and cache policy
- fails externally sourced sections as partial/503 without breaking the map

## 7. Performance and observability

- discovery tile cache, negative cache, and bounded external timeout
- no unbounded Overpass calls on pan/zoom
- selected profile loaded lazily
- abort and sequence guards for map/profile/search requests
- geometry vertex, area, and D1 bind limits
- metrics: search/profile latency, resolve success/error, cache hit, external
  timeout, empty contradiction, image error, profile open, theme open,
  correction, and Record CTA

## 8. Rollout

The schema expands while the v2 runtime flag is off. Backfill is dry-run first
and idempotent. Staging enables canary place kinds after migration and QA.
Production D1 migration and production promotion require the central explicit
approval gate.

Canary order:

1. 常磐公園 with 常盤公園 alias
2. JUNGLIA OKINAWA
3. selected Hamamatsu AEON Mall

Rollback disables the v2 rollout/read path and returns to the v1 adapter. The
additive schema and source evidence remain; no destructive down migration is
required.
