# PR-A EVIDENCE MATRIX — Current record / observation implementation

## 1. Status

- initiative: `record-detail-observation-migration`
- phase: `PR-A — Contract and inventory`
- central execution: `yamaki0102/all-projects-management#435`
- implementation issue: `yamaki0102/ikimon-platform#1376`
- source ref used for this matrix: `main@56db3d1ca73ab9851d357e1db51f19843b64c879`
- evidence date: `2026-07-20 JST`
- runtime change: none
- DB / D1 mutation: none

This file complements [`CURRENT_INVENTORY.md`](CURRENT_INVENTORY.md). It records the current source evidence that could be verified through GitHub and separates it from checks that require a clean local checkout or approved read-only database access.

## 2. Evidence boundary

### Verified through GitHub

- current PostgreSQL migrations and service code
- current Cloudflare D1 migration files that were identified from merged PR history
- current Node write, AI, identification-consensus, safety, monitoring, and export services
- current owner processing read model
- current and stale/open PR branch relationships against `main`
- merged PR evidence for D1-native writes and public safety behavior

### Not executed in this phase

- production or staging database queries
- D1 remote queries
- local recursive source search
- local typecheck, tests, build, Markdown/link validator, secret scanner, or path scanner
- browser QA
- deploy, migration apply, or production mutation

No result in this document should be read as production row-count evidence.

## 3. Current write-path matrix

| Path | Current container | Current subject / claim storage | Media behavior | Promotion / side effects | Classification |
|---|---|---|---|---|---|
| Node `upsertObservation()` | PostgreSQL `visits` | `subjects[]` are written as `occurrences` with `subject_index` | all uploaded photos attach to the primary occurrence | rights, field scan, governance, package event, place memory, environment and tier promotion follow the primary occurrence | confirmed conflict and reuse |
| Node note-only write | PostgreSQL `visits` | creates an empty primary occurrence even without an identifiable subject | optional | keeps map/legacy compatibility | confirmed conflict with `record 1 → 0..N observations` |
| Node subject update | existing visit | deletes occurrences whose `subject_index` is beyond the new input length, then upserts remaining rows | primary photo attachment remains | may remove old occurrence-shaped subject rows | confirmed history-preservation risk |
| Node AI reassessment | existing visit | AI secondary candidates can be materialized directly into `occurrences` | candidate region/provenance exists in AI payloads | AI-only occurrence gets `ai_only_unreviewed` / `ai_judgement` | confirmed promotion-boundary conflict |
| Node human taxon write | primary occurrence | inserts or updates one `identifications` row with `actor_kind='human'` and `is_current=true` | existing evidence assets | no explicit accepted-identification transition in this write | confirmed partial reuse and lifecycle gap |
| Cloudflare native record save | D1 `observations` row | compatibility subject represented by `occ:<observation_id>:0` | `asset_ledger` and processing outbox | native response remains visit/occurrence compatible | confirmed compatibility path |
| Cloudflare photo upload | existing D1 observation | no new target child observation | R2 asset + D1 media/readmodel outbox + reassessment request are committed as one bounded operation; R2 compensation on D1 failure | AI request remains pending until consumer completion | confirmed reuse |
| Cloudflare AI consumer | existing D1 observation | AI candidate saved to `observation_ai_review_targets` by occurrence ID | reads ready image derivatives | candidate is shown for human review, not as confirmed name | confirmed partial reuse |
| Cloudflare public identification | D1 compatibility occurrence ID | `observation_identifications` keyed by `occurrence_id` | no direct media relation | stance/current state, source key and payload retained | confirmed partial reuse and observation-key gap |
| Cloudflare specialist review | D1 compatibility occurrence ID | `observation_specialist_reviews` | indirect | approve/reject/note with specialist or authority-backed class | confirmed reuse, still occurrence-keyed |
| Passive audio ingest | ingest event with optional visit/occurrence | species candidate and confidence stored in ingest event | audio segment link | may mark Tier 1.5 candidate | confirmed separate machine-observation lane requiring mapping |
| FieldScan audio | audio segment and detections | detection rows are not first-class target observations | private audio with voice/privacy status | provider/confidence stored | confirmed separate evidence/detection lane requiring mapping |

