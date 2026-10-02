# ZUKAN Global Atlas & Traveler Experience v1

Status: `OWNER-DIRECTED DESIGN / IMPLEMENTATION NOT CLAIMED`
Date: 2026-10-03
Product: ZUKAN
Extends:
- `docs/spec/zukan-product-architecture/SPEC.md`
- `docs/spec/universal-place-atlas/SPEC.md`
- `docs/spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md`
- `docs/spec/zukan-product-architecture/PROFILE_HORIZON.md`

## 1. Owner outcome

ZUKAN evolves from a regional place/record product into a **global living atlas** that a resident or international traveler can use to discover, understand, save, revisit and contribute to real-world places and regional knowledge.

The global product must be useful before sign-in and before contribution. It must not become a generic business directory, a Google Maps clone, a social review feed, or a tourism-only fork.

Core proposition:

> Find the world as it is now, understand why it matters, and see how it changes.

Japanese expression may continue to use the existing brand idea:

> まちは、うつろう。だから、うつす。

The global expansion preserves ZUKAN's existing Knowledge Core:
`Place / Entity / Subject / Time / Record / Claim / Source / Evidence / Rights / Review / Publication`.

No second canonical place database, tourism-specific auth system, or per-country product fork is introduced.

## 2. Product distinction

Commodity map/search products answer primarily **where / what is here**.

ZUKAN should add:

1. **Identity** — one stable ZUKAN identity across source IDs, aliases, languages, moves, renames and source replacement.
2. **Context** — why the place/object matters, how it relates to its area, people, culture, nature and activities.
3. **Time** — current state plus opening/closure/rename/rebuild/seasonal and historical change.
4. **Evidence** — visible source, freshness, confidence and correction path.
5. **Local knowledge** — rights-safe public Records, stories, sound, photos, documents and observations.
6. **Traveler utility** — names that can be shown locally, practical access facts, saved trips, routes and offline-safe selected material.
7. **Participation** — a visitor can add a photo, observation, correction or change record without turning popularity into canonical truth.

Reviews, ratings, follower counts and engagement ranking are not required Core.

## 3. MECE object model

Do not attempt to make one giant category list carry ontology, navigation and search at the same time.

### 3.1 Canonical object families

These are the top-level responsibilities used to prevent category drift.

| Family | Meaning | Examples | Existing Core mapping |
|---|---|---|---|
| **Area** | bounded or named region | country, city, neighborhood, park, protected area, campus, district | Place + boundary + relationships |
| **Place** | destination, facility, service or venue people can identify/visit/use | restaurant, hotel, school, museum, hospital, shop, station, shrine | Place |
| **Route** | linear or ordered spatial experience/network segment | trail, road, railway, ferry, walking route, river route | Place/Entity relationships + Publication/Program profile |
| **Thing** | discrete physical object or asset | statue, bridge, tree, public art, vending machine, manhole, monument | Entity/Subject linked to Place |
| **Event** | time-bounded happening | festival, market, exhibition, performance, seasonal event | Event + Place |
| **Subject** | reusable non-spatial identity/theme | species, dish, tradition, craft, organization, brand, creator | Entity / Subject |
| **Record** | evidence of what was submitted, observed or acquired | photo, video, audio, note, document, observation | Record + Source/Evidence |

A real-world item may participate in relationships across families, but it has one primary responsibility in a given canonical object identity. For example, a railway station is a Place; the railway line is a Route; a station monument is a Thing; a festival held there is an Event.

### 3.2 Functional taxonomy is multi-label

Within Place/Thing/Subject, classification is hierarchical and may be multi-label. Use a source-compatible taxonomy rather than inventing a ZUKAN-only global ontology first.

Overture Maps' current Places taxonomy is the initial interoperability baseline. ZUKAN stores:
- source taxonomy IDs and hierarchy,
- normalized ZUKAN display facets,
- alternate classifications,
- source/version/provenance.

Do not overwrite source classifications to force one ZUKAN label.

### 3.3 Traveler facets are orthogonal, not categories

These facts must remain separate from object type:

- opening / operating status
- opening hours and exceptional closures
- price / admission / reservation
- accessibility
- language support
- payment
- toilet / Wi-Fi / luggage / parking
- indoor / outdoor
- child / pet conditions
- seasonal suitability
- crowd or capacity facts only when sourced
- transport/access
- photography/publication rules
- freshness / confidence / source

Unknown remains unknown. AI does not invent practical travel facts.

### 3.4 Small editorial lenses for UI

The UI may expose a small human-oriented set independent from canonical taxonomy:

- Eat & Drink
- Stay
- See
- Culture & History
- Nature
- Do
- Shop
- Move
- Essentials
- Local & Unusual

These are discovery lenses, not canonical object types.

## 4. Global source strategy

### 4.1 Source tiers

**Tier 0 — global spatial baseline**
- Overture Maps Places, Base, Buildings, Divisions and Transportation.
- Preserve Overture feature IDs / GERS references and release version.
- Use the Overture changelog for delta reconciliation.
- OpenStreetMap-derived themes retain ODbL obligations separately from permissive datasets.

**Tier 1 — identity and public knowledge**
- Wikidata for CC0-linked identifiers and multilingual structured knowledge.
- GeoNames where useful under its attribution terms.
- official national/local open data, municipality and facility sources.
- official websites as source references, not unbounded scraped truth.

**Tier 2 — travel and mobility**
- GTFS Schedule / Realtime from publishers whose terms permit the intended use.
- official transit, airport, tourism/DMO and public-service sources.
- per-feed/provider rights remain explicit.

**Tier 3 — media and editorial knowledge**
- Wikimedia Commons only with per-file license/attribution preserved.
- ZUKAN-contributed media and local records under existing rights/review rules.
- publication-specific sources remain SourceEditions instead of being copied into canonical truth.

**Tier 4 — specialist datasets**
- specialist biodiversity/environment/cultural datasets only under compatible per-dataset licensing and accountable Domain Pack rules.
- datasets with noncommercial-only restrictions are excluded from the default commercial global corpus unless separately licensed.

### 4.2 OpenPOI

OpenPOI is a useful **Japan source adapter / bootstrap / fallback candidate source**, not ZUKAN's global canonical dependency.

ZUKAN assigns its own stable `place_id` and retains source references. OpenPOI records may enrich or validate Japanese candidates where its attribution contract is satisfied.

### 4.3 Source separation and licensing

Every imported fact or media object retains at minimum:
- source/provider
- upstream record ID
- source edition/release
- observed/imported time
- license
- attribution requirement
- redistribution eligibility
- commercial-use eligibility
- modification/share-alike implications where applicable
- confidence/review status
- revocation/correction locator where available

Do not flatten ODbL, permissive, CC BY/SA, CC0 and noncommercial data into one undifferentiated redistributable database.

## 5. Global identity and time

### 5.1 Stable ZUKAN identity

Keep the accepted Universal Place Atlas rule:
- ZUKAN internal IDs are stable and source-independent.
- Overture GERS, OSM, Wikidata, GeoNames, OpenPOI, official IDs and other source IDs are references, not the canonical ID.
- matching first uses exact known source refs, then names/aliases/locality, hierarchy, geometry and confidence.
- uncertain merges stay candidates.

### 5.2 Names

For every eligible object:
- local-script canonical name when known,
- language-tagged official/common/short/old/alternate names,
- transliterations as derived aliases,
- translations as derived Claims when no authoritative localized name exists,
- pronunciation only when sourced or safely derived and labeled.

Never replace the local canonical name with an English translation.

### 5.3 Change model

A place does not disappear because it closes or changes name.

Represent:
- opened / closed / temporarily closed
- renamed
- moved
- rebuilt
- merged / split
- boundary change
- operator/brand change where sourced
- source disagreement
- seasonal validity

The public detail can show a compact **Then / Now / Changed** timeline backed by source and Record evidence.

## 6. Global data plane on Cloudflare

The global corpus is too large and too heterogeneous to assume one D1 database is the full source store.

Default architecture:

```
Global/open source releases
        ↓
R2 / Basin Catalog (Iceberg)
        ↓
normalization + provenance + license eligibility
        ↓
identity/conflation + change reconciliation
        ↓
regional/hot search projections
        ↓
Workers API
   ├─ search / suggest / nearby
   ├─ resolve / detail / hierarchy
   ├─ map tiles/projections
   ├─ traveler facts
   ├─ timeline/change
   └─ MCP / SDK
```

Responsibilities:
- **R2/Basin**: global raw/normalized snapshots, source editions, large-scale reconciliation/analytics.
- **Basin SQL**: large batch QA, joins, change analysis and regional extraction where appropriate.
- **Workers / Workflows / Queues**: bounded import, reconciliation and projection jobs.
- **D1**: current low-latency regional/hot read models where it remains the simplest fit; shard/project rather than require one global monolith.
- **Cache/KV where appropriate**: short-lived search/suggestion/cache artifacts, never canonical truth.
- **AI Search / semantic retrieval**: optional secondary retrieval over stories/descriptions/sources for natural-language discovery. It must not be the canonical geospatial index or source of practical facts.

The exact physical partitioning is an implementation decision based on measured corpus size, latency and cost; this design does not invent an unverified D1 capacity number.

## 7. Search and ranking

### 7.1 Query path

A global query may combine:
- exact/localized names
- aliases and transliterations
- canonical source refs
- category/taxonomy
- geographic intent
- current viewport or user-approved location
- traveler facets
- natural-language semantic intent

Primary ranking inputs:
1. identity/name match
2. geographic relevance
3. query/category intent
4. source confidence
5. freshness
6. distinctiveness / local relevance
7. practical state such as open-now only when reliably sourced
8. saved-trip/route context when the user asks for it

Popularity/review volume is not a required ranking primitive.

### 7.2 Search behaviors

Must support:
- local language and English/other configured languages
- transliteration and common misspellings
- aliases / former names
- parent/child names (mall + store, airport + terminal)
- "near me", viewport and bounded-area search
- category/facet filters
- null/empty/partial/unavailable distinction
- source-aware correction

Do not depend on the public OpenStreetMap Nominatim service for production autocomplete or bulk discovery.

## 8. Traveler-first information architecture

ZUKAN remains read-first.

### 8.1 Primary navigation

Default mobile IA:
- **Discover**
- **Map**
- **Saved / Trips**
- **Add**
- profile/account as secondary access

Desktop can expose the same responsibilities without inventing more primary destinations.

### 8.2 Discover

One primary search box, then context-aware discovery.

Useful modules include:
- Nearby
- Only here / Local & unusual
- Open now
- Free / low-cost
- Rainy day / indoor
- 30 / 60 / 90 minute discovery
- culture/history/nature/food lenses
- seasonal changes
- saved-trip context

Do not create an infinite social feed as the default home.

### 8.3 Map

Map density must be semantic by zoom:
- world/country: areas, cities and a few high-value anchors
- city/region: clusters, neighborhoods and editorial lenses
- local: individual Places/Things/Events
- selected object: details and relationships

Never render the full global corpus as icons.

Map and list are two views of the same result state. Mobile uses an accessible bottom sheet/list pattern that does not trap scrolling, focus or map interaction.

### 8.4 Detail

Default traveler detail order:

1. local canonical name + selected-language name
2. one sentence: what it is / why it matters, sourced or editorially reviewed
3. practical action row: save, directions/route handoff, share, add/correct
4. open/closed + hours + exceptional state where sourced
5. admission/reservation/accessibility/language/payment/transport essentials
6. "Show locally" card: local name, local address, nearest relevant access point
7. photos/media with visible rights/source as required
8. **Then / Now / Changed**
9. stories, public Records, related Subjects/Events
10. nearby related places / next stop
11. source, freshness, confidence and correction

Unknown sections are omitted or explicitly unknown; no fake completeness.

### 8.5 Saved / Trips

Initial scope:
- save Place/Area/Thing/Event
- collections / trip grouping
- order places manually
- shareable selected collection when rights permit

Later, after measured demand:
- route optimization
- calendar/time windows
- reservation imports
- offline trip pack
- collaborative planning

A trip planner is a View over canonical objects, not a second place database.

