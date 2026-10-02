# ZUKAN Global Atlas & Traveler Experience v1

Revision: **1.1 — reviewed 2026-10-03; stable path retained**
Status: `OWNER-DIRECTED DESIGN / IMPLEMENTATION AND RUNTIME NOT CLAIMED`
Scope: global discovery, source integration, place identity, traveler utility and their acceptance.

## 0. Authority and review corrections

This is a bounded extension of ZUKAN, not a replacement product constitution or a second global platform design.

Read with the existing authorities:
- [Product Architecture](../zukan-product-architecture/SPEC.md) and [Profile Horizon](../zukan-product-architecture/PROFILE_HORIZON.md).
- [Global Platform Bundle](../zukan-product-architecture/GLOBAL_PLATFORM_BUNDLE_2026-09-13.md), including its normative cross-product decision and GP01–GP30 acceptance.
- [Quiet Home / Saved](../zukan-app-experience/QUIET_HOME_SAVED_CONTINUITY_V1.md).
- [Design rulebook](../../../DESIGN.md), [App Experience](../zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md) and [Universal Place Atlas](../universal-place-atlas/SPEC.md).
- Current owner-development operating contract; NOCOSIL Work/Decision/authority/claim/Current State/Resume owns execution continuity.

**Scoped supersession:** this revision replaces this document's original seven-family MECE claim, mandatory global-first import/Basin sequence, separate traveler shell and late-only Saved/offline delivery. In the three companion amendments introduced by PR #1811, App Experience §18.2–18.5, Universal Place Atlas §9 and Profile Horizon's Global Atlas extension must be interpreted through this revision. In particular, the four-label traveler shell is no longer an adopted navigation migration, and R2/Basin is not a required first-stage stack. Their existing links resolve here; unrelated navigation, runtime, rights and profile contracts remain unchanged.

| Review finding | Adopted correction |
|---|---|
| New design overlooked newer global and Home/Saved authorities | Reuse peer surfaces, stable context and existing Saved; do not rebuild them |
| Area/Place/Thing/Record mix referents, geometry and evidence | Separate modeling axes and lifecycle responsibilities; no universal replacement table |
| Global capability was coupled to global ingestion | Prove a complete local-and-overseas slice before expanding coverage |
| Infrastructure and six-city canaries preceded user value | Existing storage first; one local and one overseas sample, then targeted expansion |
| Source presence was too close to travel-fact verification | Field-specific provenance, validity, freshness and unknown/conflict states |
| Identity continuity could conflate a business with its old premises | Separate organization/branch/site/occupancy, with reversible reconciliation |
| Broad location suppression conflicted with directions | Preserve existing protection; purpose-bound public entrance data only through an authorized projection |
| Offline and API distribution lacked concrete rights/cost boundaries | Small explicit offline derivatives; distribution-specific rights and bounded read APIs |

The historical 2026-09-16 Place import blocker and issue closure are leads, not current runtime evidence. Do not reopen old work or assert that the blocker persists without a fresh domain/runtime read.

## 1. Owner outcome and first value

Enable a resident or visitor to **find something worth visiting or understanding, establish what is known, save it, and return to its local knowledge and changes**. Global means reusable across markets, languages and institutions; it does not mean every market or object is activated immediately.

Travel is a peer experience, not the parent of nature, citizen records, jobs, learning, offers or participation. Keep the existing brand, logo and approved public message. “Global Living Atlas” is a working description, not an automatic rebrand or a guarantee of live worldwide coverage.

The first traveler journey is:

`explicit destination / direct link → relevant result → useful detail + local-name card → save → reopen → directions handoff or nearby discovery`

A parallel contributor journey remains:

`capture / source / correction → retained Record or proposal → visible review state → eligible place knowledge → return`

Neither requires NOCOSIL registration. Reading is useful without logging in. Anonymous device saving is a scoped extension requiring its own persistence proof; existing authenticated Saved is reused rather than silently declared anonymous-ready.

## 2. Distinctive value and breadth boundary

Prioritize local explanation, real records and visible change alongside practical utility. Do not claim that other map products lack history or context; demonstrate ZUKAN's added value in a real journey.

Each activated pilot area should have eligible examples of a local story or source, a record tied to a place, and a sourced change where one exists. Never fabricate historical photos, dates, cultural claims or before/after events to fill the design. An area with no history still supports discovery and an honest invitation to contribute.

