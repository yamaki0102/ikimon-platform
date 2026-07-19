# PR-B DESIGN — Additive observation-first schema

## 1. Status

- initiative: `record-detail-observation-migration`
- intended phase: `PR-B — Expand schema`
- current status: design only; no migration file or runtime change
- prerequisite evidence: [`CURRENT_INVENTORY.md`](CURRENT_INVENTORY.md) and [`PR_A_EVIDENCE_MATRIX.md`](PR_A_EVIDENCE_MATRIX.md)
- central execution: `yamaki0102/all-projects-management#435`

This design defines the additive schema boundary that can be implemented after the remaining clean-checkout and independent-review gates pass.

## 2. Design decisions

### 2.1 Keep current record sources during expand

During expand and dual-write:

- PostgreSQL `visits` remains the record/container source.
- Cloudflare D1 `observations` remains the native record/container source.
- no current table is renamed or deleted;
- no reader is cut over;
- a shared logical `record_id` refers to the current container ID in each runtime;
- compatibility source mapping records the source runtime and source identifier.

Reason: D1 already uses `observations` for the saved-record unit while the target contract uses observation for a child subject. Changing the meaning in place would create an unsafe migration collision.

### 2.2 Use `record_observations` for the new child entity

Recommended physical name in both PostgreSQL and D1:

```text
record_observations
```

This is unambiguous during migration and can remain a stable implementation name even after the product language simply says “observation”.

### 2.3 Occurrence becomes a projection

Current `occurrences` remains untouched during expand. The new model creates versioned projection rows separately. Existing occurrence IDs can be referenced as compatibility sources, but they are not used as new observation IDs.

### 2.4 Claims, decisions and projections are separate

- an identification claim is not automatically accepted;
- an accepted identification is not automatically an active occurrence;
- an active occurrence is not automatically research/export eligible;
- monitoring promotion is a separate governed transition.

### 2.5 Preserve source history

Split, merge, exclude, reassignment and correction produce lifecycle/audit events. They do not delete source observations, claims, media links or projection history.

## 3. Logical schema

```text
current record source
  └── record_observations
        ├── record_observation_media
        ├── observation_identification_claims
        ├── observation_lifecycle_events
        └── occurrence_projection_versions

record / observation / media / place
  └── environment_assessments

source writes / migration runs
  ├── record_observation_source_map
  └── record_observation_consistency_ledger
```

## 4. `record_observations`

Purpose: represent one distinguishable subject or subject-like observation within a saved record.

Recommended columns:

| Column | Contract |
|---|---|
| `observation_id` | stable primary key, independent from occurrence projection ID |
| `record_id` | current container ID: PostgreSQL visit ID or D1 native observation ID |
| `record_runtime` | `postgresql | cloudflare_d1 | import` |
| `origin` | `user | ai | import | system` |
| `lifecycle` | `provisional | confirmed | excluded | superseded` |
| `subject_type` | `organism | group | trace | sound | unknown_subject` |
| `individual_certainty` | `individual | group | unknown` |
| `captive_context` | `wild | captive | cultivated | pet | unknown` |
| `count_mode` | `exact | estimate | range | unknown` |
| `count_value` | nullable non-negative integer |
| `count_min` / `count_max` | nullable range values |
| `display_order` | stable ordering inside a record; not identity |
| `source_key` | idempotent source-specific key |
| `provenance_json` | actor, AI run, import, rule and source references |
| `reviewed_by_actor_kind` / `reviewed_by_actor_id` | nullable human/reviewer provenance |
| `reviewed_at` | nullable |
| `excluded_reason` | nullable reason code |
| `superseded_by_observation_id` | nullable self reference |
| `created_at` / `updated_at` | timestamps |
| `row_version` | optimistic version / audit support |

Required constraints:

- one stable primary key;
- unique `(record_runtime, record_id, source_key)`;
- AI origin cannot be inserted as `confirmed` without a separate human transition;
- `count_min <= count_max` when both exist;
- excluded/superseded rows remain queryable;
- record may have zero rows.

Recommended source keys:

- user-created: `user:<client-submission-id>:<local-subject-id>`
- AI-created: `ai:<ai-run-id>:<candidate-key>`
- PostgreSQL backfill: `pg-occurrence:<occurrence-id>`
- D1 compatibility backfill: `d1-occurrence:<compat-occurrence-id>`
- machine detection: `machine:<provider>:<event-or-detection-id>`

