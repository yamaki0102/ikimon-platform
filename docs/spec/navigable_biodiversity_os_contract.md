# ikimon.life Navigable Biodiversity OS Contract

Updated: 2026-04-30

## Purpose

This contract makes observation evidence and knowledge claims separate, reusable assets. The runtime may still evolve, but every feedback, review, mypage, and report flow should converge on this path:

`NAVIGATOR -> branch INDEX -> ObservationPackage -> knowledge_claims -> focused retrieval -> feedback / review / report`

The first implementation is a contract and evaluation layer. It does not require a large `observationReassess` rewrite.

## ObservationPackage

`ObservationPackage` is the portable evidence bundle for one visit or one featured occurrence.

```ts
type ObservationPackage = {
  package_version: "observation_package/v1";
  package_id: string;
  generated_at: string;
  visit: ObservationVisit;
  occurrences: ObservationOccurrence[];
  evidence_assets: EvidenceAssetRef[];
  identifications: IdentificationRef[];
  ai_runs: AiRunRef[];
  feedback_payload: FeedbackPayloadRef | null;
  claim_refs: KnowledgeClaimRef[];
  review_state: ReviewState;
  report_outputs: ReportOutputRef[];
};
```

### `visit`

Maps to `visits`.

Required fields:

- `visit_id`
- `observed_at`
- `place_id`
- `location_precision`
- `observed_prefecture`
- `observed_municipality`
- `effort_minutes`
- `target_taxa_scope`
- `source_kind`

Use `null` for unknown optional values. Do not infer missing effort from media count.

### `occurrences`

Maps to `occurrences` plus companion tables such as `occurrence_three_lenses`.

Required fields:

- `occurrence_id`
- `visit_id`
- `scientific_name`
- `vernacular_name`
- `taxon_rank`
- `confidence_score`
- `evidence_tier`
- `quality_grade`
- `risk_lane`
- `safe_public_rank`
- `source_payload`

Rule: `safe_public_rank` is the finest rank supported by evidence and review state. It may be coarser than the AI recommendation.

### `evidence_assets`

Maps to `evidence_assets`, `asset_blobs`, and media-role companion rows.

Required fields:

- `asset_id`
- `blob_id`
- `occurrence_id`
- `visit_id`
- `media_type`
- `mime_type`
- `asset_role`
- `media_role`
- `captured_at`
- `sha256`
- `public_url`

Rule: feedback may request additional evidence, but must not pretend missing evidence exists.

### `identifications`

Maps to `identifications`, `specialist_authorities`, authority recommendations, and disputes.

Required fields:

- `identification_id`
- `occurrence_id`
- `actor_kind`
- `actor_user_id`
- `proposed_name`
- `proposed_rank`
- `confidence_score`
- `is_current`
- `rationale`
- `similar_taxa_ruled_out`
- `review_scope`

Rule: `AI suggestion`, `community support`, and `expert verified` remain separate states.

### `ai_runs`

Maps to `observation_ai_runs`, `observation_ai_assessments`, subject candidates, and media regions.

Required fields:

- `ai_run_id`
- `visit_id`
- `trigger_occurrence_id`
- `model_provider`
- `model_name`
- `prompt_version`
- `pipeline_version`
- `taxonomy_version`
- `knowledge_version_set`
- `input_asset_fingerprint`
- `run_status`

Rule: AI runs are audit records. They are not formal identification records by themselves.

### `feedback_payload`

The normalized output contract used by feedback surfaces.

Required fields:

- `simple_summary`
- `safe_identification`
- `why_this_rank`
- `diagnostic_features_seen`
- `missing_evidence`
- `next_shots`
- `claim_refs_used`
- `review_route`
- `public_claim_limit`

Rule: feedback must improve the next observation, not only answer the current one.

### `claim_refs`

Maps to `knowledge_claims`.

Required fields:

- `claim_id`
- `claim_type`
- `claim_text`
- `taxon_name`
- `scientific_name`
- `taxon_group`
- `place_region`
- `season_bucket`
- `habitat`
- `evidence_type`
- `risk_lane`
- `target_outputs`
- `citation_span`
- `confidence`
- `human_review_status`
- `use_in_feedback`
- `scope_match`

Hot-path query rule:

```sql
WHERE human_review_status = 'ready'
  AND use_in_feedback = TRUE
```

Scope rule: claims may not cross taxon group, risk lane, region, season, or evidence type unless the claim is explicitly authored as general.

### `review_state`

Summarizes the current evidence gate.

Required fields:

- `current_evidence_tier`
- `tier_label`
- `review_status`
- `review_priority`
- `required_reviewer_scope`
- `blocking_issues`
- `public_claim_limit`

Rule: public claim strength is the weaker of Evidence Tier and claim boundary policy.

### `report_outputs`

Links observation evidence to downstream outputs without duplicating biological claims.

Required fields:

- `output_kind`: `observation_feedback` | `mypage_weekly` | `site_report` | `event_report` | `enterprise_report`
- `output_id`
- `generated_at`
- `claim_refs_used`
- `knowledge_version_set`
- `audience`
- `public_private_surface`

Rule: reports reuse observation packages and claim refs; they do not invent report-only biological facts.

## Focused Retrieval Contract

1. Select the controlling branch from `NAVIGATOR.md`.
2. Read the branch `INDEX.md`.
3. Build or inspect `ObservationPackage`.
4. Retrieve allowed `knowledge_claims` only after the observation scope is known.
5. Apply branch acceptance checks.

## Acceptance Gates

- `first_branch_accuracy >= 8/10`
- `context_recall >= 8/10`
- `unsupported_claim_count = 0 critical`
- `species_overclaim_count = 0`
- variant context tokens are at least 30 percent below baseline

## Current Implementation Notes

- `platform_v2` is the primary target for new feedback, retrieval, and evaluation work.
- legacy PHP remains a compatibility and report-reference source.
- `dev_tools/observation_feedback_*` is not present in this repo as of 2026-04-30; recreate the capability through this contract instead of depending on missing files.
- `platform_v2/package.json` still exposes `import:feedback-knowledge`; its implementation should import reviewed feedback claims into `knowledge_claims`, not bypass the review gate.
