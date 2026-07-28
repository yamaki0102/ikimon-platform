# Regional Field Guide Intake Implementation Plan

Status: planned; source registration fixture merged  
Contract: [`SPEC.md`](SPEC.md)  
Issue: [#1486](https://github.com/yamaki0102/ikimon-platform/issues/1486)  
Initial source fixture: `source:inabe:green-map:2026`

## 1. Completion conditions

1. A registered field guide can be acquired as a checksummed SourceObject through an operator-only, fail-closed path.
2. Pages and logical regions can be addressed as stable SourceFragments.
3. OCR or vision output is saved as a versioned provisional ExtractionRun.
4. Place, access, season, facility, activity, safety, participation, publication, and editorial candidates link to exact evidence fragments.
5. Existing identities receive proposals, not automatic same-as assertions.
6. Human review can accept, correct, reject, defer, or dispute candidates without overwriting history.
7. Rights, privacy, location, authority, and governance gates prevent unsafe public projection.
8. Re-running the same source edition and extraction version is idempotent.
9. New editions produce an evidence-backed diff without deleting the prior edition.
10. Source Registry growth remains within bounded operator writes through deterministic chunking.
11. Typecheck, targeted tests, Foundation fixtures, local scratch database tests, and review are green.
12. Staging, production, DB apply, external publication, secret access, and remote content acquisition remain separately approval-bound.

## 2. Current baseline

Completed:

- the official Inabe publisher and source metadata are registered
- the source is `INDEX_ONLY / RIGHTS_CLASSIFIED`
- no PDF bytes or expressive content were copied into the repository
- the current full Source Registry plan is 60 entities against the existing 64-entity operator ceiling
- the normative contract is in `SPEC.md`

Not completed:

- byte acquisition and fixity
- SourceFragment persistence and selectors
- ExtractionRun materialization
- Claim candidate generation
- identity proposal and review workflow
- public projection
- production or staging activation

## 3. Ordered implementation stages

### Stage 0 — canonical documentation and fixture

Deliverables:

- `SPEC.md`
- this `PLAN.md`
- source-first ADR
- Source Registry fixture
- source-only tests

Verification:

- registry IDs are unique
- publisher references resolve
- known dates and rights state match official evidence
- no content bytes or page imagery exist in the source change

Rollback:

- revert the registry metadata and documentation commit
- no DB or content cleanup is required

### Stage 1 — deterministic bounded source import

The current planner builds one full-registry batch. Before adding enough sources to exceed the 64-entity ceiling, implement deterministic chunking.

Contract:

- sort by stable source and publisher IDs
- compute a registry snapshot digest
- produce immutable chunk IDs, cursor boundaries, and per-chunk payload digests
- include shared publisher subjects only in the first required chunk or treat exact duplicates as deterministic unchanged rows
- preserve tenant isolation
- use fresh idempotency keys per chunk
- make retry and reordered input byte-stable
- reject missing chunks, changed snapshot digests, conflicting rows, and cursor gaps
- do not raise the safety ceiling merely to avoid chunking

Verification:

- 1, 2, and more than 32 source fixtures
- new and repeated imports
- reordered input
- chunk replay
- interrupted import resumed from the next verified cursor
- conflicting source or publisher row
- entity count never exceeds configured operator policy

Rollback:

- disable chunked apply while retaining source registry metadata
- leave already inserted immutable source rows intact
- resume only from verified receipt state

### Stage 2 — operator-only acquisition and fixity

Deliverables:

- acquisition request contract
- allowlisted official-source URL policy
- bounded download size and timeout
- MIME and file-signature verification
- SHA-256, byte length, retrieved time, storage locator, and fixity receipt
- separate SourceObject from remote URL metadata
- dry-run that performs no persistent write

Verification:

- successful official PDF
- redirect and changed destination
- HTML returned as PDF
- oversized content
- network failure and partial download
- checksum replay
- source URL mutation
- rights class not upgraded by acquisition

Rollback:

- disable acquisition writer
- preserve registry entry and receipt
- remove only uncommitted temporary bytes
- deletion of persisted objects requires separate approval and governance handling

Stop conditions:

- secret, paid service, unbounded egress, private URL, authentication, or production storage is required
- remote terms prohibit the planned acquisition purpose

### Stage 3 — SourceFragment selectors

Deliverables:

- fragment schema for page, logical section, bounding box, map number, table row, list item, notice, and credit block
- canonical selector serialization
- fragment hash derived from source object plus selector and normalized evidence payload
- parent/child fragment relation where needed
- no OCR requirement for registering a visual fragment

Verification:

- two-column and folded layouts
- rotated pages
- overlapping regions
- repeated labels
- a fragment remains addressable after UI rendering changes
- invalid or out-of-bounds selectors fail closed

Migration:

- use existing Foundation tables where sufficient
- any schema extension must have PostgreSQL and D1 migrations, scratch fixtures, backup, compatibility, and rollback evidence before remote apply

Rollback:

- stop new fragment creation
- do not delete fragments already referenced by Claims or review events

### Stage 4 — provisional extraction

Deliverables:

- versioned extraction schema
- deterministic OCR path where possible
- vision path for maps, icons, and mixed layouts
- ExtractionRun receipt with input hash, model/parser identity, prompt/rule version, timestamps, output digest, warnings, and unsupported fields
- protected raw evidence artifact separated from normalized candidates

Initial Inabe fixture coverage:

- publication and credit block
- listed places and map numbers
- season, access, facility, and activity cues
- safety, hazardous organism, preparation, and first-aid sections
- app, QR, quest, monitoring, and participation references
- columns and editorial context

Verification:

- exact rerun produces the same output digest when deterministic
- nondeterministic model runs remain separately identifiable
- no candidate is marked human-confirmed
- unsupported, unreadable, or ambiguous regions stay unresolved
- copyrighted text is not copied into public fixtures

Rollback:

- disable an extraction schema or model version
- keep prior ExtractionRun receipts and mark superseding runs explicitly

### Stage 5 — candidate Claims and identity proposals

Deliverables:

- predicate registry entries or existing predicate mapping for the supported families
- ClaimRevision candidates with time, polarity, visibility, and evidence links
- Place, Organization, Program, and taxon identity proposals
- reason codes and confidence
- no automatic same-as or exact-coordinate inference

Verification:

- duplicate names at different places
- renamed facilities
- stylized map without coordinates
- date-only opening information
- source conflict with another official edition
- organism illustration with uncertain taxon level
- absence from a later edition does not create a negative Claim

Rollback:

- stop candidate generation
- retain provisional Claims and mark the generator version inactive
- never rewrite accepted historical Claim revisions

### Stage 6 — human review and governance

Deliverables:

- review queue scoped by source edition and fragment
- original evidence view and normalized candidate comparison
- accept, correct, reject, defer, and dispute actions
- reviewer or publisher authority assertion
- correction, suppression, and takedown path
- audit receipt for every decision

Verification:

- two reviewers disagree
- publisher correction after publication
- rights withdrawn
- minor or school context discovered late
- rare-species precision downgrade
- reviewer loses authority prospectively

Rollback:

- disable review writes
- preserve decisions and revert only through new events or revisions

### Stage 7 — rights-safe projection

Deliverables:

- Place and source citation projection
- optional walking experience or Quest projection
- data-gap and field-confirmation prompts
- immutable ProjectionSnapshot and PublicationEdition manifest
- source and edition diff view
- fail-closed publication gate

Verification:

- metadata-only source citation
- expressive content without permission
- unknown rights on OCR, image, thumbnail, translation, embedding, or crop
- unresolved dispute or suppression
- sensitive location and minor context
- stale QR destination or usage condition
- prior edition remains reproducible

Rollback:

- add publication availability or snapshot status event
- do not mutate the original manifest
- use kill switch to stop new projection generation

### Stage 8 — staging and production activation

This stage is not authorized by this plan alone.

Required before staging or production:

- exact source SHA
- green source-only and scratch fixtures
- approved migrations if any
- bounded operator action with idempotency
- backup and rollback evidence
- rights and privacy review
- runtime callsite and audit sink
- explicit environment approval
- verification packet and mutation counters

Production publication, DB apply, remote acquisition, secret use, and external sending require separate explicit approval.

## 4. Verification matrix

Minimum source checks:

```bash
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
npm --prefix platform_v2 run plan:zukan-foundation-source-import
```

Additional required checks as implementation grows:

- Foundation source-only fixture
- PostgreSQL scratch database fixture
- D1 scratch database fixture
- deterministic chunk and idempotency tests
- selector canonicalization tests
- extraction eval fixture
- rights and publication gate tests
- privacy and location precision tests
- source edition diff tests
- secret and credential scan
- staged diff inspection
- independent review with no unresolved P0/P1

A local or dry-run PASS is not evidence of staging, production, DB apply, acquisition, or public publication.

## 5. Data and migration policy

- Prefer existing Foundation v2 objects and predicates.
- Do not add a parallel document database or untracked JSON knowledge store.
- Schema changes require PostgreSQL and D1 parity.
- Apply migrations only to scratch environments until explicit remote approval.
- Preserve source bytes and immutable evidence by hash; do not overwrite an existing SourceObject.
- Use append-only revisions and status events for correction, suppression, redaction, and erasure.
- A physical erase may degrade reproducibility and must record that impact.

## 6. Operational evidence

Every write-capable operation must record:

- project, repository, environment, exact source SHA
- tenant and operation
- source registry snapshot digest
- chunk ID and cursor when applicable
- idempotency key
- input and output digest
- inserted, unchanged, conflict, and rejected counts
- rights and policy version
- started and completed time
- mutation counters
- rollback or resume pointer

Live blocker and deployment state remain canonical in `yamaki0102/all-projects-management`, not in this document.

## 7. Global stop conditions

Stop without substitution when:

- the source or edition cannot be identified
- publisher authority or official origin is unresolved
- rights are unknown for a requested public use
- a download requires authentication, secret, payment, or prohibited access
- identity resolution would require guessing
- location disclosure may expose a rare species, minor, home, school, private land, or hazard
- operator chunk integrity or idempotency cannot be proven
- a required migration, DB apply, production action, external publication, deletion, or permission change lacks explicit approval
- an independent review leaves a P0 or P1 unresolved