## 5. `record_observation_source_map`

Purpose: retain deterministic mappings between current entities and new observation IDs.

Recommended columns:

| Column | Contract |
|---|---|
| `source_runtime` | `postgresql | cloudflare_d1 | legacy_import | machine` |
| `source_entity_kind` | `visit | native_observation | occurrence | ai_review_target | identification | audio_detection | other` |
| `source_entity_id` | source identifier |
| `observation_id` | target observation |
| `mapping_kind` | `primary | subject | candidate | compatibility_placeholder | merged | split_source` |
| `mapping_rule_version` | immutable rule version |
| `mapping_confidence` | optional bounded value |
| `ambiguity_state` | `clear | needs_review | quarantined` |
| `source_snapshot_hash` | optional source-row/input digest |
| `created_at` | timestamp |

Primary or unique key:

```text
(source_runtime, source_entity_kind, source_entity_id, mapping_rule_version)
```

This table is the rollback and backfill evidence anchor. It must not be inferred later only from ID naming.

## 6. `record_observation_media`

Purpose: many-to-many observation-to-media relationship with subject locator.

Recommended columns:

| Column | Contract |
|---|---|
| `link_id` | primary key |
| `observation_id` | child observation |
| `media_source_runtime` | current asset store/runtime |
| `media_id` | existing asset ID; do not duplicate blob |
| `role` | `primary_evidence | supporting_evidence | context | audio_evidence | trace_evidence | excluded` |
| `locator_kind` | `full | rect | polygon | frame_time | time_range | other` |
| `locator_json` | normalized rectangle/polygon/frame/range and source coordinate system |
| `origin` | `user | ai | import | system` |
| `active` | current association flag |
| `source_key` | idempotent key |
| `provenance_json` | actor/model/rule/source |
| `created_at` / `updated_at` | timestamps |

Required behavior:

- one media asset can link to multiple observations;
- one observation can link to multiple media assets;
- link history is retained through `active=false` or lifecycle events;
- public media access is still decided by the current media/privacy pipeline;
- the link table never grants public access to an original asset.

## 7. `observation_identification_claims`

Purpose: preserve every taxonomic or context claim separately from acceptance.

Recommended columns:

| Column | Contract |
|---|---|
| `identification_id` | primary key |
| `observation_id` | target observation |
| `actor_kind` | `submitter | community_member | reviewer | ai | import | system` |
| `actor_id` | nullable for system/import |
| `claim_status` | `candidate | accepted | rejected | withdrawn | superseded` |
| `proposed_name` / `proposed_rank` | claim |
| `accepted_name` / `accepted_rank` | normalized accepted form when applicable |
| `confidence_score` | optional, not a vote weight by default |
| `stance` | `support | alternative | not_organism | needs_more_evidence | context_only` |
| `source_key` | idempotent source key |
| `source_payload_json` | source-specific details |
| `evidence_json` | references and rationale |
| `decision_reason` | reason code |
| `decided_by_actor_kind` / `decided_by_actor_id` | acceptance provenance |
| `decided_at` | nullable |
| `created_at` / `updated_at` | timestamps |

Required constraints:

- at most one active `accepted` claim per observation;
- AI actor cannot directly set `accepted`;
- a system transition to accepted must reference qualifying human/community/reviewer evidence;
- AI confidence is never counted as a community supporter;
- withdrawal and supersession preserve the original row;
- accepted state changes are audit events.

Migration note:

- current `is_current=true` is not sufficient to backfill `accepted` automatically;
- current human rows become claims with legacy-current provenance;
- acceptance is produced by an explicit backfill rule only when source evidence proves a human decision contract; otherwise it remains candidate/review-needed.

## 8. `observation_lifecycle_events`

Purpose: immutable history for split, merge, confirm, exclude, restore and media reassignment.

Recommended columns:

| Column | Contract |
|---|---|
| `event_id` | primary key |
| `observation_id` | main target |
| `event_kind` | `created | confirmed | excluded | restored | split | merged | media_linked | media_unlinked | identification_changed | projection_changed` |
| `actor_kind` / `actor_id` | provenance |
| `reason_code` | stable code |
| `before_json` / `after_json` | bounded state deltas |
| `related_observation_ids_json` | split/merge relations |
| `source_key` | idempotency |
| `created_at` | immutable timestamp |

Do not store secrets, exact public-inappropriate location or full private media metadata in audit payloads.