“A wide-ranging atlas” means lawful public regional knowledge and the existing peer domain profiles. It does not authorize personal dossiers, face recognition, household inventory exposure, sensitive wildlife coordinates, military/security targeting, emergency response or unlicensed brokerage. Unknown new content can remain an attributed Article/Publication until a typed profile has real demand.

## 3. MECE responsibilities, not a falsely exclusive catalogue

### 3.1 Independent axes

Do not partition reality into seven disjoint classes. A park is both an area and a destination; a monument is both an object and a destination; a photo is evidence, not another kind of destination.

| Axis | Responsibility | Existing representation |
|---|---|---|
| Referent identity | What real entity, subject, institution, concept or occurrence is meant? | Existing Place / Entity / Subject / Event and domain identities |
| Spatial representation | Where is it, and how is it approached? | Point/area/line, entrance, boundary, route, hierarchy; multiple representations where justified |
| Domain meaning | What kind of place, service, activity or claim is it? | Versioned provider taxonomy and existing Domain/Profile contracts |
| Assertion and time | What is claimed, by whom, for which period? | Claim / ClaimRevision / Review / validity |
| Evidence | What was observed, submitted or published? | Record + independently governed Source / SourceEdition / Evidence |
| Presentation and use | Who may see/use which edition, for what purpose? | Publication / representation / placement / rights |

MECE applies to responsibility and lifecycle, not mutually exclusive discovery labels. Reuse existing schemas; this table is not a request for six new storage engines. Preserve non-spatial online/remote offerings. Events/Offers/Jobs retain their own validity and transaction meanings rather than becoming generic POIs.

### 3.2 Coverage checklist

The following is a deliberately overlapping coverage checklist, not a new ontology or a promise that every source is integrated. Each activated domain needs an explicit source, rights basis, usable fields, update owner and acceptance example in the existing profile/source registry. An uncovered row remains visible as unsupported, not silently discarded or forced into food.

| Coverage group | Representative objects | Source route / activation rule |
|---|---|---|
| Areas and physical geography | Countries, neighborhoods, islands, rivers, forests, mountains, coastlines | Overture themes / OSM / official geographic datasets, with theme-specific rights |
| Nature and environmental knowledge | Species, observations, habitats, protected areas, seasonal change | Existing Biodiversity/Environment Pack; GBIF-compatible selected datasets [R7]; never treat occurrence as current guaranteed presence |
| Buildings and public objects | Buildings, bridges, monuments, public art, trees, utility objects | Spatial datasets + accountable public sources; object identity distinct from tenant/occupant |
| Culture, history and belief | Museums, archives, heritage, religious sites, traditions, historic records | Public institutions and attributed sources; Europeana metadata/media rights separated [R8] |
| Food, shopping and local services | Restaurants, markets, shops, workshops, products, professional services | Places sources, Japan OpenPOI adapter [R1], operators; a menu/item/service is not the branch itself |
| Staying, leisure and sport | Accommodation, campsites, attractions, baths, trails, sport facilities | Places + operators; rates, inventory and booking remain operator facts |
| Mobility and access | Stations, stops, entrances, roads, cycle routes, ferries, parking | Spatial themes; GTFS is a format, with actual feed rights/coverage checked per publisher [R9] |
| Everyday and visitor essentials | Toilets, water, lockers, Wi-Fi, charging, ATM, accessibility facilities | OSM/municipal/operator sources; precise location and access conditions reviewed separately |
| Health, safety and public services | Clinics, pharmacies, public offices, shelters, official notices | Accountable official listings; no inferred treatment, emergency availability or safety guarantee |
| Learning, work and institutions | Schools, libraries, courses, jobs, organizations, farms, research | Existing peer profiles and accountable publishers; no automatic people directory |
| Events, offers and participation | Festivals, exhibitions, tours, workshops, volunteering, coupons | Existing Event/Program/Offer profiles; occurrence, availability, expiry and actual action receipts |
| Local records and creative knowledge | Photos, sounds, documents, stories, crafts, recipes, consented profiles | Existing Record/Source/Publication paths; author and reuse rights retained |

