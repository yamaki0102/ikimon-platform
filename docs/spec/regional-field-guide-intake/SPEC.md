# Regional Field Guide Intake Specification

Status: active product contract  
Contract version: `regional_field_guide_intake/v1`  
Issue: [#1486](https://github.com/yamaki0102/ikimon-platform/issues/1486)  
Decision: [`decisions/ADR-001-source-first-rights-safe-intake.md`](decisions/ADR-001-source-first-rights-safe-intake.md)  
Implementation plan: [`PLAN.md`](PLAN.md)

## 1. Scope

This contract applies to municipal and community-produced paper maps, PDFs, brochures, field guides, walking maps, nature guides, and comparable edited regional publications.

The purpose is not to build a document gallery. ZUKAN preserves the original source and edition, then derives evidence-backed regional knowledge that can be connected to Place, Program, Organization, taxon candidates, citizen Records, and later Publication editions.

## 2. Normative object boundary

### Source layer

- `Publisher`: issuing, planning, editing, supervising, or contributing organization or person.
- `SourceWork`: the continuing editorial work independent of a specific release.
- `SourceEdition`: a dated or otherwise distinguishable release.
- `SourceObject`: acquired bytes such as PDF, scan, or contributed photograph.
- `SourceFragment`: a page, map number, column, notice, credit block, image region, or other evidence-addressable range.
- `ExtractionRun`: the versioned process that generated provisional output.
- `ContentObject`: OCR, thumbnail, translation, embedding, or other derived artifact.

A public URL is not proof that bytes were acquired. `SourceObject` is created only after byte length, MIME type, SHA-256, retrieval time, and fixity evidence are available.

### Knowledge layer

Extracted knowledge uses existing Foundation objects:

- `SubjectIdentity`
- `Claim` / append-only `ClaimRevision`
- `EvidenceLink`
- `IdentityRelationAssertion`
- `CorrectionRequest` / `DisputeCase`
- `ProjectionSnapshot`
- `PublicationEdition`

Safety, access, season, facility, activity, and participation information are predicate families on Claims, not unversioned free-text fields or a separate untracked object store.

## 3. Source registration contract

A source registry entry must include:

- stable external source ID
- title
- publisher reference
- geographic scope hint
- canonical official URL
- format
- rights class
- lifecycle state
- language
- known issue, update, and retrieval dates
- notes describing unresolved acquisition, rights, or extraction work

A registry entry must not claim that content bytes, checksum, reuse permission, or human review exist unless the corresponding evidence is present.

## 4. Fragment and extraction contract

Every extracted candidate must be traceable to one or more `SourceFragment` records.

A fragment selector must identify the evidence range without relying only on mutable display text. Supported selector forms may include:

- page plus logical section
- page plus bounding box
- map number or stable item label
- structured table row or list item
- credit or notice block

Each `ExtractionRun` records at least:

- input SourceObject and content hash
- extraction schema version
- model or deterministic parser identity
- prompt or rule-set version where applicable
- started and completed time
- output digest
- errors and unsupported fields

OCR or vision output is `provisional`. It is not a confirmed Claim merely because the extraction succeeded.

## 5. Claim candidate families

The initial profile supports candidate extraction for:

1. publication
   - publisher, planner, editor, supervisor, contributor
   - issue date, edition label, contact channel
2. place
   - listed location, map number, place type
   - address or official area description
   - access, parking, toilet, reservation, opening or usage condition
   - relation to river, mountain, administrative area, or route
3. experience
   - recommended season
   - walking, river play, camping, observation, learning, or similar activity
   - audience, duration, required equipment
4. nature
   - named organism or plant candidate
   - habitat or observation statement
   - taxon candidate linked to an image or illustration fragment
   - regional environmental description
5. safety
   - access restriction and weather or water warning
   - hazardous organism or plant
   - clothing, equipment, first aid, and emergency guidance
6. participation
   - QR destination, official page, app, citizen-science project, quest, or monitoring program
   - a question or missing fact suitable for later field confirmation
7. editorial knowledge
   - column, resident or specialist voice, regional background, and editorial classification

Fields absent from the source must remain absent. The system must not infer exact coordinates, current opening hours, access permission, or species certainty from layout proximity or general knowledge.

## 6. Evidence and review states

A candidate Claim must retain:

- source edition ID
- fragment ID
- extraction run ID when machine-derived
- captured source wording or protected internal evidence artifact
- normalized candidate value
- confidence and reason codes
- review state
- reviewer or authority assertion when confirmed

Review states distinguish at least:

- `provisional_machine`
- `provisional_manual`
- `human_asserted`
- `publisher_confirmed`
- `rejected`
- `disputed`

Changing a value creates a new ClaimRevision or review event. It does not overwrite the prior evidence or silently mutate a published snapshot.

## 7. Identity resolution

Place, Organization, Program, and taxon candidates may be proposed against existing identities.

- Name similarity, map proximity, or an external URL may create a link proposal.
- A proposal must not become automatic `same-as`.
- Ambiguous candidates remain ambiguous and retain all supporting evidence.
- Administrative boundary changes and renamed places must not change immutable internal IDs.
- Public identifiers are not reused.

## 8. Rights and publication boundary

The default for an official public PDF without explicit reuse permission is `INDEX_ONLY`.

- Safe bibliographic metadata and the official URL may be displayed.
- Source wording, photographs, illustrations, maps, and layout are not republished without a valid rights basis.
- Facts may become paraphrased Claims only when linked to evidence and reviewed under the applicable policy.
- OCR, thumbnails, translations, embeddings, and crops are separate ContentObjects with separate rights evaluations.
- `unknown` rights fail closed for public publication, redistribution, embedding, AI input, and model training.
- A QR destination or usage condition is recorded as observed at retrieval time; it is not asserted to remain current automatically.
- Rare species, minors, schools, private land, homes, and hazardous locations use coarse, restricted, or hidden public location policies.
- Suppression, redaction, and erasure follow Foundation governance events and do not rewrite immutable Publication manifests.

## 9. Time and edition behavior

- A new issue or materially changed file creates a new SourceEdition.
- The current edition does not overwrite prior editions.
- Edition comparison produces candidate changes, not automatic deletion of old Claims.
- Each Claim retains valid, observed, recorded, and publication time where applicable.
- A later absence in a guide is not proof that a Place, organism, facility, or restriction ceased to exist.

## 10. Initial fixture

The first registered example is:

- publisher: `publisher:inabe-city`
- source: `source:inabe:green-map:2026`
- format: `pdf`
- rights class: `INDEX_ONLY`
- registry state: `RIGHTS_CLASSIFIED`
- geographic scope hint: `place:jp-mie-inabe`

The fixture may be used for source-only and local scratch verification. PDF bytes, page images, OCR output, Claims, or public projection require the later stages and gates in `PLAN.md`.

## 11. Public projection contract

No extracted item becomes public merely because it exists in the intake store.

A public projection must verify:

- accepted ClaimRevision and predicate version
- evidence reachability
- rights allowed for the publication purpose
- valid authority and review state
- privacy and location policy
- unresolved dispute, correction, suppression, or takedown status
- immutable ProjectionSnapshot and PublicationEdition manifest

A projection may expose a source link, Place card, walking experience, Quest, update request, or publication view only when all applicable gates pass.

## 12. Non-goals

This contract does not:

- replace the original publisher
- mirror or redistribute a brochure by default
- treat OCR as authoritative
- auto-identify every illustrated organism
- assert exact route geometry from a stylized map
- make the guide a scientific survey or infer non-detection
- activate production ingestion, DB writes, or public publication

## 13. Acceptance criteria

- Original source, edition, object, fragment, extraction, Claim, and review provenance can be traversed in both directions.
- Re-running the same edition and extraction version is idempotent.
- A corrected value preserves prior revisions and evidence.
- Identity ambiguity is retained rather than forced.
- Rights-unconfirmed expressive content cannot enter a public Publication.
- Missing source information is not fabricated.
- A later edition can be compared without deleting the historical edition.
- Additional sources can be imported through bounded, deterministic batches defined in `PLAN.md`.