## 9. `occurrence_projection_versions`

Purpose: reproducible scientific occurrence projection derived from a confirmed observation and accepted identification.

Recommended columns:

| Column | Contract |
|---|---|
| `projection_id` | primary key |
| `observation_id` | source observation |
| `projection_version` | monotonically increasing per observation |
| `projection_state` | `candidate | active | inactive | rejected | revoked` |
| `accepted_identification_id` | source accepted claim |
| `basis_of_record` | Darwin Core-compatible basis |
| `occurrence_status` | scientific status |
| `individual_count` | nullable |
| `rights_decision_json` | consent/license/withdrawal inputs and versions |
| `privacy_decision_json` | precision/suppression rule and version |
| `quality_decision_json` | evidence/review/taxonomy gate and version |
| `projection_rule_version` | immutable generator version |
| `source_digest` | digest of source observation/claim/gate inputs |
| `research_use_state` | `not_evaluated | blocked | eligible | revoked` |
| `research_blockers_json` | reason codes |
| `generated_at` | timestamp |
| `activated_at` / `deactivated_at` | nullable |
| `supersedes_projection_id` | nullable self reference |

Required constraints:

- only a confirmed observation can have an active projection;
- active projection requires one accepted identification or an explicit coarse/unknown scientific rule;
- active projection requires non-AI human provenance;
- one active projection per observation;
- projection is re-generated deterministically when source or rule version changes;
- public display and research eligibility remain separate;
- revocation/deactivation does not delete history.

Current `occurrences` compatibility:

- do not update current occurrence IDs to become projection version IDs;
- store optional `legacy_occurrence_id` in source mapping or projection metadata;
- old readers remain authoritative until shadow-read differences are accepted.

## 10. `environment_assessments`

Purpose: versioned environment values without overwriting monitoring state.

Recommended columns:

| Column | Contract |
|---|---|
| `assessment_id` | primary key |
| `record_id` | nullable record source |
| `observation_id` | nullable child observation |
| `media_source_runtime` / `media_id` | optional evidence source |
| `place_id` | optional place source |
| `source_kind` | `ai | human | external | sensor | import | derived_rule` |
| `assessment_state` | `provisional | confirmed | rejected | superseded` |
| `assessment_kind` | habitat/vegetation/moisture/human influence/weather/etc. |
| `value_json` | normalized values |
| `confidence_score` | optional |
| `model_provider` / `model_name` / `model_version` | nullable |
| `prompt_version` / `rule_version` | nullable |
| `input_provenance_json` | source references and hashes |
| `reviewed_by_actor_kind` / `reviewed_by_actor_id` | nullable |
| `reviewed_at` | nullable |
| `created_at` / `updated_at` | timestamps |

Required behavior:

- exact coordinates stay in private source records, not copied into public assessment output by default;
- AI assessments start as provisional;
- user, sensor, external and AI values can coexist;
- newer assessment does not delete older source values;
- monitoring aggregation reads only source kinds/states allowed by its rule version.

`place_environment_snapshots` remains a valid external/place source and does not need to be copied into each record assessment.

## 11. `record_observation_consistency_ledger`

Purpose: prove dual-write parity and support retries/rollback.

Recommended columns:

| Column | Contract |
|---|---|
| `ledger_id` | primary key |
| `operation_key` | unique idempotency key |
| `record_runtime` / `record_id` | current record source |
| `legacy_write_refs_json` | current visit/occurrence/identification/media refs |
| `target_write_refs_json` | new observation/link/claim refs |
| `operation_kind` | `record_save | ai_analysis | human_edit | identification | media_reassign | backfill | projection` |
| `source_digest` | deterministic input digest |
| `target_digest` | deterministic target digest |
| `consistency_state` | `pending | matched | mismatched | retryable | quarantined` |
| `reason_codes_json` | differences or failure reasons |
| `attempt_count` | bounded retry tracking |
| `created_at` / `updated_at` | timestamps |

Do not put raw private payloads in this ledger. Store IDs, digests, counts and reason codes.

## 12. PostgreSQL expand migration boundary

The future PostgreSQL PR-B migration may add only:

- `record_observations`
- `record_observation_source_map`
- `record_observation_media`
- `observation_identification_claims`
- `observation_lifecycle_events`
- `occurrence_projection_versions`
- `environment_assessments`
- `record_observation_consistency_ledger`
- supporting indexes, checks and partial unique constraints