Overture taxonomy is an interoperability baseline for its Places scope, not a species/event/job/history ontology. Store raw category + provider/schema version + reviewed crosswalk; use `exact / broader / narrower / related / unmapped` mapping semantics. Preserve unmapped values. A taxonomy change invalidates affected projections, not the original evidence. UI lenses and traveler facets are independent multi-label views.

## 4. Source integration and rights

### 4.1 Selective source portfolio

Start with a bounded Overture regional extract and one source that adds missing local value. Add other themes/providers only for an evidenced coverage or quality gap. Global source releases are references and candidate data, not independently verified place facts. Overture documents duplicate/junk/incomplete records and provider-dependent confidence [R2].

Use OpenPOI for bounded Japanese lookup/enrichment where useful. Retain `licenses` and `attributions`, including response-level values in minimal suggestions; preserve provenance through normalization [R1]. Saving search results does not establish a bulk-download route, reserved throughput, SLA or authorization to exhaust a shared endpoint. Use supported upstream releases for bulk ingestion. Do not assume OpenPOI provides a stable external ID if the selected response does not.

Overture/OpenPOI/other aggregators may repeat the same upstream evidence. Keep derivation lineage so duplicated feeds are not counted as independent confirmation. Honor rate limits, retry guidance, negative caching and failure isolation; no provider call for each visible map pin or each keystroke.

### 4.2 Per-use eligibility

Use the existing Source/Edition/Rights/Publication and operation-policy seams. Preserve provider/object/edition, source timestamp, fetched timestamp, license/notice/attribution, derivative lineage and allowed purposes. Missing metadata is unknown, not unrestricted.

Distinguish rights to retain, analyze, translate, display, promote, cache offline, export and redistribute via API/MCP/SDK. Retain machine-readable obligations and readable notices. A public website or API is not blanket permission to copy its photographs or prose.

Separate permissive, ODbL and other source obligations where necessary, but **separate tables/buckets alone do not decide whether a resulting database is derivative**. Assess the actual joining and distribution method against the applicable license before activation; escalate genuinely unresolved legal interpretation, not every routine import. Overture itself flags this issue for joining to OSM [R2].

Commons/heritage media requires per-item rights. Europeana's metadata treatment does not grant media reuse [R8]. GBIF datasets may be CC0, CC BY or CC BY-NC; do not admit noncommercial-only data into the default commercial reuse path without an applicable permission [R7]. Personal, IKIMON, 愛管 and Project non-public sources remain separated.

## 5. Identity, geography and change

### 5.1 Identity lifecycle

Preserve the existing stable ZUKAN ID; retain GERS/OSM/official/Wikidata and other IDs as versioned references, never force a new global ID migration. Names, locality and geometry provide candidate evidence, not automatic proof of sameness. Existence confidence is not identity confidence, visit quality or opening-hours confidence [R2][R3].

A company, brand, branch/business operation, physical site and entrance are different referents. A branch may move while the former site remains. Link time-bounded occupancy and `moved_from / moved_to / replaces` using existing relation/Claim mechanisms; retain the operation ID only where actual continuity is established. Old observations stay tied to their historical place/time. Do not move old photos to the new address.

Same-name nearby branches, two tenants in one building, a mall and a shop, and a river overlapping a park are not duplicates merely because their geometry overlaps. Keep candidate merges, reversible accepted merges/unmerges and redirects. Exact source-reference reuse still checks source edition and known upstream identity transitions.

### 5.2 Geometry and public precision

Keep CRS, positional accuracy, geometry role, source and validity. A centroid is not an entrance, address interpolation is not a surveyed point, and a bounding box is not proof of membership. Support point-only facilities without inventing polygons; preserve holes, overlaps and multiple parents. Test antimeridian, southern/western coordinates and cross-border regions; do not use zero coordinates as missing values.

The legacy Universal Place Atlas public precision contract remains unchanged. A future traveler projection may disclose a sourced public facility/entrance coordinate only after its existing authority, purpose, accuracy and safety policy permits that exact field. It must not derive that permission from a public Record, current GPS, or this design alone. Personal visits, homes, minors, sensitive habitats and restricted sites retain minimization/suppression.

Directions use an eligible entrance/destination or explicitly approximate area. Without a reliable destination, show the official/local-address handoff rather than navigate to a made-up point. Walking time requires an eligible routed path or reviewed route; straight-line distance is labeled as such and never converted into a claimed accessible route.

