# CURRENT INVENTORY — Record / Observation migration PR-A

## 1. Status

- initiative: `record-detail-observation-migration`
- phase: `PR-A — Contract and inventory`
- central execution: `yamaki0102/all-projects-management#435`
- implementation issue: `yamaki0102/ikimon-platform#1376`
- audited source ref: `main@56db3d1ca73ab9851d357e1db51f19843b64c879`
- audit date: `2026-07-20 JST`
- runtime behavior change in this document: none

This inventory is the source-backed starting point for the additive observation-first migration. It does not treat current names as the target contract and does not authorize DB/D1 mutation.

## 2. Evidence labels

- `confirmed`: directly shown by current source, migration, test, or merged PR evidence
- `inferred`: strongly implied by confirmed evidence but the complete path has not yet been traced
- `unknown`: not yet proven; do not freeze a physical name or migration rule from it
- `conflict`: confirmed current behavior that differs from `SPEC.md`
- `reuse`: confirmed current capability that should be preserved and adapted

## 3. Executive finding

The current application already has substantial AI, review, privacy, environment, and monitoring capabilities. The main problem is not absence of functionality. It is that the current entity boundary is inconsistent across PostgreSQL, Cloudflare D1, AI persistence, read models, and scientific export.

The safest path remains:

```text
expand
→ dual-write
→ backfill
→ shadow-read
→ cutover
→ contract
```

A destructive rename or a direct replacement of `occurrences` is not acceptable because current public pages, writes, AI review, monitoring packages, rights, and compatibility paths depend on occurrence- or visit-shaped data.

## 4. Current topology

### 4.1 PostgreSQL current model

Confirmed from `platform_v2/db/migrations/0001_extensions_and_core.sql`:

```text
visits 1 ── 0..N occurrences
visits 1 ── 0..N evidence_assets
occurrences 1 ── 0..N evidence_assets
occurrences 1 ── 0..N identifications
places 1 ── 0..N visits
```

Key facts:

- `visits` contains observed time, place, owner, point location, note, and source payload.
- `occurrences` contains subject index, taxon names, organism context, count, AI status, quality, biome, and evidence tags.
- `evidence_assets` may reference both `visit_id` and one `occurrence_id`; there is no explicit observation-media many-to-many link table in the initial schema.
- `identifications` references `occurrence_id`, uses `actor_kind`, and marks a row with `is_current`; the target `candidate / accepted / rejected / withdrawn` lifecycle is not explicit in this table.
- `place_conditions` mixes place/visit conditions with some organism context.

Classification: `confirmed`, with multiple `conflict` items against the observation-first target.

### 4.2 Cloudflare D1 current model

Confirmed from:

- `platform_v2/cloudflare_shadow/migrations/observations/0066_cloudflare_native_observation_ai_backfill.sql`
- `platform_v2/cloudflare_shadow/migrations/observations/0022_observation_identifications.sql`
- `platform_v2/cloudflare_shadow/src/ownerObservationProcessingStatus.ts`

Current compatibility shape:

```text
observations row
├── asset_ledger rows by observation_id
├── observation_reassessment_requests by observation_id
├── synthetic occurrence id: occ:<observation_id>:0
├── observation_ai_review_targets by occurrence_id
└── observation_identifications by occurrence_id
```

Key facts:

- owner processing status reads one `observations` row by `observation_id` and `owner_user_id`.
- AI and identification lookup derives `occ:<observation_id>:0` rather than reading a first-class child observation collection.
- media processing and AI reassessment are durably separated.
- D1 `observation_identifications` still stores `occurrence_id`, `stance`, and `is_current`; it does not yet express the target observation lifecycle and accepted-identification transition.
- the physical creation migration and all constraints for D1 `observations` and `asset_ledger` still require a complete directory-level audit.

Classification: confirmed compatibility mapping; full D1 schema inventory remains partly `unknown`.

## 5. Current entity → target entity mapping