## 4. Confirmed Node write behavior

### 4.1 Record and subject identity

`platform_v2/src/services/observationWrite.ts` currently treats:

```text
visit_id       = posting / record-like container
occurrence_id  = subject-like row and scientific record
subject_index  = ordering inside one visit
```

The input supports multiple `subjects`, but the implementation comment states that each subject is saved as a Darwin Core-compatible occurrence. A manual field note also receives a primary occurrence even when no taxon exists.

Target implication:

- preserve `visit_id` as the initial record compatibility key;
- do not treat current `occurrences` as the new observation table;
- introduce a first-class child observation identity before changing existing readers;
- retain an explicit compatibility mapping from record observation to current occurrence IDs.

### 4.2 Destructive subject-tail cleanup

The current write deletes rows with:

```sql
delete from occurrences
where visit_id = $1
  and subject_index >= $2
```

This is correct for the old mutable subject-array contract, but it is incompatible with the target requirement to retain source history, split/merge provenance, corrections, and past projections.

PR-C or a preceding compatibility change must replace destructive tail cleanup with lifecycle transitions such as `excluded`, `superseded`, or link deactivation after the new model is available.

### 4.3 Media relation

Every photo in the inspected Node path is written with the primary `occurrence_id`. Media role metadata exists, but there is no first-class link from one media asset to multiple observation subjects.

Target implication:

- retain current media asset IDs and processing metadata;
- add a many-to-many link;
- initialize existing primary photo links through compatibility mapping;
- do not duplicate media blobs during backfill.

### 4.4 Identification write

The direct user taxon input creates one human identification row with `is_current=true`. The write does not create a separate accepted-state transition or a deterministic single-active accepted claim.

Target implication:

- import this row as a human identification claim;
- determine accepted state through an explicit transition and provenance rule;
- do not infer that every current row is research-accepted solely because `is_current=true`.

### 4.5 Side effects and transaction boundary

Within the PostgreSQL transaction, the current write can create or update:

- place
- visit
- occurrences
- environment `field_context`
- evidence assets
- identification
- idempotency ledger
- data rights
- water record extension
- place memory
- field-scan context
- governance context
- observation package events

After commit it can also run:

- civic context write
- Site Brief/environment inference
- Tier 1 → 1.5 auto-promotion
- place-memory photo processing
- public map refresh
- legacy compatibility write

This confirms that PR-C dual-write must reuse current transactional/outbox behavior rather than adding an unrelated asynchronous path.

## 5. AI and promotion matrix

| Capability | Current state | Target treatment |
|---|---|---|
| main-organism candidate | available in Cloudflare AI | AI identification candidate on a provisional observation |
| multiple candidate readings | available in Node/Gemini path | separate identification alternatives or child observations according to subject identity |
| `coexisting_taxa` | available | provisional child observations |
| visual subject rescue | available | preserve; write rescued subjects as provisional observations |
| media regions | available | observation-media locator data |
| candidate-key dedupe | available | reuse as idempotency source key |
| direct AI occurrence materialization | active in Node path | stop only after provisional observation dual-write and rollback path exist |
| AI vote exclusion | confirmed in Node consensus logic | retain and add equivalent D1/readmodel tests |
| Tier 1 → 1.5 AI promotion | active based on confidence and regional prior, optionally media-role coverage | separate evidence scoring from active occurrence projection |
| Tier 3 promotion | uses human-only consensus inputs, media, disputes, taxonomy and authority/reference evidence | reuse as one input to accepted identification / projection gate, not as the sole entity state |

## 6. Community identification findings

### Confirmed positive behavior

`identificationConsensus.ts` excludes the following from community support calculations:

- actor kinds: `ai`, `automation`, `machine`, `model`, `system`
- source payloads: AI assessment/judgement/candidate sources

It then deduplicates the latest identification per actor and requires at least two independent supporters with at least two-thirds support for a community taxon.

This satisfies the target principle that AI is not a community vote in the inspected Node consensus path.

### Remaining gaps

- consensus remains keyed to current occurrence ID;
- current rows use `is_current`, not the target claim lifecycle;
- accepted identification is not one explicit versioned entity;
- equivalent AI-exclusion behavior is not yet proven for every D1/public read model;
- public visibility → community participation is spread across routes/read models rather than one proven shared policy evaluator;
- organization membership, moderation, trust weighting, rate limits, withdrawal, and reviewer override need a separate policy evidence map.

### Recruitment-dependent copy/code search

A clean-checkout exact-phrase search on 2026-07-20 found no runtime implementation of a 「みんなに聞く」button or recruitment state. It did find the banned `人の確認待ち` copy in current runtime code:

- `platform_v2/cloudflare_shadow/src/index.ts`: AI target status label, chip, evidence fallback and review-state heading
- `platform_v2/src/routes/read.ts`: identification-strength summary and human-support label

The other exact phrases `名前の提案を募集中`, `みんなの確認はまだありません`, and `確認0件` were not found in current runtime code. Contract documents mention the phrases only to forbid them. PR-F must remove/localize the confirmed runtime occurrences and add a repository search gate for JP / EN / ES / PT-BR equivalents. Queue membership and proposal authorization must not depend on any replacement recruitment flag.

## 7. Cloudflare D1 migration inventory

The following migrations were confirmed from current files or merged PR file lists.

| Migration | Responsibility | Observation-first implication |
|---|---|---|
| `0022_observation_identifications.sql` | occurrence-keyed identification claims, source key, stance/current marker | migrate to observation-keyed claim identity while preserving source key |
| `0035_observation_record_ai_reviews.sql` | AI review target and per-user review state keyed by occurrence | separate provisional observation, AI candidate and human decision |
| `0040_specialist_review_runtime.sql` | specialist/authority decisions keyed by occurrence | reusable reviewer provenance; link to observation/identification transition |
| `0041_passive_audio_ingest_runtime.sql` | machine audio event, candidate, provenance and optional visit/occurrence | map machine detections into provisional observations without automatic occurrence activation |
| `0042_fieldscan_audio_runtime.sql` | private audio segments and detection rows | media/time locator and privacy-aware provisional observations |
| `0043_civic_observation_contexts.sql` | visit/occurrence civic context, precision, risk and consent | reusable record-level governance with optional observation override |
| `0045_place_environment_snapshots.sql` | versioned external/place metrics and source snapshots | reusable monitoring/environment source, separate from per-record AI assessment |
| `0049_observation_detail_edit_runtime.sql` | detail-edit audit events and occurrence-keyed environment records | reuse edit audit; move environment assessment away from occurrence-only identity |
| `0051_observation_write_idempotency.sql` | client submission identity and visit/occurrence results | reuse for record save; add observation dual-write ledger |
| `0054_identification_workbench_holds.sql` | per-user workbench hold | presentation/workflow state only; not identification lifecycle |
| current `0066_cloudflare_native_observation_ai_backfill.sql` | queues existing image records without confirmed taxon/AI target | keep bounded/idempotent behavior; future target writes provisional observations |

### Important D1 collision

D1 already uses the physical name `observations` for the native saved-record unit. The target product contract also uses the word `observation` for a child subject entity.

Recommendation:

- do not rename the current D1 `observations` table during expand;
- treat it as the record compatibility source;
- use an unambiguous new child table name such as `record_observations` in both PostgreSQL and D1;
- document the terminology explicitly until cutover and contract cleanup are complete.

## 8. Current read-model matrix