### 5.3 Time and corrections

Distinguish observed time, source-updated time, fetched time and accepted/reviewed time. Preserve valid-from/to, uncertainty and time-zone context. A new import does not make old information freshly verified. Closure, rename, rebuild and operator change are new assertions, not erasure of prior evidence.

A record missing from one incomplete fetch is not a confirmed closure/deletion. Reconcile complete editions, upstream tombstones and failures. Rights withdrawal may require suppression even where historical retention is allowed. Correct accepted facts without a later raw import overwriting them; retain conflicting sources and the resolver decision.

## 6. Minimal delivery architecture and operating cost

Use existing Workers, D1/R2, shared renderers and approved job/release paths. Do not install a new database, scheduler, geocoder, graph engine, search product or client library merely because the horizon is global.

Initial path:

`bounded source edition → existing validation/rights/identity seam → staged regional projection → search/detail/Saved UI → exact runtime and journey verification`

Store large source files in the existing governed object-storage path only where required. Use the current bounded geographic/name indexes first and inspect query behavior. Neither one global D1 database nor speculative regional sharding is mandatory. Native query plans, real row/index sizes, latency, update volume and cost decide an extension.

Basin/Iceberg, additional search infrastructure and distributed reconciliation are **conditional later options**, not prerequisites. Introduce one only when a measured workload cannot meet the adopted latency/cost/recovery envelope more simply. No new paid resource or billing commitment is authorized here. AI Search is optional for semantic stories, not a substitute for identity, geospatial filtering or deterministic rights.

Import by bounded jobs with checkpoints, idempotent source-edition keys, staged generations and atomic activation. Search/detail/attribution must resolve the same generation. A failed refresh leaves the last eligible generation with an honest stale marker; it never publishes half an import. Rollback changes the active projection, not original records or licenses. Stop/quarantine a source exhibiting schema breakage, unexpected record loss or rights changes; isolate only the affected scope.

Reuse existing cost telemetry: extraction/scan, storage, indexing, translation, images/tiles, refresh, public reads, abuse and correction/support effort. Measure cost per useful completed journey and bounded searches, not just provider unit prices. Define the pilot's actual budget and fallback in the existing Work before paid execution. No LLM on ordinary save, name lookup, map pan or unchanged translation.

## 7. Search and trusted practical facts

### 7.1 Request and ranking

Resolve explicit destination, selected dates and intent before inferred GPS. Preserve source-language and selected-language names/aliases; exact names first, then bounded fuzzy/transliteration and optional semantic retrieval. Keep scripts and original strings; normalization must not merge distinct identities.

Filter rights/safety/market eligibility before public candidate retrieval and ranking. Keep geographic relevance, query match, source quality, freshness and diversity distinct. Do not compare raw confidence scores across providers as calibrated probabilities. Explain a practical recommendation with concrete available evidence; avoid popularity-only or arbitrary novelty ranking. Sponsorship, if later adopted, must be disclosed and must not override factual eligibility.

Map and list share query, selected area, facets, date, sort, locale, result generation and cursor. Reject stale responses using request identity/sequence guards. Keep selection/scroll/context on return. Show `Search this area` after a user pan when appropriate; do not recenter on GPS or refetch without bound. Show capped/partial coverage as such, not as a complete count of the world's facilities.

Public Nominatim is not a production autocomplete or bulk-discovery dependency [R5]. A source failure remains unavailable/partial, not zero matches. Distinguish no query, no matches, no coverage, unsupported filter, stale result, partial provider and failure. Do not relax a user's hard constraint silently.

### 7.2 Field-level truth

For each practical fact, retain value, source edition, observed/source-updated time, valid period, confidence/review and freshness policy. Set refresh and expiry by field/source risk in the existing source policy, not one universal TTL. Missing freshness evidence does not become “verified today.”

`operating_status = open` means continued operation, **not open now** [R3]. Compute `open_now = true / false / unknown` only from eligible hours, facility time zone, exceptions and closure facts. DST, overnight service and holidays require explicit handling. Unknown stays outside a strict open-now filter unless the user deliberately includes unknowns. Cached derived states expire at the next relevant schedule/policy boundary.