| Current entity / shape | Current responsibility | Target responsibility | Status |
|---|---|---|---|
| PostgreSQL `visits` | posting container, time, owner, place, note, precise point | `record` source/container | `confirmed`, strong reuse |
| D1 `observations` row | native saved record plus compatibility observation/visit identity | likely `record` source/container, not a child biological observation | `confirmed` behavior; target physical mapping pending |
| PostgreSQL `occurrences` | subject, taxon, AI result, quality, scientific/export record | split into `observation`, `identification`, and derived `occurrence projection` | `confirmed conflict` |
| synthetic D1 `occ:<observation_id>:0` | compatibility subject/occurrence identity | temporary compatibility projection only | `confirmed conflict` |
| `evidence_assets` / `asset_ledger` | media and processing state | record-owned `media` | `confirmed reuse` |
| `evidence_assets.occurrence_id` | one asset-to-one occurrence attachment | observation-media many-to-many link | `confirmed conflict` |
| PostgreSQL `identifications` | human/AI proposed name and current marker | identification claims with explicit source and lifecycle | `confirmed partial reuse` |
| D1 `observation_identifications` | public identification writes by occurrence ID | observation-scoped identification claims | `confirmed partial reuse` |
| `observation_ai_review_targets` | AI candidate and human-review target | provisional observation and/or AI identification candidate | `confirmed partial reuse` |
| AI `coexisting_taxa` / candidate readings | multiple visible subject candidates | provisional child observations with media locators | `confirmed reuse` |
| `place_conditions` / environment record payloads | environment/context values | versioned environment assessments | `confirmed partial reuse` |
| monitoring package/events | staged monitoring/export workflow | monitoring series/read models and governance | `confirmed partial reuse` |
| `observation_data_rights` | visit-level rights and export consent | record/observation/research-use gate input | `confirmed reuse`, cardinality review required |
| civic/governance contexts | public precision, risk, report consent, roles | common privacy/governance policy inputs | `confirmed reuse` |

## 6. AI and multi-subject inventory

### 6.1 Reusable capability

Confirmed in `platform_v2/src/services/observationReassess.ts` and merged PR #473:

- Gemini output supports `candidate_readings`.
- Gemini output supports `coexisting_taxa`.
- media-region structures include asset/image index, rectangle, frame time, confidence, and note.
- a multi-subject guard promotes secondary candidate readings.
- a visual rescue pass can recover secondary subjects when the first pass loses them.
- environment inference and shot suggestions are already produced.

These capabilities should be retained. The migration changes their persistence boundary, not their analytical purpose.

### 6.2 Confirmed promotion conflict

`platform_v2/src/services/aiJudgementObservationRecords.ts` currently:

1. assigns the next `subject_index` in `occurrences`;
2. generates an `occurrence_id`;
3. inserts an AI-only subject directly into `occurrences`;
4. labels it `ai_only_unreviewed` / `ai_judgement`;
5. updates existing rows when the candidate key matches.

This preserves idempotency better than blind insertion, but it still conflates provisional AI subject data with occurrence storage.

Target change:

```text
AI candidate
→ provisional observation
→ AI identification candidate
→ human/community/reviewer transition
→ accepted identification
→ active occurrence projection
```

The existing candidate-key deduplication, confidence normalization, provenance payload, and subject index logic are candidates for reuse in PR-C.

### 6.3 Cloudflare AI gap

`platform_v2/cloudflare_shadow/src/cloudflareObservationAi.ts` currently asks for the main organism and returns one candidate object. This is safe as a human-review candidate, but it does not provide target-level multi-subject child observations.

Classification:

- single candidate review: `confirmed reuse`
- multi-subject parity with the Node/Gemini path: `unknown / incomplete`
- direct AI promotion to accepted identification: not found in the inspected file

## 7. Write-path inventory

### 7.1 Confirmed durable behavior

Current implementations already preserve important migration requirements:

- user save is separated from AI completion;
- media processing and AI reassessment use durable request/outbox state;
- recent D1 photo upload writes media state and reassessment intent atomically;
- exact retry input is intended to be idempotent;
- AI candidates are presented as human-review targets rather than confirmed names in the recent Cloudflare path.

Classification: `confirmed reuse`.

### 7.2 Material conflicts to remove only after replacement exists

- Node AI secondary subjects can be persisted as `occurrences`.
- PostgreSQL and D1 use different top-level naming and compatibility IDs.
- identification writes are occurrence-ID based in both inspected schemas.
- media association is not represented as an explicit many-to-many observation link.
- rights and governance are predominantly visit-level and may not support per-observation exceptions.

Classification: `confirmed conflict`.

### 7.3 Unknown write paths requiring source tracing

Before PR-B or PR-C implementation, trace and classify:

- every writer to PostgreSQL `occurrences`;
- every writer to PostgreSQL `identifications`;
- every writer to D1 `observations`;
- every writer to D1 `observation_ai_review_targets`;
- candidate, dispute, reviewer, management-confirmation, import, and backfill routes;
- passive audio, FieldScan, observation-event, rally, and imported-record creation paths;
- writes that treat `occurrence_status`, `quality_grade`, or `ai_assessment_status` as promotion gates;
- any direct research/export writer that bypasses rights or human provenance.

These are `unknown` until a clean checkout search and route-level call graph are recorded.

## 8. Read-path and UI inventory

### 8.1 Confirmed current compatibility

- current owner processing status returns both `occurrenceId` and `visitId` compatibility identifiers from one D1 observation row.
- contribution receipt/detail links have historically used visit plus subject/occurrence compatibility parameters.
- record detail can show media processing, AI request, AI candidate, and identification counts separately.
- a dedicated identification workbench exists independently of passive feed display.

Classification: `confirmed reuse`, but not the target record/observation card model.

### 8.2 Required read-path audit

Trace the complete source for:

- public record detail;
- owner record detail;
- observation detail redirects;
- media/image detail;
- public cards and feeds;
- owner list and identification workbench;
- map and search payloads;
- JSON APIs;
- structured data / JSON-LD;
- public field/area profile;
- monitoring/package and research export.

For each path record:

- source entity used;
- whether 0, 1, or N subjects can be returned;
- media association semantics;
- AI/human provenance shown;
- location precision policy applied;
- cache/materialization owner;
- rollback path.

Current completeness: `unknown`; PR-A is not complete until this route matrix is filled from a clean checkout.

## 9. Identification and community inventory

### 9.1 Confirmed reusable pieces

- PostgreSQL identifications record actor kind and preserve multiple rows.
- D1 public identification writes have an additive table and source key.
- D1 stores `stance`, notes, source payload, and current marker.
- a dedicated identification workbench and per-user hold state exist.
- AI review targets are separate from public identification rows in the recent D1 path.

### 9.2 Confirmed gaps against target contract

- inspected schemas are keyed to occurrence, not first-class observation.
- explicit `candidate / accepted / rejected / withdrawn` lifecycle is absent from the inspected base tables.
- accepted identification uniqueness and deterministic transition are not proven.
- AI exclusion from community vote totals is not yet proven across every read model.
- public visibility → community participation policy is not yet documented as one shared evaluator.
- trust, moderation, rate, and organizational-vote handling require a separate evidence map.

Classification: mixed `confirmed conflict` and `unknown`.

## 10. Occurrence and research-use inventory

### 10.1 Current occurrence role

Current `occurrences` holds both source-subject and scientific/export-like fields:

- names and rank;
- individual count;
- occurrence status;
- confidence/evidence/quality;
- AI status;
- biome and evidence tags;
- source payload.

This confirms the responsibility collision described by `SPEC.md`.

### 10.2 Rights and governance already present

Confirmed from migrations `0099` and `0100`:

- `observation_data_rights` contains record, research, enterprise, license, export, and withdrawal fields.
- `observation_governance_contexts` contains public precision policy, review scope, role permissions, and site/local knowledge context.
- `observation_package_events` contains staged events from raw observation to export package and records human-review requirements.

These are strong inputs to an occurrence/research projection gate. They are not by themselves proof that all current exports enforce the same gate.

### 10.3 Target requirement

PR-G must introduce or prove a deterministic projection with:

- source observation ID;
- accepted identification ID or explicit coarse/unknown rule;
- human provenance;
- rights/consent decision;
- privacy rule version;
- quality rule version;
- projection version;
- active/inactive state;
- correction/revocation path.

No current table is yet accepted as fulfilling this complete contract.

## 11. Environment and monitoring inventory

### 11.1 Environment capability

Confirmed:

- AI reassessment can emit area inference.
- `environmentRecord.ts` maps place, contact surface, surrounding cover, environment condition, and human change.
- field values retain source labels such as `user`, `derived`, and `legacy`.
- existing monitoring and observation-package services consume visit/occurrence-shaped data.

Classification: `confirmed reuse`.

### 11.2 Boundary gap

The current codebase contains environment records, site signals, monitoring packages, package events, and enterprise monitoring surfaces, but a single explicit contract separating provisional environment assessment from canonical monitoring series is not yet proven.

