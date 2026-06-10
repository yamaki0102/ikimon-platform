# Place-First Day30 Transition Contract - 2026-06-11

This document compresses sprint days 3-30 into one implementation contract.

It does not mark future calendar days as completed. It records the product and engineering decisions needed before the next PRs.

## 1. Record Creation State Table

| state | input shape | public surface | owner surface | monitoring surface | export lane |
|---|---|---|---|---|---|
| `present_occurrence` | subject + taxon name | standard observation card | record card | presence | occurrence |
| `unknown_subject` | subject without accepted name | standard observation card with pending language | record card | candidate | not export ready |
| `media_no_subject` | photo, video, or audio without subject | place clue | place note | coverage gap | scene / visit |
| `place_note_only` | note, place memory, effort, or revisit context only | place clue | place note | coverage gap | scene / visit |
| `insufficient_coverage` | absent status without target scope and effort | thin coverage | place note | coverage gap | not export ready |
| `valid_non_detection` | target scope + effort + complete checklist | hidden from public feed | scoped non-detection | non-detection | monitoring non-detection |
| `absence_candidate` | repeated valid non-detections | hidden from public feed | non-detection trend | absence candidate | monitoring non-detection |
| `reviewed_absence` | reviewed limited absence | hidden from public feed | reviewed limited absence | absence candidate | monitoring non-detection |
| `fieldscan_session_summary` | FieldScan session/audio bundle | place session | place session summary | coverage gap or non-detection | scene / visit |

Code anchor:

- `platform_v2/src/services/placeFirstRecordState.ts`

## 2. Current Write-Model Boundary

Current `observationWrite.ts` still creates a primary occurrence even for note-only writes.

This is a compatibility boundary, not the final place-first model. The fallback stays during PR0 because:

- `/map` and legacy surfaces are occurrence-first.
- `place_memory_entries.occurrence_id` is still `NOT NULL`.
- compatibilityWriter expects a primary occurrence.

Do not solve this by creating fake species, fake taxa, or dummy biological occurrences.

## 3. Place Memory Decision

Preferred next migration:

- make `place_memory_entries.occurrence_id` nullable
- add `source_kind` with values `occurrence`, `visit`, `scene`, `fieldscan_session`
- keep `visit_id` unique
- keep report / hide / audit tied to `entry_id`

Review before migration:

- `listPlaceMemoryVisits`
- `upsertPlaceMemoryForVisit`
- photo derivative processing
- likes
- reports
- user hides
- admin controls
- audit events
- public cell access rules

Rejected shortcut:

- dummy occurrence for place notes

## 4. Read Model Policy

Public feed:

- show present occurrence and unknown subject cards only
- show media/no-subject and place-note-only as place memory or place clue surfaces, not species cards
- do not mix valid non-detection into ordinary public species cards

Owner view:

- show all of the user's records
- label `valid_non_detection` as `この条件では確認されず`
- label absent without denominator as `判断には対象範囲と努力量が必要`

Monitoring view:

- count presence candidates separately from scoped non-detections
- count non-detection as coverage evidence only when denominator exists
- route thin coverage to Coverage Debt, not absence claims

## 5. Export Boundary

Darwin Core CSV v0 remains occurrence export.

Monitoring non-detection export is a separate lane. A non-detection row must include:

- detection semantic
- target taxa scope
- effort minutes or distance meters
- complete checklist flag
- observed date
- place / cell scope
- claim boundary text

`researchExport.ts` QA now blocks non-detection export when scope, effort, checklist, or claim boundary is missing.

## 6. FieldScan Alignment

FieldScan should be described as a session that gathers place clues.

Allowed copy:

- `この場所のセッション記録`
- `自然音候補`
- `人の声らしい音は保存しない`
- `場所の手がかり`

Required boundary:

- raw audio is private by default
- playback is owner-only
- privacy-deleted clips are not restored
- session recap is a place/visit artifact, not a proof of absence

## 7. Pilot Micro Protocol v0

Use this for observation events, school use, or corporate green-space pilots.

1. Define the place or cell.
2. Define one target scope only when running a non-detection pass.
3. Record effort: minutes or distance.
4. Save photos, video, audio, or notes as place clues.
5. Promote named subjects to occurrences.
6. Keep no-subject media as scene/visit records.
7. Export only reviewed occurrences and scoped non-detections with claim boundaries.

## 8. Day30 Completion Gate

Day30 is considered implementation-ready when:

- record creation states have code tests
- export QA blocks thin non-detection
- Place Memory migration has a review checklist
- FieldScan session summary is treated as scene/visit
- no dummy occurrence path is introduced
- DB migration, production deploy, and PR creation remain explicit approval actions