Unknown price is not free; saving is not booking; a booking-link click is not confirmation. Accessibility is scoped to entrance/path/interior/toilet and observed conditions, not one inferred boolean. Keep language support, payment, dietary/allergy/religious certification and safety facts sourced and qualified. Translation or a photo alone cannot certify them.

## 8. UI/UX: extend the existing experience

### 8.1 Stable shell and contextual entry

Retain Quiet Home, existing direct peer-surface entry, a stable return to Saved/own records and working participation/capture routes. Do not create a second traveler application or rearrange tabs by inferred nationality/persona. `Discover / Map / Saved / Add` describes responsibilities, not an instruction to replace the existing navigation. Any later shell migration needs its own source/route inventory and equivalent-journey acceptance.

Travel context is explicit and temporary: destination, optional dates and selected constraints. Locale is neither nationality nor a permanent traveler profile. No launch-time GPS request, compulsory AI chat, forced Home redirect or new account wall for public reading.

### 8.2 Discover and map

Reuse Quiet Home's maximum three coherent shelves with three previews each; fewer when useful data is scarce. Keep public discovery and private saved/record history separate. Do not fill ten lenses or nine cards for appearance. Start with a few relevant lenses and reveal further facets on request. Hide unsupported actions, not missing-source explanations.

Semantic zoom favors areas/clusters at broad scale and eligible objects locally. Make density adaptive to viewport/labels rather than one hardcoded zoom threshold worldwide. Low zoom does not prohibit a specifically searched landmark from appearing. Keep a list alternative when WebGL/maps fail.

Mobile detail selection uses the existing sheet/drawer pattern: explicit close, usable peek/expanded states, no stacked modal sheets, focus restoration and no hidden list/map controls. Back restores prior query, viewport and scroll. An on-screen keyboard cannot cover the selected result or primary action. Desktop may show list/map side by side using the same state. Attribution remains visible, including with sheets open.

### 8.3 Detail: essentials first, depth on demand

First screen: selected-language/local-script identity, concise sourced context, key availability uncertainty, one primary action and at most two visible secondary actions under DESIGN.md. Save, directions and “Show locally” are selected by the current task; sharing/correction and less frequent actions remain reachable through an explicit secondary menu. Do not render four equally prominent CTAs.

Then show relevant access/hours/fees, eligible media, a compact sourced “Then / Now / Changed” entry, and related records/experiences. Expand detailed history, sources and ancillary facilities on demand. Essential uncertainty and legally required attribution must not be buried in the expansion. Missing history/media is an honest state, not a reason for fabricated content or a full empty template.

“Show locally” presents original local name/address, sourced entrance/access reference and copy/show controls. It must work without generating a new translation on every open. Do not state that a guessed translation is an official name.

### 8.4 Contribution and moderation

Reuse the existing capture/correction flows and make “this changed” a bounded proposal with source/date where available. Retain drafts and report actual persistence. Filing a proposal does not change canonical facts or establish a verified closure. Use existing Review/withdrawal channels, reversible corrections and source-specific update ownership. Add abuse controls at writes; do not impose heavy review on ordinary safe reads.

## 9. Internationalization, markets and discovery

Reuse Global Platform Bundle's existing locale/URL/publication contract rather than inventing a second route system. Keep source language, UI locale, local name, audience market, source jurisdiction, time zone and currency separate. Explicit locale and destination survive links, login and refresh. Preserve existing supported locales; Japanese/English are the first traveler acceptance focus, not a removal of other languages.

Use native maintained Intl/CLDR-compatible behavior, BCP 47 language tags and IANA time zones. Support RTL/bidi isolation, flexible address/phone/name shapes, long strings and mixed scripts. No mandatory prefecture/postcode or two-decimal currency assumption. Local dates and overnight schedules must not shift with a viewer's device zone.

Translations are edition-bound derivatives with original text, language, glossary/pipeline version and review state. Cache unchanged results. A material source correction invalidates affected translations and practical recommendations; old translations are stale, not silently current. Do not translate all global objects into all languages upfront. A bilingual-name fallback is distinct from a completed published translated page.

Use the Bundle's localized canonical URLs, actual-edition language alternates and search/index policy. Public useful pages should be readable through ordinary direct links without login or map execution. Do not mass-generate thin indexed pages for every imported POI, language or filter. Only activate market-specific transactions and disclosure requirements when the existing responsible operator/policy supports them.