Required audit:

- physical persistence of AI-derived environment fields;
- overwrite/merge rules between user, external, sensor, legacy, and AI sources;
- monitoring series identity and aggregation windows;
- suppression and missing-data semantics;
- approval/publishing state;
- whether a single AI result can overwrite a public or enterprise monitoring value;
- D1/PostgreSQL parity.

Classification: `unknown` until call graph and schema inventory are complete.

## 12. Privacy inventory

### 12.1 Confirmed reusable controls

`civicNatureContext.ts` confirms:

- audience scope;
- public precision levels;
- risk lanes;
- report consent;
- rare-sensitive forcing to `hidden`;
- non-normal risk preventing unsafe exact-public behavior.

Current migrations also include rights and public-precision governance.

### 12.2 Unproven global consistency

The target requires one protection decision across HTML, DOM attributes, JSON/API, JSON-LD, map payloads, feeds, media metadata, area profiles, monitoring, and export.

The existence of safe helpers and individual tests does not prove global consistency. A surface-by-surface matrix remains required.

Classification: controls `confirmed reuse`; universal enforcement `unknown`.

## 13. Data classification

| Data | Classification | Migration handling |
|---|---|---|
| precise coordinates / private geometry | restricted | never copy into public inventory/evidence; verify suppression separately |
| owner/user IDs | restricted operational identifiers | use only in runtime joins; do not place real values in docs |
| media originals | restricted by visibility/rights | retain existing object identity; link by internal IDs |
| public derivatives | public only after processing/privacy gate | do not treat derivative presence as research consent |
| AI candidates | provisional | preserve model/prompt/rule/input provenance; no automatic promotion |
| human identifications | contributor data | preserve actor/source/history; derive accepted state separately |
| occurrence projections | scientific derived data | versioned and reproducible; deactivate rather than erase history |
| research/export eligibility | policy decision | recompute from rights, privacy, quality, and provenance |
| environment assessment | provisional or observed, source-dependent | never overwrite monitoring without an explicit promotion rule |
| monitoring aggregates | governed derived data | retain source set, rule version, window, suppression, approval state |

## 14. Preliminary conflict and reuse matrix

| Area | Reuse | Conflict / missing boundary |
|---|---|---|
| durable save | current transaction/outbox patterns | record and observation identities differ by runtime |
| multi-subject AI | coexisting taxa, candidate readings, rescue, region data | direct occurrence materialization |
| idempotency | candidate key, source key, request uniqueness | target observation idempotency key not canonical |
| media | asset ledger, derivative states, metadata safety | no explicit observation-media M:N |
| identification | actor/source/history primitives | occurrence-keyed; accepted lifecycle incomplete |
| community | public write and workbench primitives | shared participation/vote/trust policy unproven |
| occurrence | existing scientific fields/export consumers | source entity and projection are conflated |
| rights | visit-level rights, export consent, withdrawal | per-observation and projection application unproven |
| environment | derived fields and source labels | assessment/monitoring promotion boundary incomplete |
| monitoring | package/events/readiness services | canonical series, suppression, approval and provenance need proof |
| privacy | risk and precision controls | all-surface consistency unproven |

## 15. Read-only metrics baseline

These templates define the baseline. Run only in an approved read-only environment against an exact source/database identity. Do not include row contents or precise locations in evidence.

### 15.1 PostgreSQL templates

```sql
-- Container and subject cardinality
select
  count(*) as visit_count,
  count(*) filter (where occurrence_count = 0) as visits_with_0_occurrences,
  count(*) filter (where occurrence_count = 1) as visits_with_1_occurrence,
  count(*) filter (where occurrence_count > 1) as visits_with_n_occurrences
from (
  select v.visit_id, count(o.occurrence_id) as occurrence_count
  from visits v
  left join occurrences o on o.visit_id = v.visit_id
  group by v.visit_id
) x;

-- AI-created occurrence-shaped rows
select
  count(*) as ai_judgement_occurrences,
  count(distinct visit_id) as affected_visits
from occurrences
where source_payload ->> 'source' = 'ai_judgement_observation_record'
   or data_quality = 'ai_only_unreviewed'
   or ai_assessment_status = 'ai_judgement';

-- Media attachment shape
select
  count(*) filter (where visit_id is not null and occurrence_id is null) as visit_only,
  count(*) filter (where visit_id is not null and occurrence_id is not null) as visit_and_occurrence,
  count(*) filter (where visit_id is null and occurrence_id is not null) as occurrence_only
from evidence_assets;

-- Identification sources
select actor_kind, is_current, count(*)
from identifications
group by actor_kind, is_current
order by actor_kind, is_current;

-- Rights coverage
select
  count(*) as visits,
  count(r.rights_id) as visits_with_rights,
  count(*) filter (where r.external_export_allowed) as export_allowed
from visits v
left join observation_data_rights r on r.visit_id = v.visit_id;
```