| Surface / service | Current source | Current subject handling | Privacy / provenance | Target gap |
|---|---|---|---|---|
| D1 owner processing status | one D1 observation plus asset, reassessment, AI target and identification counts | synthetic primary occurrence only | owner ID required; internal status hidden from guest/non-owner | no 0..N observation list |
| owner map | D1 observations, optional public-ready derivative | one record marker | owner route may return exact coordinates | must remain owner-only; child observations should not multiply record marker by default |
| public map / stream | materialized/public read models | record/primary occurrence oriented | public precision gate excludes unsafe precision | multi-observation representation and common policy proof incomplete |
| record/visit detail | visit plus selected occurrence compatibility | visit URL with optional subject/occurrence selection | mixed owner/public rendering | target record container plus observation cards not implemented |
| observation package | visit, all occurrences, assets, identifications, AI runs, rights and governance | array exists, but first occurrence is treated as target in several downstream contracts | rich provenance available | current occurrences still serve as both source observations and projections |
| monitoring record contract | first occurrence in observation package | one target occurrence | tracks AI/human verification and rights | must aggregate from confirmed observations and explicit occurrence projections |
| research export | occurrence-shaped record | one export row per current occurrence | rights, generalization and verification blockers exist | projection version/source observation not explicit |
| identification workbench | occurrence/record read model | dedicated queue | per-user hold exists | workflow state must not become acceptance state |

## 9. Monitoring and environment findings

### Existing strengths

- environment values distinguish at least `user`, `derived`, and `legacy` sources;
- AI reassessment can emit area/environment inference;
- `field_context` stores structured environment data and Site Brief signals;
- D1 has versioned `place_environment_snapshots` with source snapshot hashes and validity windows;
- monitoring package events model stages from raw observation to export package;
- monitoring record contract separates `ai_suggested`, community-reviewed, expert-verified, sensitive-hidden and rejected states;
- research export blocks AI-only/unverified/sensitive/rejected records and requires rights, licensing and location generalization;
- detection/no-detection semantics require effort, scope and checklist evidence.

### Confirmed boundary problems

- per-record environment state is tied to the primary occurrence in inspected write paths;
- Node environment inference can run after commit and silently fail;
- D1 `observation_environment_records` stores exact lat/lng beside occurrence-keyed structured data;
- monitoring contracts frequently select the first occurrence as the target;
- evidence tier is still stored on current occurrences and can be auto-promoted;
- no explicit versioned environment-assessment lifecycle was found for AI/user/external/sensor comparisons;
- no single canonical monitoring-series identity and promotion ledger was proven.

### Target separation

```text
record/media/place input
→ environment assessment version
→ source-specific review / suppression
→ governed monitoring aggregation
→ approved monitoring series value
```

A single AI-derived assessment must never update a monitoring value directly.

## 10. Privacy surface matrix

| Surface | Confirmed control | Remaining proof required |
|---|---|---|
| record/public summary | `record_safety_profile/v0` considers place access, precision, media privacy, sensitive subject, home repetition, consent and withdrawal | prove all record detail implementations call the same gate |
| public stream/public map | site precision is blocked; municipality/mesh are allowed public levels | verify every materializer and cache refresh uses the same decision |
| rare/sensitive | civic context forces `hidden` for rare-sensitive | verify imported/legacy and AI-created subjects cannot bypass the context |
| owner map/detail | owner-scoped routes can use exact coordinates | confirm no shared cache or public JSON carries owner payload |
| media | only public-ready derivatives should appear publicly; face/privacy state exists | verify EXIF/XMP, downloadable originals and every image URL |
| API/JSON | several public read models strip or generalize location | complete endpoint inventory and negative assertions |
| DOM/HTML attributes | individual tests exist for selected pages | global scan still required |
| JSON-LD/metadata | target specification requires protection | complete source and rendered-output scan required |
| field/area profile | dedicated public readmodels strip coordinate-like keys | verify fallback and stale materialized paths |
| monitoring/export | rights and location-generalization blockers exist | prove every exporter uses the same projection/gate version |