### 8.6 Add / Correct

Traveler contribution is deliberately small:
- photo/video/audio
- note/story
- "this changed"
- name/category/location/boundary/policy correction proposal
- source link

Existing rights, Review and privacy boundaries remain authoritative.

## 9. Internationalization contract

Global-ready means model + UI behavior, not merely machine-translating strings.

Required:
- BCP 47 language tags
- local script preserved
- language-aware search aliases
- transliteration separated from authoritative names
- RTL/bidi-safe layout from design time
- locale-aware date/time/time zone
- locale-aware numbers and units
- currencies shown with source/date when conversion is provided
- international phone/address formatting without destroying local display
- long-name and mixed-script layout acceptance
- translated factual text retains source and machine/human translation status

Automatic translation is a derived Claim/Publication rendering. It does not rewrite source truth.

## 10. Foreign traveler essentials

For the selected place/area, prioritize practical uncertainty reduction:

- local name that can be shown to a driver/staff member
- copyable local address
- nearest station/stop/entrance where sourced
- hours and holiday exceptions
- admission/reservation
- accepted payment only when sourced
- language/accessibility support only when sourced
- photography/recording rules where applicable
- official booking/info link
- offline-safe saved summary
- source freshness

Emergency/disaster information may link to official channels and show sourced public state, but ZUKAN does not become an emergency-response service.

## 11. UI/UX system

### 11.1 Avoid category overload

The canonical taxonomy may contain thousands of classes. The traveler never navigates thousands of classes.

Use:
- 8–10 editorial lenses,
- progressive filters,
- search intent,
- semantic zoom,
- contextual suggestions,
- breadcrumbs/parent relationships.

### 11.2 Visual character

The application should feel like a calm, contemporary field guide/atlas:
- map, local typography and real media are primary;
- cards are used only when they improve scanning;
- avoid generic AI gradients, repeated dashboard cards and decorative badges;
- motion communicates spatial/context transitions, selection, save and timeline change;
- support `prefers-reduced-motion`.

### 11.3 Responsive acceptance

At minimum inspect:
- 320
- 375
- 768
- 1024
- 1280 CSS px

Also inspect transition widths, keyboard/IME state, rotation where composition changes, long translated names, CJK + Latin, and RTL.

Essential information/actions remain usable without hover.

## 12. API / MCP / SDK surface

Public read surface should converge on one contract family:

- `search`
- `suggest`
- `nearby`
- `resolve`
- `detail`
- `children / parents / related`
- `changes / timeline`
- `sources / freshness`
- `route/collection projection` where activated

MCP exposes the same bounded read model rather than another truth path.

A browser/mobile search SDK may wrap suggest/search/map selection. It is a client library, not a separate backend.

## 13. Rollout

Do not launch "the whole world" as one unverified migration.

### G0 — contract and source audit
- preserve existing Universal Place Atlas contracts
- finalize object families, taxonomy crosswalk, provenance/license eligibility
- fresh-read current runtime/database before any import
- identify existing production Place import binding gap

### G1 — global source fabric
- ingest one current Overture release to R2/Basin as source edition
- retain GERS/source refs and changelog
- produce regional extracts without publishing globally
- prove idempotent update/reconciliation

### G2 — Global Search / Map / Detail
- search/suggest/nearby/resolve/detail
- semantic zoom
- parent/child handling
- traveler detail card
- source/freshness states

### G3 — Language & traveler essentials
- local names + translations + transliteration
- locale/timezone/units
- "Show locally"
- accessibility/practical sourced facts

### G4 — Living Atlas
- change/timeline
- public records/stories
- corrections and change proposals
- curated local/unique discovery

### G5 — Trips / Offline / API ecosystem
- saved trips/collections
- bounded offline packs
- MCP/API/SDK
- route/trip enhancements only from observed demand

## 14. Cross-market canary matrix

Canaries are selected to expose different failure modes, not to declare launch priority.

- Hamamatsu: owner/local verification, lower-density regional coverage
- Tokyo or Kyoto: very high POI density, tourism, rail/transit
- Seoul: Hangul + English aliases, dense transit
- Taipei: Traditional Chinese + multilingual tourism
- Paris or London: dense heritage and multilingual visitors
- New York: dense mixed commercial/cultural hierarchy