### 15.2 D1 templates

Confirm final table/column names against the migration inventory before execution.

```sql
-- Native record count and media cardinality
select
  count(*) as observation_rows,
  sum(case when asset_count = 0 then 1 else 0 end) as rows_with_0_assets,
  sum(case when asset_count = 1 then 1 else 0 end) as rows_with_1_asset,
  sum(case when asset_count > 1 then 1 else 0 end) as rows_with_n_assets
from (
  select o.observation_id, count(a.asset_id) as asset_count
  from observations o
  left join asset_ledger a on a.observation_id = o.observation_id
  group by o.observation_id
);

-- Compatibility occurrence use
select
  count(*) as ai_review_targets,
  sum(case when occurrence_id like 'occ:%:0' then 1 else 0 end) as synthetic_primary_targets
from observation_ai_review_targets;

select
  count(*) as identification_rows,
  sum(case when occurrence_id like 'occ:%:0' then 1 else 0 end) as synthetic_primary_identifications
from observation_identifications;

-- Reassessment state distribution
select request_kind, request_state, count(*)
from observation_reassessment_requests
group by request_kind, request_state
order by request_kind, request_state;
```

## 16. Material unknowns blocking PR-B finalization

P0/P1 unknowns:

1. complete PostgreSQL and D1 writer inventory;
2. exact D1 base migrations for `observations`, `asset_ledger`, AI review targets, and reassessment requests;
3. complete public/owner detail read-model call graph;
4. all paths that promote or export occurrence-shaped data;
5. accepted-identification and reviewer transition semantics;
6. all public location surfaces and their common/duplicated protection logic;
7. environment persistence and monitoring aggregation/promotion rules;
8. active PRs, migrations, or dirty worktrees that could conflict with schema work;
9. representative row-count and ambiguity metrics from an approved read-only environment.

PR-B schema implementation must not start until items 1–8 are reduced to confirmed evidence. Metrics item 9 may be collected in parallel but must be available before backfill design is accepted.

## 17. Proposed PR-B boundary

PR-B remains additive only.

Candidate logical additions, with final physical names decided after the remaining audit:

- first-class record-child observation entity;
- observation-media many-to-many link with region/time locator;
- explicit observation origin and lifecycle;
- identification provenance and lifecycle linked to observation;
- occurrence projection identity, source link, version, active state, and rejection reason;
- environment assessment identity, source type, version, and provisional state;
- audit/idempotency fields and consistency ledger;
- compatibility mapping from current visit/occurrence/D1 identifiers.

Explicit exclusions from PR-B:

- no deletion or rename of current tables/columns;
- no production apply in the schema-definition PR;
- no read/write cutover;
- no backfill;
- no AI provider behavior change;
- no public UI change;
- no research export change;
- no monitoring value promotion;
- no location-policy relaxation.

## 18. PR-A completion checklist

- [x] central execution Issue separated from canonical-control-plane Issue
- [x] PostgreSQL base entity collision documented
- [x] D1 synthetic occurrence compatibility documented
- [x] direct AI occurrence materialization conflict documented
- [x] reusable multi-subject and environment capability documented
- [x] rights/governance/monitoring package foundations documented
- [x] preliminary mapping, conflict/reuse matrix, and baseline query templates documented
- [ ] complete writer inventory from clean checkout
- [ ] complete read-path matrix from clean checkout
- [ ] complete D1 migration inventory
- [ ] complete privacy surface matrix
- [ ] complete environment/monitoring call graph
- [ ] record active PR/migration/worktree conflicts
- [ ] run documentation/link/secret/local-path checks
- [ ] independent review of PR-B boundary

Until the unchecked items are complete, PR-A remains active and PR-B remains design-only.
