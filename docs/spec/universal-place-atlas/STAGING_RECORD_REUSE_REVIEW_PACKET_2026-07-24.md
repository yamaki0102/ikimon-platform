# Universal Place Atlas staging historic Record reuse review packet

## Review target

- Repository: `yamaki0102/ikimon-platform`
- Base SHA: `31e3e46e1c76aa3ccf3c6383ed72e31cc961608a`
- Target commit: `02d77f558c39452dd69b676578b3cc36758cae2a`
- Draft PR: `#1434`
- Runtime implementation:
  `platform_v2/cloudflare_shadow/src/placeAtlasProfileNative.ts`
- Contract test:
  `platform_v2/cloudflare_shadow/src/placeAtlasProfileNative.test.ts`

## Root cause

The canonical Place registry and Record membership backfill were present, but
the Cloudflare Place profile read path only consumed
`public_map_snapshot_records_v1`. The 94 public historical import Records in
the canary boundary envelopes had no matching snapshot rows, so a successful
membership backfill still produced an empty Place profile.

## Proposed read path

For a registered canonical Place, the Worker reads bounded rows from:

1. `record_place_memberships`;
2. `production_import_visits`;
3. `production_import_occurrences`; and
4. public media/theme read models.

The confirmed membership projection is merged with the existing
geometry-scoped public snapshot path. It is bounded to 501 input rows and
publishes at most 500 unique Records.

Only membership rows satisfying all of the following can enter the profile:

- canonical `place_id` match;
- `public_precision = 'place'`;
- `public_visibility = 'public'`;
- `membership_state = 'confirmed'`;
- `removed_at IS NULL`;
- no withdrawn data-rights row;
- an explicit active data-rights row exists and uses `public_summary` or
  `external_export`.

`observation_data_rights.visit_id` is the table primary key. The rights
contract is therefore Record/visit scoped; `occurrence_id` is optional
provenance metadata and cannot have multiple independent rights rows for the
same Record. A prior external review's Occurrence-level withdrawal concern is
incompatible with this schema invariant.

Migration `0069_place_atlas_legacy_import_public_rights.sql` converts only
preexisting `public_visibility = 'public'` imports into a provenance-marked
`public_summary` rights envelope. It grants no research, enterprise, dataset,
media, or external-export permission. Existing explicit rights rows win.

Candidate or removed membership record IDs are loaded through a separate
bounded query and suppress the same Record if it would otherwise be included
by the geometry snapshot. If that exclusion query exceeds 5,000 unique
Records, geometry fallback is suppressed in full and the profile becomes
partial. Exact coordinates and user identity are not selected by either
membership query and are not included in the public contract.

That exclusion query also joins the Record-scoped rights row and source visit.
It suppresses geometry fallback for private, missing-rights, withdrawn, or
non-public-consent membership Records. Independently, the geometry read path
now requires the same live public-visibility and active positive-rights gate
for every snapshot Record, including geometry-only Records. This closes the
stale-snapshot race where a rights withdrawal could precede regeneration of
`public_map_snapshot_records_v1`. If the rights or source-visit table is
unexpectedly missing, geometry fallback returns no Record rather than treating
the snapshot as currently authorized.

Rows are merged and bounded by `recordId` before profile construction, while
preserving the strictest identification state and safe media fallback. The
existing `buildPlaceAtlasProfile` contract retains a second dedupe boundary.
Multiple Occurrences in one historical Record therefore neither increase the
public Record count nor consume multiple entries in the 500-Record bound.

The import table has no `is_ai_candidate` column. Its available provenance is
`quality_grade`. The read projection maps `ai_judgement` to `ai_candidate`,
maps `research_grade` and `verified` to confirmed, and maps other/empty grades
to `awaiting_identification`. This is intentionally fail-closed without
mislabeling unknown human provenance as AI: the staging canary currently
contains 94 `ai_judgement` Occurrences across 53 Records and 56 empty-grade
Occurrences across 56 Records, so none is presented as a confirmed
identification.

If optional historical import tables are unavailable, the existing bounded
public-snapshot/geometry path remains available.

## Staging data evidence

The staging-only backfill used internal exact positions, without persisting
them in the report or generated membership SQL.

- input: 94 unique Records;
- source Occurrences: 255;
- matched: 85 Records;
- confirmed memberships: 70;
- candidate memberships: 15;
- outside all boundaries: 9;
- themes: 94;
- source Records mutated: false;
- rerun final counts: unchanged;
- pre-apply D1 Time Travel bookmark captured;
- production DB: untouched.
- membership Records with no source visit: 0 of 85;
- source Occurrences with no source visit: 0 of 1,332;
- the import schema uses `production_import_visits.visit_id` as the Record ID
  and Occurrences reference that ID many-to-one; a Record is not an aggregate
  across multiple visits.

Canary breakdown from the privacy-safe summary:

- JUNGLIA OKINAWA: 56 matched, 54 confirmed, 2 candidate;
- 常磐公園: 29 matched, 16 confirmed, 13 candidate;
- two selected AEON Mall places: no matching staging Records.

## Verification already performed

- Worker TypeScript check: pass.
- Final Worker tests: 403 pass, 0 fail.
- Final Worker TypeScript check: pass.
- Focused final tests: 21 pass, 0 fail.
- Final platform typecheck: pass.
- Final platform build: pass.
- Final platform Node tests: 1,410 pass, 0 fail.
- Staging D1 query-plan verification:
  - membership lookup uses the Place index, visit primary-key index,
    rights primary-key index, and Occurrence visit index;
  - exclusion lookup uses the Place index plus visit/rights primary-key
    indexes;
  - query-plan SQL durations were 0.330 ms and 0.288 ms respectively on the
    canary Place before runtime deployment.
- New test covers:
  - confirmed historical Record reuse;
  - multiple Occurrences counted as one Record;
  - candidate membership exclusion;
  - exclusion overflow fail-closed behavior;
  - merged geometry plus membership overflow becoming partial;
  - positive public-rights requirement and legacy public-rights migration;
  - exact-coordinate and user-identity key exclusion;
  - provenance marking when the membership projection is used.
  - unverified historical import identifications remaining provisional.
  - stale public snapshots remaining excluded after a Record rights
    withdrawal.
- Backfill SQL scan:
  - exact coordinate tokens: 0;
  - `DELETE`: 0;
  - `DROP`: 0;
  - production references: 0.

## Requested review

Return findings with severity `P0`, `P1`, or `P2`, and explicitly answer:

1. Can private, withdrawn, candidate, removed, or internal-only Records leak?
2. Can a Record with multiple Occurrences inflate the public Record count?
3. Can geometry fallback reintroduce a candidate or removed Record?
4. Is optional-table fallback fail-closed enough for privacy?
5. Is the 500-row bound and partial-state behavior honest?
6. Does the implementation create unacceptable D1 latency or query fan-out?
7. Is there any P0/P1 that must block staging deployment?

Schema and implementation facts that must be used in the answer:

- `observation_data_rights` has exactly one row per `visit_id` because
  `visit_id TEXT PRIMARY KEY`;
- `production_import_occurrences` has `quality_grade` but no
  `is_ai_candidate`;
- imported identification confirmation uses only `research_grade` or
  `verified`;
- the asset subquery is keyed only by indexed `visit_id`, not an `OR` across
  visit and Occurrence;
- exclusion of a Record when confirmed and older candidate/removed
  calculations coexist is a deliberate fail-closed false negative, not a
  disclosure.

This is a defensive privacy review for a consent-based location service.
Do not propose exposing exact coordinates or contributor identity.
