# ZUKAN Regional Source Registry / Publication Pipeline

- Date: 2026-07-28
- Status: adopted implementation contract
- Scope: current Node runtime under `platform_v2/`
- Strategy source: `yamaki0102/ikimon-business-strategy/strategy/zukan-regional-knowledge-publisher-publication-model-2026-07-28.md`
- Runtime / DB changes: none in this document

## Decision

ZUKAN is not an Iwata-only open-data viewer. It is a source-neutral regional knowledge database.

Municipal open data, national and prefectural sources, tourism authorities, DMO and tourism associations, general incorporated associations, schools, neighborhood groups, companies, shops, farms, citizen groups and individuals are all valid publishers.

Paper maps, PDFs, websites, event pages and reports are publications produced from or connected to the database. They are not separate databases.

## Core contract

### Publisher

A legal or informal actor that publishes, edits, supervises, supplies or owns rights in a source.

Required:

- stable `publisherId`
- name
- actor type
- official URL when available
- relationship to source: publisher, editor, supervisor, provider, sponsor, rights holder

### SourceAsset

A discoverable original source such as API, CSV, RDF, HTML, PDF, paper map, image or contributed spreadsheet.

Required:

- stable `sourceAssetId`
- title
- publisher relationships
- canonical URL or physical holding metadata
- media / format
- geographic scope
- rights classification
- discovery and acquisition state

### SourceEdition

A dated, versioned or language-specific edition of a SourceAsset.

Required:

- stable `sourceEditionId`
- edition label
- issued / updated / retrieved dates when known
- language
- canonical URL
- checksum when acquired
- previous / next edition relationship

### SourceRecord

The smallest extracted unit with locatable evidence inside the source.

Examples:

- one CSV row
- one HTML card
- one PDF listing block
- one numbered map point
- one route segment
- one event listing

Every extracted value must retain source coordinates such as row, cell, page, bounding box, selector or record ID when possible.

### Place / Entity / Claim

Source records are not auto-promoted to canonical places.

- `Place`: enduring spatial identity
- `Entity`: facility, shop, organization, event, heritage asset, taxon, etc.
- `Claim`: individual statement such as name, address, opening hours, description, category or status

Entity-linking produces candidates. Human review or source-owner approval confirms high-impact identity changes.

### Publication

A selected and edited output: website page, map layer, paper map, PDF, event guide, report or campaign page.

Each publication edition must preserve a manifest containing:

- selected Place / Entity IDs
- selected Claim IDs
- source edition IDs
- query and filters
- extraction timestamp
- editorial changes and exclusions
- editors and reviewers
- output checksum

## State machine

`DISCOVERED -> RIGHTS_CLASSIFIED -> ACQUIRED -> PRESERVED -> EXTRACTED -> NORMALIZED -> LINK_PROPOSED -> HUMAN_REVIEWED -> PUBLISHED`

Historical editions move to `SUPERSEDED` or `RETIRED` but remain queryable.

## Rights classes

- `OPEN_REUSE`: structured data and derived publication allowed under stated license
- `ATTRIBUTION_REUSE`: reuse allowed with required attribution
- `FACTS_ONLY`: metadata and factual candidates can be structured; source layout, images and prose are not republished
- `INDEX_ONLY`: only bibliography, existence, publisher, edition and source link are public
- `CONTRIBUTED_PRIVATE`: supplied for internal editing; only approved derivatives are public
- `RESTRICTED`: no public output
- `UNKNOWN`: acquisition or public derivation pauses at the appropriate boundary

Analysis permission and republication permission must be stored separately.

## Adapter boundary

Adapters are implemented by format or platform, not by municipality.

Priority adapters:

1. Japanese municipal standard open-data datasets
2. CKAN
3. LinkData / RDF
4. ArcGIS REST / FeatureServer
5. Socrata
6. CSV / Excel / Google Sheets
7. GeoJSON / KML
8. HTML index and detail pages
9. text PDFs and tables
10. image-heavy map PDFs
11. publisher upload templates

Publisher-specific behavior belongs in configuration unless a source cannot be represented by the common adapter contract.

## First source registry

The first read-only registry includes:

- Iwata City open-data landing page
- Iwata tourism facilities dataset
- Iwata urban parks dataset
- Iwata community centers dataset
- Iwata cultural properties dataset
- Iwata City tourism pamphlet page
- Iwata Tourism Association pamphlet / walking-map page
- MIYAKODA official website
- MIYAKODA `都田わくわくMAP2025` PDF
- Japan Tourism Agency tourism-DX standardization topic page
- TOKYO Brochures as an external publication-catalog example

This registry records discovery and rights state only. It does not assert permission to republish PDF text, images or layouts.

## MIYAKODA target flow

1. Register MIYAKODA as Publisher.
2. Register the website, current map PDF and future editions as SourceAsset / SourceEdition.
3. Extract map listings as SourceRecord candidates.
4. Match candidates to existing Place / Entity records without automatic merge.
5. Let MIYAKODA review listing, correction and publication state.
6. Generate next-edition candidate lists and a publication manifest.
7. Keep the designed paper map as a human-edited publication with QR links to live Place pages.

## API surface

P0 read-only endpoints:

- `GET /api/regional-sources`
- `GET /api/regional-sources/:sourceAssetId`

Future internal endpoints must be authenticated and are outside this source-only change:

- acquisition run
- extraction review
- link confirmation
- rights approval
- publication manifest generation

## Verification

- registry IDs are unique and stable
- all sources retain publisher and canonical URL
- every source has explicit rights and acquisition state
- PDF sources default to `INDEX_ONLY` or `FACTS_ONLY` until rights are confirmed
- municipal and non-municipal publishers coexist in the same schema
- the current Iwata open-data view remains compatible

## Explicit non-goals for P0

- no database migration
- no production or staging deployment
- no crawling or downloading of all PDFs
- no OCR pipeline
- no publication of extracted MIYAKODA listings
- no automatic Place merge
- no assertion that ZUKAN is the official source of an external publisher's claims
