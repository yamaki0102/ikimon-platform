# ADR-001: Source-first, rights-safe intake for regional field guides

- Status: accepted
- Date: 2026-07-28
- Contract: [`../SPEC.md`](../SPEC.md)
- Plan: [`../PLAN.md`](../PLAN.md)
- Initial fixture: `source:inabe:green-map:2026`

## Context

Municipal and community-produced maps and field guides combine multiple kinds of regional knowledge in one edited publication: places, seasons, activities, access, safety, organisms, programs, contributors, and local interpretation.

Treating the publication only as a PDF loses the ability to connect its contents to Place, Claim, Evidence, Record, review, and later editions. Treating OCR output as immediate public knowledge loses provenance, rights, identity ambiguity, and editorial context.

Public availability also does not grant general permission to reproduce text, photographs, illustrations, maps, or layout.

## Decision

ZUKAN will use a source-first intake model.

1. Register Publisher, SourceWork, and SourceEdition before extracting knowledge.
2. Create SourceObject only when acquired bytes and fixity evidence exist.
3. Address evidence through SourceFragments.
4. Record OCR and vision work as versioned provisional ExtractionRuns.
5. Convert facts into evidence-backed Claim candidates rather than republishing source expression.
6. Keep identity links as proposals until reviewed; do not auto-assert same-as.
7. Default an official public guide without explicit reuse permission to `INDEX_ONLY`.
8. Evaluate OCR, thumbnails, crops, translations, embeddings, and other derivatives as separate ContentObjects.
9. Fail closed for public projection when rights, authority, privacy, location safety, review, dispute, or governance state is unresolved.
10. Preserve editions and Claim revisions append-only so a new guide or correction does not rewrite history.
11. Scale ingestion through deterministic bounded chunks instead of raising write ceilings without control.

## Alternatives considered

### Store only the original PDF or photographs

Rejected as the sole model. It preserves the artifact but not reusable, reviewable, evidence-linked regional knowledge.

### Store OCR as a searchable text dump

Rejected. It conflates source expression with facts, cannot reliably represent maps and visual layouts, and makes rights and correction boundaries unclear.

### Copy the guide into ZUKAN pages immediately

Rejected. Public access is not a reuse license, and the publication may contain copyrighted text, photographs, illustrations, and layout.

### Convert every listed item directly into a confirmed Place or species

Rejected. Names may be ambiguous, maps may be stylized, organism depictions may not support species-level certainty, and conditions may be time-bound.

### Overwrite the current record when a new edition appears

Rejected. It destroys evidence and prevents reproduction of earlier public views or decisions.

### Increase the 64-entity operator ceiling for each registry expansion

Rejected as the default response. The safer design is stable ordering, snapshot digests, bounded chunks, and idempotent resume.

## Consequences

Positive:

- source, evidence, Claim, identity, review, and publication remain traceable
- multiple sources and citizen Records can accumulate around the same Place
- rights and privacy are enforceable per purpose and derived artifact
- later editions can be compared without deleting history
- machine extraction can accelerate work without becoming the authority

Costs:

- intake requires more stages than file upload
- public projection is delayed until review and rights gates pass
- fragment selectors, extraction receipts, identity proposals, and review tooling must be implemented
- bounded chunking is required as the registry grows

## Follow-up

Implementation follows [`../PLAN.md`](../PLAN.md). The Inabe Green Map remains the first source fixture; it does not authorize acquisition, DB apply, or public reproduction by itself.