It must not:

- rename or delete `visits`, `occurrences`, `evidence_assets`, `identifications`, `field_context` or rights/governance tables;
- add triggers that change current write behavior;
- backfill data;
- change public readers;
- apply to production in the schema-definition PR.

## 13. D1 expand migration boundary

The future D1 PR-B migration uses the same logical table names where SQLite constraints allow them. It must:

- coexist with current D1 `observations`;
- use `record_id` to reference the current native row by ID without changing its meaning;
- store JSON as text with application-level canonical serialization where required;
- emulate partial-unique accepted/projection constraints through transaction checks and supporting unique keys if SQLite limitations require it;
- retain source keys and consistency ledger for idempotency;
- not modify current `asset_ledger`, AI-review, identification, specialist-review, environment or readmodel rows in expand.

## 14. Backfill classification rules prepared by the schema

These are design rules only; backfill is PR-D.

| Current source | Target observation lifecycle | Notes |
|---|---|---|
| explicit user subject with human source evidence | confirmed candidate, subject to exact rule evidence | retain submitter provenance |
| AI judgement occurrence / AI review target | provisional | never active projection from AI alone |
| coexisting AI candidate | provisional | retain media region and candidate key |
| empty primary occurrence created only for note/map compatibility | no observation or excluded compatibility placeholder | do not turn an empty note into a confirmed organism |
| imported occurrence with clear human provenance | confirmed or needs-review according to import rule | rule version and source digest required |
| ambiguous subject/taxon collision | provisional or quarantined | no guessed confirmation |
| passive audio/FieldScan detection | provisional machine-origin observation | reviewer/human confirmation required for occurrence activation |
| current human identification row | identification claim | `is_current` does not automatically mean target `accepted` |

## 15. Verification invariants for PR-B implementation

### Static

- migration IDs unique and ordered;
- SQL parses on fresh PostgreSQL and fresh D1 test databases;
- existing migrations remain unchanged;
- new tables are empty after expand;
- no current reader/writer references new tables yet;
- no secrets or local absolute paths;
- no migration applies automatically to production.

### Schema

- record supports zero observations;
- source key is idempotent;
- media links are many-to-many;
- AI cannot create confirmed observation through DB/application contract;
- at most one accepted identification per observation;
- at most one active occurrence projection per observation;
- excluded/superseded history remains queryable;
- projection and assessment versions are immutable or superseded rather than overwritten;
- all foreign-key and delete actions preserve source/audit history.

### Compatibility

- current app typecheck/tests/build remain green without feature flags enabled;
- current PostgreSQL and D1 write paths remain unchanged;
- current public record, map, feed, identification, monitoring and export responses are byte/semantic compatible;
- rollback is code/config disable plus unused additive tables, not reverse/destructive SQL.

## 16. Feature flags for later phases

PR-B itself does not enable them, but reserve configuration names for later phases:

- `RECORD_OBSERVATION_DUAL_WRITE`
- `RECORD_OBSERVATION_SHADOW_READ`
- `RECORD_OBSERVATION_READ_CUTOVER`
- `RECORD_OBSERVATION_OCCURRENCE_PROJECTION`
- `RECORD_OBSERVATION_ENVIRONMENT_ASSESSMENTS`

Defaults must remain off until the relevant phase gate passes. Production changes require the established approval path.

## 17. Open decisions requiring independent review

1. final identifier format for cross-store observations;
2. whether submitter-entered taxon can be accepted immediately or requires a separate explicit confirmation transition;
3. exact status model for merge/split source rows;
4. SQLite enforcement method for one accepted identification and one active projection;
5. representation of unknown/coarse scientific projections;
6. per-observation rights override versus record-level rights inheritance;
7. media locator coordinate normalization and privacy constraints;
8. machine observation mapping for passive audio, camera traps and FieldScan;
9. whether environment assessment confirmation may be performed by the submitter or requires governed reviewer scope;
10. retention window and storage size limits for audit/consistency JSON.

## 18. Gate decision

Status: `PR_B_DESIGN_READY_FOR_CLEAN_CHECKOUT_AND_INDEPENDENT_REVIEW`

This document authorizes preparation of additive migration code only after:

- complete clean-checkout source inventory;
- active migration-lane conflict check;
- schema/security review;
- explicit decision on the open items above.

It does not authorize migration apply, dual-write, backfill, cutover or deploy.
