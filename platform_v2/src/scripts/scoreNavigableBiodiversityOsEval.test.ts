import assert from "node:assert/strict";
import test from "node:test";
import { buildNavigableEvalCandidateFromReassessSamples } from "./generateNavigableBiodiversityOsEvalCandidate.js";
import { scoreNavigableBiodiversityOsEval } from "./scoreNavigableBiodiversityOsEval.js";

const spec = {
  pass_criteria: {
    first_branch_accuracy_min: 1,
    context_recall_min: 1,
    critical_unsupported_claim_count_max: 0,
    species_overclaim_count_max: 0,
    context_token_reduction_min_ratio: 0.3,
  },
  questions: [
    {
      id: "NBO-X",
      expected_branch: "feedback_contract",
      expected_sources: ["branches/feedback_contract/INDEX.md"],
      must_recall: ["missing evidence is actionable"],
    },
  ],
};

test("navigable scorer passes clean branch-controlled output", () => {
  const score = scoreNavigableBiodiversityOsEval(spec, {
    results: [
      {
        question_id: "NBO-X",
        branch_selected: "feedback_contract",
        sources_used: ["branches/feedback_contract/INDEX.md"],
        recalled: ["missing evidence is actionable"],
        context_tokens_baseline: 1000,
        context_tokens_variant: 600,
        unsupported_claims: [],
        species_overclaims: [],
      },
    ],
  });
  assert.equal(score.passed, true);
  assert.equal(score.firstBranchAccuracy, 1);
});

test("navigable scorer fails critical unsupported claims and species overclaims", () => {
  const score = scoreNavigableBiodiversityOsEval(spec, {
    results: [
      {
        question_id: "NBO-X",
        branch_selected: "feedback_contract",
        sources_used: ["branches/feedback_contract/INDEX.md"],
        recalled: ["missing evidence is actionable"],
        context_tokens_baseline: 1000,
        context_tokens_variant: 600,
        unsupported_claims: [{ severity: "critical", text: "unreviewed legal claim" }],
        species_overclaims: ["forced species from weak evidence"],
      },
    ],
  });
  assert.equal(score.passed, false);
  assert.match(score.failures.join("\n"), /critical_unsupported_claim_count/);
  assert.match(score.failures.join("\n"), /species_overclaim_count/);
});

test("navigable candidate generator flags reassess species overclaim", () => {
  const candidate = buildNavigableEvalCandidateFromReassessSamples(spec, {
    version: "test",
    samples: [
      {
        question_id: "NBO-X",
        navigable_os: {
          branch: "feedback_contract",
          sources_used: ["branches/feedback_contract/INDEX.md"],
          recalled: ["missing evidence is actionable"],
          context_tokens_baseline: 1000,
          context_tokens_variant: 500,
        },
        observation_package: {
          review_state: { public_claim_limit: "cautious_feedback_only" },
          occurrences: [{
            occurrence_id: "occ-1",
            taxon_rank: "species",
            safe_public_rank: "genus",
            evidence_tier: 1,
            risk_lane: "rare",
          }],
        },
        reassess_output: {
          recommended_rank: "species",
          recommended_taxon_name: "Rare species",
          narrative: "写真だけでは慎重に扱う。",
          claim_refs_used: [],
        },
      },
    ],
  });
  assert.equal(candidate.results[0]?.species_overclaims.length, 1);
});