## 10. Saved, low connectivity and directions

Reuse existing typed Saved relationships, desired-state writes, revisions, tombstones and rights revalidation. A collection is a view over references, not a second place store. Private notes and plans are never implicitly public. No automatic NOCOSIL, Organization or employer synchronization.

For an anonymous pilot, implement a separate device-local guest namespace only if needed for the accepted journey. Show “saved on this device” after storage succeeds. Login reconciliation is deliberate, idempotent and does not resurrect removals or attach one guest's data to another account. Browser eviction/storage failure is explicit; device-only saving is not cloud durability.

Small offline utility belongs in the initial complete traveler slice: explicitly retain permitted local-name/address and essential selected-public-summary derivatives with source/freshness/expiry, distinct from the minimal Saved relationship. No blanket copying of media/coordinates. Reopen only what was actually stored; expired facts are not live availability. Respect per-device/account scope, quota and cleanup; acknowledge that an offline device cannot instantly receive a withdrawal, suppress on expiry/reconnection and avoid offline publication of content requiring immediate revocation.

Offline map/route packs are separate later capabilities. Standard OSM tile service prohibits offline prefetch [R6]; select an explicitly eligible provider or authorized self-hosted data only after budget/rights approval. Offline text availability must not be labeled offline navigation. Handoff to an existing routing/booking provider is the default; do not build a global route engine first.

## 11. Performance, accessibility and external-data safety

Reuse DESIGN.md and established Alpine/Tailwind/MapLibre/renderers. No new theme, font, motion package or framework is required. Motion explains selection, spatial context or saved state; honor reduced motion. Real media needs rights and lightweight derivatives, with no automatic background audio/video.

Verify representative 320/375/768/1024/1280 widths and affected transitions, keyboard/IME, text enlargement, list-without-map and actual long/RTL/CJK examples. Retain the project's at-least-44px control target, not a fabricated claim that WCAG mandates 44px for every case. Apply relevant WCAG 2.2 keyboard, focus, reflow, status-message and dragging alternatives [R10]. Screenshots alone are not usability proof.

Choose measured latency/payload/error budgets in the first Work using the current baseline and representative low-connectivity device profile. Preserve usable text before heavyweight map/media loading. Performance telemetry must not create precise movement histories or personal search logs merely to count conversions.

Treat imported names, descriptions, URLs and instructions as untrusted data. Escape/sanitize rendering and restrict server fetches through the existing allowlisted safe-fetch path; no arbitrary intranet/file/redirect fetch. Imported text cannot alter agent instructions or publication authority. Apply existing report/takedown and write-abuse controls, not a new moderation control plane.

## 12. API, MCP and SDK

Reuse the existing public read contract and privacy/versioning seams: search, suggest, nearby, resolve/detail, hierarchy/related and eligible change/source summaries. A typed object includes its identity/type, source/edition, allowed geometry precision, freshness/state and applicable attribution; no private identity, location or source payload is added to simplify clients.

Use bounded pagination, field selection, request-size/time/rate limits, generation-aware cache keys and a published retry/error contract. API-wide provider capacity is not ZUKAN's user quota. Ordinary public browsing can remain anonymous; bulk redistribution and sustained third-party use need their own operational allowance and rights evaluation. Do not promise free unlimited public APIs.

MCP exposes the same eligible read model and bounded tools, not arbitrary SQL, a second truth path or automatic write authority. SDK follows a proven internal client contract and real external-consumer need; neither is a prerequisite for traveler value. Propagate source notices, correction/withdrawal and per-use restrictions through both.

## 13. Outcome-first rollout

G0–G5 remain design labels, not new canonical Work IDs or permission to reorder existing work. The schedule is not “build all infrastructure, then finally show value.”

