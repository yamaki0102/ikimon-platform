# Universal Place Atlas 100-point scorecard

Status values: `pending`, `implemented`, `verified`, `limited`, `blocked`.

`READY_100` is prohibited until every row is `verified`, no P0/P1 remains, and
all required production verification is complete.

## A. Generic area recognition and identity — 15

| Requirement | Status | Evidence |
| --- | --- | --- |
| non-park/school named polygons | pending | #1423 |
| source/kind separation | implemented | `SPEC.md`, ADR-0002 |
| OSM/field canonical merge | pending | migration and registry tests |
| aliases and multilingual names | pending | domain and search tests |
| stable ID across OSM replacement | pending | source-ref/merge tests |
| 常盤/常磐 alias | pending | live search QA |
| mall/retail dedupe | pending | geometry/dedupe tests and AEON QA |

## B. Historic Record membership and reuse — 15

| Requirement | Status | Evidence |
| --- | --- | --- |
| reuse without repost | pending | backfill report |
| Record/Occurrence separation | pending | membership tests |
| no multi-subject double count | pending | membership tests |
| multi-level membership | pending | hierarchy tests |
| meaningful primary place | pending | primary selection tests |
| ambiguity is not confirmed | pending | uncertainty/overlap tests |
| future correction/removal contract | pending | API/schema tests |
| no exact location in public API | pending | API privacy tests |

## C. Regional atlas content — 15

| Requirement | Status | Evidence |
| --- | --- | --- |
| non-biological themes from real data | pending | theme/backfill QA |
| eight requested theme families | pending | theme tests |
| sourced facilities | pending | content tests |
| moderated public Place Memory | pending | privacy tests |
| no private memory | pending | privacy tests |
| guide/rally/event integration | pending | content tests |
| honest gaps | pending | profile tests |
| AI candidates remain provisional | pending | assertion tests |

## D. Search, map, and UI — 12

| Requirement | Status | Evidence |
| --- | --- | --- |
| aliases/JP/EN search | pending | search tests/live QA |
| selectable facility boundary | pending | browser QA |
| contextual large-area display | pending | discovery tests |
| search/Record-near discovery | pending | browser QA |
| recursive hierarchy | pending | API/UI tests |
| mobile peek/full | pending | Visual QA |
| desktop side panel | pending | Visual QA |
| state distinctions | pending | UI tests |
| image fallback | pending | media/UI tests |
| no overflow/overlap/dead end | pending | six-width QA |

## E. Facility rules and privacy — 12

| Requirement | Status | Evidence |
| --- | --- | --- |
| browse/record separation | implemented | `SPEC.md`; runtime pending |
| no OSM-access photography inference | implemented | `SPEC.md`; runtime pending |
| `check_rules` default | pending | policy tests |
| all policy states | pending | policy contract tests |
| restricted CTA suppression | pending | school/private UI tests |
| public place/zone masking | pending | API tests |
| sensitive species masking | pending | regression tests |
| existing face/home privacy | pending | regression tests |
| official/user distinction | pending | content tests |
| no fake official page | pending | UI tests |
| no contributor-list leak | pending | API tests |
| public Memory opt-in/moderation | pending | schema/API tests |

## F. Data integrity and provenance — 10

All rows pending migration, provenance, correction, merge-audit, idempotency,
and forward-rollback verification.

## G. Performance and resilience — 8

All rows pending cache, external outage, lazy profile, abort/sequence,
MultiPolygon/hole/limit, metrics, and Node/Worker parity evidence.

## H. Real-environment QA — 8

| Target | Status | Evidence |
| --- | --- | --- |
| 常磐/常盤 | limited | before-change 23-Record baseline captured |
| JUNGLIA OKINAWA | pending | live OSM found; runtime/backfill pending |
| AEON Mall | pending | live OSM found; runtime QA pending |
| school/restricted | pending | policy browser QA |
| public cell | pending | regression QA |
| six widths | pending | Visual QA |
| Chrome/WebKit/Firefox | pending | browser reports |
| Android/iOS limit | pending | device report |

## I. Operations and evidence — 5

| Requirement | Status | Evidence |
| --- | --- | --- |
| spec/ADR/migration/rollout/rollback | implemented | docs in this directory; migration pending |
| purpose-split PRs | pending | #1422–#1426 |
| staging exact-SHA | pending | release receipt |
| evaluator false negatives | pending | evaluator report |
| production approval truth | pending | central gate evidence |

## Current score

No implementation score is claimed during the expand phase. The final report
must assign points only to rows with reproducible evidence.