Each canary proves source legality, identity, search, language, hierarchy, map density and detail usefulness before broader rollout.

## 15. Acceptance fixtures

A slice is not accepted until relevant fixtures pass.

### Identity / data
- same place resolves from local name, English name, alias and transliteration
- upstream ID replacement does not silently create a duplicate
- mall + store / airport + terminal preserve parent-child identity
- closed/renamed/moved place preserves history
- event expiry does not delete the Place
- conflicting sources remain visible/reviewable
- license/attribution survives ingestion and publication

### Search / map
- low zoom does not render unusable POI clutter
- high zoom can discover eligible individual objects
- query empty, zero, partial, stale and unavailable states differ
- user-denied GPS still leaves useful search/map behavior
- public Nominatim is not used as production autocomplete
- sensitive/private precision is suppressed

### International UX
- local + translated names fit real layouts
- long German/English strings, Japanese, Korean, Traditional Chinese and RTL samples do not break primary tasks
- local-script "show locally" remains available
- locale/timezone formatting is correct for the selected place rather than device locale alone
- machine-translated text is distinguishable from authoritative names/facts

### Traveler journey
- anonymous traveler: search → detail → save completes
- map → detail → nearby next stop completes
- saved trip remains readable under intended offline boundary
- user can propose "this changed" without editing canonical truth directly
- source/freshness can be inspected from practical facts

### UI quality
- representative 320/375/768/1024/1280 renders
- no blocked scroll/focus from map sheet or keyboard
- keyboard navigation and visible focus
- reduced-motion path
- no horizontal overflow in long/mixed scripts

## 16. Metrics

Baseline before targets:
- search → useful detail open
- alias/transliteration search success
- search zero/partial/unavailable rate
- map → detail conversion
- place save / trip add
- detail source/freshness inspection where exposed
- correction/change proposal completion
- place/area revisit
- first useful response latency by region
- source conflict/duplicate rate
- cost per 1k useful searches / details
- support minutes for data corrections

No metric justifies unnecessary location tracking or social scoring.

## 17. Non-goals

Not in the first global release:
- clone Google reviews/ratings
- scrape proprietary place/review databases
- continuous precise traveler tracking
- one global D1 monolith
- AI-generated unsourced hours/prices/accessibility
- global route engine from scratch
- every language manually curated on day one
- worldwide offline media mirror
- person/face identification
- country-specific product forks
- emergency-response guarantees

## 18. Current execution boundary

This document records the owner-directed product/UX design. It does **not** claim runtime activation.

The existing Universal Place Atlas remains the implementation base. Existing canonical Work/claim/publication boundaries remain in force. Before implementation:
1. recover/bind the matching NOCOSIL Work instead of creating a second control plane;
2. fresh-read current Place Atlas runtime and import route;
3. reconcile the 2026-09-16 production exact-import blocker with current state rather than assuming it persists or is solved;
4. route implementation through the existing Factory;
5. verify each rollout layer separately: source → candidate → staging → production → traveler journey.

## 19. Primary external references checked for this design

Checked 2026-10-03:
- Overture Maps September 2026 release notes: https://docs.overturemaps.org/blog/2026/09/23/release-notes/
- Overture Places: https://docs.overturemaps.org/guides/places/
- Overture GERS: https://docs.overturemaps.org/gers/
- OpenStreetMap copyright: https://www.openstreetmap.org/copyright
- Nominatim public API policy: https://operations.osmfoundation.org/policies/nominatim/
- Wikidata licensing: https://www.wikidata.org/wiki/Wikidata:Licensing
- GeoNames: https://www.geonames.org/export/
- GTFS: https://gtfs.org/
- Wikimedia Commons reuse: https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
- GBIF terms: https://www.gbif.org/terms
- Cloudflare Basin GA: https://developers.cloudflare.com/changelog/post/2026-10-01-basin-ga/
- Cloudflare AI Search GA: https://developers.cloudflare.com/changelog/post/2026-10-01-ai-search-generally-available/