| Slice | Bounded outcome | Reuse and exit evidence |
|---|---|---|
| G0 — reconcile | Find current Place/Saved/locale/API sources, exact active Work and genuine gaps | Read actual runtime where needed; reuse completed assets; no blanket restore from an old issue |
| G1 — complete first traveler slice | One local area plus one overseas sample: search → useful detail/local card → save/reopen → eligible directions or next place | Bounded source extract; existing storage; Japanese/English + local names; honest missing-data states; selected small offline summary; exact accepted journey |
| G2 — strengthen search/data | Measured coverage and identity quality across additional domains/density | Add only gap-closing sources; prove refresh/rollback, field freshness, dedupe and map/list consistency |
| G3 — expand languages/markets | Another supported script/locale and market journey without a product fork | Real locale/rights/source coverage; preserve existing languages; material translation checks |
| G4 — deepen local knowledge | More sourced local stories/changes, corrections and return journeys | Existing Record/Review/Publication; no fabricated history, private leakage or compulsory contribution |
| G5 — ecosystem and advanced trips | External consumer, richer collections, routes or full offline packs justified by demand | Same API/rights boundary; actual consumer use and cost evidence before SDK/large offline/optimization |

G1 includes a genuine local-knowledge/record entry where available; the full history engine is not a launch gate. Saved/local-name/offline text are not deferred until a worldwide corpus is finished. Infrastructure scaling can accompany any slice when measured need warrants it; it does not become a competing roadmap.

## 14. Cross-market and domain sampling

Use a locally verifiable area and one selected overseas area with source/rights coverage. Dense-city, another-script, RTL, antimeridian and poor-coverage cases can first be bounded fixtures/read-only samples. Do not make six fully operated cities a prerequisite for the first release. A fixture or sample read is not an overseas market launch.

Sampling must include more than restaurants: a cultural place, nature/area, transport/access point, essential service and an event/record when eligible. Confirm long-tail and rural/low-data behavior rather than reporting only easy branded-city matches. A country can be partially covered and a language partially supported; surface those limits.

## 15. Acceptance cases

These are specification cases, not claimed test results. Bind applicable cases to the current product registry/Work; do not create a second test-state ledger. Runtime-affecting rights, persistence and identity changes need actual behavior/negative tests, while this document revision only requires source review.

| ID | Case | Required result |
|---|---|---|
| GA01 | Park as region and destination; monument as object and destination | One referent with appropriate representations; no duplicate just to satisfy categories |
| GA02 | Same-name branches; mall/tenant; organization/site | Distinct referents; only evidenced reversible merges |
| GA03 | Business move and old photograph | Time-bound site relation; historical record remains at its original site |
| GA04 | Upstream ID/schema change, missing/incomplete feed | Reconcile versioned refs; no automatic deletion or half-published generation |
| GA05 | Overture/OpenPOI repeat one upstream fact | Lineage retained; not two independent confirmations |
| GA06 | Rights for UI but not export/offline; absent license | Only eligible use; notices preserved; unknown not permissive |
| GA07 | Operating status open, unknown hours; holiday/DST | Open-now unknown unless supported; schedule semantics correct |
| GA08 | Stale hours or material source correction | Stale/unknown facts and dependent translations invalidated; import time not verification time |
| GA09 | Public entrance vs private visit/sensitive habitat | Only authorized public projection; legacy minimization and negative disclosure tests remain |
| GA10 | Antimeridian, point-only place, polygon hole, uncertain entrance | Valid geometry handling; no fabricated polygon, membership or route |
| GA11 | Explicit overseas destination with local GPS; GPS refused | Explicit context preserved; text/list journey still works |
| GA12 | Rapid query/pan/back, slow responses, partial coverage | Latest request wins; map/list generation agrees; context and truthful coverage retained |
| GA13 | Saved retry/remove/login/account switch | Actual persistence shown; idempotent reconciliation, no resurrection/cross-account leak |
| GA14 | Offline selected summary, full storage, expiry/withdrawal on reconnect | Only stored eligible material; explicit device/stale state; no claimed offline navigation |
| GA15 | Long local names, CJK/Latin/RTL, missing translation | Readable local original; no fake published locale; correct bidi and locale/date handling |
| GA16 | Sheet/keyboard/text zoom/drag alternative/map failure | Close/back/focus/accessibility work; primary task remains reachable |
| GA17 | Non-food and low-data area, missing media/history | Useful truthful result or coverage state; no invented content or compulsory posting |
| GA18 | Imported markup/hostile text/unsafe URL; API abuse | Existing sanitization, safe-fetch and bounded tools enforced |
| GA19 | Existing citizen, Saved, participation and direct peer entry | No forced traveler shell, new login, lost deep link or second Saved store |
| GA20 | Search/detail/save/handoff completes in representative use | Exact source/runtime and observed outcome recorded; click is not arrival/booking/participation |