Conclusion: privacy primitives are strong, but global common-policy enforcement is not yet proven. PR-E shadow-read and privacy comparison must treat unexplained precision differences as P0.

## 11. Active and stale PR lane audit

The following open branches overlap record/observation work and are not safe bases for PR-B.

| PR | Branch | Comparison against current main | Disposition for this initiative |
|---|---|---|---|
| `#1302` | `codex/issue-1296-post-flow-stacked-20260713` | diverged, ahead 7 / behind 39; includes deploy/control-plane and old reassessment work | do not stack; reassessment behavior must be read from merged #1371/#1373 and reimplemented only if missing |
| `#1280` | `agent/cloudflare-record-recovery-origin-fallback-20260712` | diverged, ahead 19 / behind 57 | recovery UX is separate; do not use as schema base |
| `#1228` | `codex/fix-photo-post-submit-loss-20260704` | diverged, ahead 11 / behind 99 | historical deployed evidence only; do not merge into current migration |
| `#1095` | `codex/record-detail-preview-worker-standard-20260629` | diverged, ahead 5 / behind 230 | preview concept may be useful, but workflow must be rebuilt from current deploy rules rather than merged as-is |

No open branch above should be rebased or closed automatically in PR-A. They should be handled by a separate branch-hygiene decision after confirming whether any unique evidence remains.

## 12. P0/P1 migration risks

### P0

1. treating current `occurrences` as the new observation table;
2. allowing AI-only candidate materialization to imply an active scientific occurrence;
3. deleting historical subject rows during split/merge correction;
4. leaking exact coordinates through any newly joined record/observation/media response;
5. backfilling ambiguous subject boundaries as confirmed;
6. changing the D1 `observations` meaning in place;
7. exporting public/current occurrence rows without explicit projection version and gate evidence.

### P1

1. media is attached only to the primary occurrence in major Node write path;
2. `is_current` is used where explicit identification lifecycle is required;
3. first occurrence is selected as the target in monitoring/read contracts;
4. AI confidence can promote evidence tier on an already materialized occurrence;
5. D1 and PostgreSQL identity/cardinality differ;
6. environment assessment is occurrence-keyed and not consistently versioned;
7. community policy parity between Node and D1 is not fully proven;
8. stale PR branches overlap current code and deploy infrastructure.

## 13. PR-A completion assessment

### Completed through GitHub evidence

- [x] current PostgreSQL entity and write collision
- [x] current D1 compatibility identity
- [x] AI candidate and direct occurrence-materialization conflict
- [x] Node community AI-vote exclusion
- [x] identification/specialist-review D1 schema evidence
- [x] passive audio and FieldScan audio mapping evidence
- [x] environment and monitoring boundary evidence
- [x] rights/export/privacy gate evidence
- [x] active overlapping PR branch comparison
- [x] proposed migration constraints and P0/P1 classification

### Requires another execution environment or approval

- [ ] clean-checkout recursive writer/reader inventory
- [ ] complete D1 migration directory manifest and checksum
- [ ] local documentation/link/secret/path validators
- [ ] current worktree/branch/migration-lane inspection on the implementation PC
- [ ] approved read-only PostgreSQL/D1 metrics baseline
- [ ] rendered HTML/API/JSON-LD/media metadata privacy scan
- [ ] independent schema/security review of PR-B

## 14. Gate decision

Status: `PR_A_GITHUB_EVIDENCE_COMPLETE_WITH_EXTERNAL_GATES`

PR-A has enough source evidence to design PR-B, but not enough to apply or merge schema migrations safely.

Allowed next action:

- complete PR-B additive schema design;
- prepare validation commands and expected invariants;
- keep runtime, migrations and deploy unchanged.

Blocked next action:

- applying PostgreSQL or D1 migrations;
- dual-write implementation;
- backfill;
- read cutover;
- production deploy.
