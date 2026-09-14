# Paid-derived source surface audit

Status: `SOURCE_VERIFIED / STANDARD RECAP BOUNDARY CLOSED`

Audit date: 2026-09-15 (JST)

Work: `ZUKAN-PAID-SOURCE-01` and `ZUKAN-PAID-SOURCE-04`

Audit base: `yamaki0102/ikimon-platform@fc14449bb5bd9a552e4ec9d936f584c9d325bf64`

## Scope

Classify the current species-list, aggregation, export and view surfaces before adding any generic paid-output implementation. The audit keeps the free Program/Event operational summary separate from specialist biodiversity outputs and does not add payment, billing, database, migration, route activation or runtime changes.

## Current surface disposition

| Surface | Current source | Disposition |
|---|---|---|
| Free event recap | `platform_v2/src/services/observationEventRecap.ts`, `platform_v2/src/ui/observationEventRecap.ts` | Standard recap now exposes operational counts only. Derived `species_count`, `topTaxa` and team/personal species counts were removed. Individual taxon labels in the sanitized timeline remain record-level display data. |
| Free raw-record portability | `platform_v2/src/services/programRawRecordPortabilityArchive.ts` | Existing source-only archive preserves Record/media/provenance/lifecycle granularity and rejects taxon inventory, composition and report fields. Reuse; do not reimplement. |
| Specialist official event output | `platform_v2/src/services/observationEventOfficialReport.ts` and `platform_v2/src/routes/observationEventRecapApi.ts` | Separate explicit report/CSV surface. It remains outside the standard recap change and retains its own access and claim boundary. |
| Research export | `platform_v2/src/services/researchExport.ts` | Existing specialist/export adapter with license, consent, location and verification blockers. It is not a generic free operational summary or a new TaxonInventory engine. |
| Regional public views | `platform_v2/src/services/publicationFeed.ts`, `landingSnapshot.ts` and existing feed routes | Existing public projection / discovery surfaces. Reuse their rights and publication gates; no second feed or profile engine is justified by this audit. |
| Generic paid derived types | `TaxonInventory`, `ProfessionalReport`, `PromotionalPublication`, `CouponCampaign` | No generic implementation was found in the current source. These remain separate future contracts and are not activated by this Work. |

## Boundary decision

`ObservationEventRecap` is the current observation-event Program profile's standard recap. Its aggregate species count, top-taxa list and team/personal species counts were paid-derived or biodiversity-summary signals leaking into the free operational surface. The source candidate removes those aggregate fields while preserving observation, guide, scan, absence, participant, Quest, effort, coverage and impact measures.

The official report and CSV remain separate explicit outputs. This Work does not infer a pricing decision or make those outputs publicly available; a future paid-output Work must bind its rights, review, audience and delivery contract independently.

## Verification

- `npm exec -- tsx --test src/ui/observationEventRecap.test.ts src/services/observationEventRecapPrivacy.test.ts` — 4 passed, 0 failed.
- `npm run typecheck` — passed.
- `npm exec -- tsx --test src/productRegistryM7M8.test.ts src/ui/observationEventRecap.test.ts src/services/programRawRecordPortabilityArchive.test.ts` — 33 passed, 0 failed.
- `git diff --check` — required before commit.

These are source checks only. No staging or production runtime release is claimed by this audit.
