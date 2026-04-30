import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

type EvalQuestion = {
  id: string;
  question: string;
  expected_branch: string;
  expected_sources: string[];
  must_recall: string[];
  critical_failure_if: string[];
};

type EvalSpec = {
  version: string;
  pass_criteria: {
    first_branch_accuracy_min: number;
    context_recall_min: number;
    critical_unsupported_claim_count_max: number;
    species_overclaim_count_max: number;
    context_token_reduction_min_ratio: number;
  };
  questions: EvalQuestion[];
};

const EXPECTED_BRANCHES = new Set([
  "observation_quality",
  "identification_granularity",
  "evidence_tier_review",
  "knowledge_claims",
  "feedback_contract",
  "mypage_learning",
  "enterprise_reporting",
  "privacy_claim_boundary",
  "freshness_sources",
  "evaluation",
]);

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const evalPath = path.join(repoRoot, "docs/spec/navigable_biodiversity_os/eval_questions.json");

async function loadEvalSpec(): Promise<EvalSpec> {
  return JSON.parse(await readFile(evalPath, "utf8")) as EvalSpec;
}

test("navigable biodiversity OS eval set has exactly one question per branch", async () => {
  const spec = await loadEvalSpec();
  assert.equal(spec.version, "navigable_biodiversity_os_eval/v1");
  assert.equal(spec.questions.length, EXPECTED_BRANCHES.size);

  const branches = new Set(spec.questions.map((q) => q.expected_branch));
  assert.deepEqual(branches, EXPECTED_BRANCHES);
});

test("navigable biodiversity OS eval questions carry acceptance evidence", async () => {
  const spec = await loadEvalSpec();
  assert.equal(spec.pass_criteria.first_branch_accuracy_min, 8);
  assert.equal(spec.pass_criteria.context_recall_min, 8);
  assert.equal(spec.pass_criteria.critical_unsupported_claim_count_max, 0);
  assert.equal(spec.pass_criteria.species_overclaim_count_max, 0);
  assert.ok(spec.pass_criteria.context_token_reduction_min_ratio >= 0.3);

  for (const question of spec.questions) {
    assert.match(question.id, /^NBO-\d{2}$/);
    assert.ok(question.question.length > 10, `${question.id} has an empty question`);
    assert.ok(EXPECTED_BRANCHES.has(question.expected_branch), `${question.id} has an unknown branch`);
    assert.ok(question.expected_sources.length >= 2, `${question.id} needs focused sources`);
    assert.ok(question.must_recall.length >= 3, `${question.id} needs recall targets`);
    assert.ok(question.critical_failure_if.length >= 1, `${question.id} needs a critical failure rule`);
  }
});