Before claiming that foreign visitors want to use it, obtain bounded voluntary usage evidence. Test whether they can find, understand, save/reopen and show a local name without explaining ZUKAN's data model. A small formative sample reveals problems, not market-size or universal usability proof. Use existing permitted channels; this review does not send recruitment messages.

## 16. Measures and stop/expand decisions

Baseline before numerical targets: useful search/detail outcome, failed/unknown coverage, matched aliases by script, duplicate/false-merge rate, stale practical facts, save/reopen success, correction time, representative latency, operating/support cost and voluntary return use. Clicks and dwell time alone are not traveler value. Do not interpret a save as travel intent or record exact movements to measure success.

Expand sources/regions when current slices deliver useful outcomes within the approved envelope. Fix relevance, freshness or comprehension before increasing raw record count. Keep semantic/translation enrichment when its observed benefit exceeds latency/cost/rework. Remove unsupported shelves/actions instead of inventing data or adding AI to hide gaps.

## 17. Non-goals and preserved boundaries

No worldwide full-copy requirement, mandatory Basin/graph/search stack, per-country backend, second tourist auth/Saved service, compulsory chat, default worldwide language generation, automatic private-to-public exchange, person tracking, unsourced safety claims, hidden sponsorship, global route engine or unlimited public API promise.

Preserve free core participation/publication and existing commercial packaging. New spending, rights-sensitive publication, IAM/DNS, protected production changes, external send and destructive operations remain governed by current authority, not this document's ambition.

## 18. Execution continuation

Source baseline for this review is PR #1811 / commit `f98b2258a98f55942e739186fa10793fc98362a7`. This is provenance, not an active runtime or claim. The current global, Quiet Home and Design authorities were re-read for the review; their implementation descriptions likewise do not prove present production state.

Before implementation, Factory resolves the same NOCOSIL Work/intent, or the authorized successor if its earlier outcome is terminal, and the current Place/Saved work already owning any overlap. Do not duplicate or reopen completed Work. Bind revision 1.1, the applicable GA/GP/Quiet Home acceptance, exact mutable scope, source baseline and current protected boundaries. Persist actual acceptance/ownership/next action and Resume through the existing domain writer; no PR/Markdown file substitutes for durable Factory acceptance.

The first implementation outcome is G1's complete bounded traveler journey, not source ingestion alone. Route routine implementation/testing through an authorized replaceable executor and use existing staged publication/rollback. Distinguish design, source-checked, source-published, staging, production and real-user journey evidence. If Work/runtime access is unavailable, report that specific unverified boundary; do not infer non-existence or success from a static document.

## 19. External references and verification scope

Primary documentation consulted on 2026-10-03 for the bounded review. These are documentation checks, not provider runtime tests, legal opinions, measured coverage or a complete census of global datasets. Prefer the actual chosen release/schema/terms at implementation time; a cached guide or a release count is not current imported coverage.

- [R1] OpenPOI reference, preservation/attribution and shared-limit descriptions: https://docs.openpoiapi.com/ (direct open failed; indexed official page retrieved; runtime not exercised).
- [R2] Overture Places: https://docs.overturemaps.org/guides/places/ (source scope, quality caveats, confidence and selective extraction; release examples may be older).
- [R3] Overture Place schema: https://docs.overturemaps.org/schema/reference/places/place/ (operating status is not opening hours).
- [R4] GERS: https://docs.overturemaps.org/gers/ (external identity interoperability; no substitution for ZUKAN authority).
- [R5] Public Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/
- [R6] OSM standard tile policy: https://operations.osmfoundation.org/policies/tiles/ (not the license for all OSM-derived tile providers).
- [R7] GBIF terms: https://www.gbif.org/terms
- [R8] Europeana rights framework and per-object rights: https://pro.europeana.eu/index.php/page/europeana-licensing-framework and https://pro.europeana.eu/index.php/page/available-rights-statements
- [R9] GTFS standard: https://gtfs.org/ (does not establish permission for an individual operator feed).
- [R10] WCAG 2.2: https://www.w3.org/TR/WCAG22/

The original revision's blanket “references checked” wording is superseded by the bounded scope above. Unverified numerical claims about global totals, provider availability, API capacity assigned to ZUKAN or current production completion are not acceptance evidence.
