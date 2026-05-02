import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildNavigableEvalCandidateFromReassessSamples } from "./generateNavigableBiodiversityOsEvalCandidate.js";

export type EvalQuestion = {
  id: string;
  expected_branch: string;
  expected_sources: string[];
  must_recall: string[];
};

export type EvalSpec = {
  pass_criteria: {
    first_branch_accuracy_min: number;
    context_recall_min: number;
    critical_unsupported_claim_count_max: number;
    species_overclaim_count_max: number;
    context_token_reduction_min_ratio: number;
  };
  questions: EvalQuestion[];
};

export type CandidateResult = {
  question_id: string;
  branch_selected: string;
  sources_used: string[];
  recalled: string[];
  context_tokens_baseline: number;
  context_tokens_variant: number;
  unsupported_claims: Array<{ severity?: string; text?: string } | string>;
  species_overclaims: string[];
};

export type CandidateFile = {
  results: CandidateResult[];
};

export type NavigableEvalScore = {
  passed: boolean;
  firstBranchAccuracy: number;
  contextRecall: number;
  criticalUnsupportedClaimCount: number;
  speciesOverclaimCount: number;
  contextTokenReductionRatio: number;
  failures: string[];
};

function parseArgs(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    if (!key) continue;
    out[key] = rest.length > 0 ? rest.join("=") : true;
  }
  return out;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesRecall(recalled: string[], expected: string): boolean {
  const expectedNorm = normalize(expected);
  return recalled.some((value) => {
    const actual = normalize(value);
    return actual === expectedNorm || actual.includes(expectedNorm) || expectedNorm.includes(actual);
  });
}

function criticalUnsupportedCount(result: CandidateResult): number {
  return result.unsupported_claims.filter((claim) => {
    if (typeof claim === "string") return true;
    return (claim.severity ?? "critical") === "critical";
  }).length;
}

export function scoreNavigableBiodiversityOsEval(spec: EvalSpec, candidate: CandidateFile): NavigableEvalScore {
  const byQuestion = new Map(candidate.results.map((result) => [result.question_id, result]));
  const failures: string[] = [];
  let firstBranchAccuracy = 0;
  let contextRecall = 0;
  let criticalUnsupportedClaimCount = 0;
  let speciesOverclaimCount = 0;
  let baselineTokens = 0;
  let variantTokens = 0;

  for (const question of spec.questions) {
    const result = byQuestion.get(question.id);
    if (!result) {
      failures.push(`${question.id}: missing candidate result`);
      continue;
    }
    if (result.branch_selected === question.expected_branch) {
      firstBranchAccuracy += 1;
    } else {
      failures.push(`${question.id}: branch ${result.branch_selected} != ${question.expected_branch}`);
    }

    const missingRecall = question.must_recall.filter((item) => !includesRecall(result.recalled, item));
    if (missingRecall.length === 0) {
      contextRecall += 1;
    } else {
      failures.push(`${question.id}: missing recall ${missingRecall.join("; ")}`);
    }

    const missingSources = question.expected_sources.filter((source) => !result.sources_used.includes(source));
    if (missingSources.length > 0) {
      failures.push(`${question.id}: missing sources ${missingSources.join("; ")}`);
    }

    criticalUnsupportedClaimCount += criticalUnsupportedCount(result);
    speciesOverclaimCount += result.species_overclaims.length;
    baselineTokens += Math.max(0, Math.trunc(result.context_tokens_baseline));
    variantTokens += Math.max(0, Math.trunc(result.context_tokens_variant));
  }

  const reduction = baselineTokens > 0 ? (baselineTokens - variantTokens) / baselineTokens : 0;
  const criteria = spec.pass_criteria;
  if (firstBranchAccuracy < criteria.first_branch_accuracy_min) {
    failures.push(`first_branch_accuracy ${firstBranchAccuracy} < ${criteria.first_branch_accuracy_min}`);
  }
  if (contextRecall < criteria.context_recall_min) {
    failures.push(`context_recall ${contextRecall} < ${criteria.context_recall_min}`);
  }
  if (criticalUnsupportedClaimCount > criteria.critical_unsupported_claim_count_max) {
    failures.push(`critical_unsupported_claim_count ${criticalUnsupportedClaimCount} > ${criteria.critical_unsupported_claim_count_max}`);
  }
  if (speciesOverclaimCount > criteria.species_overclaim_count_max) {
    failures.push(`species_overclaim_count ${speciesOverclaimCount} > ${criteria.species_overclaim_count_max}`);
  }
  if (reduction < criteria.context_token_reduction_min_ratio) {
    failures.push(`context_token_reduction_ratio ${reduction.toFixed(3)} < ${criteria.context_token_reduction_min_ratio}`);
  }

  return {
    passed: failures.length === 0,
    firstBranchAccuracy,
    contextRecall,
    criticalUnsupportedClaimCount,
    speciesOverclaimCount,
    contextTokenReductionRatio: reduction,
    failures,
  };
}

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const args = parseArgs();
  const specPath = typeof args.spec === "string"
    ? path.resolve(args.spec)
    : path.join(repoRoot, "docs/spec/navigable_biodiversity_os/eval_questions.json");
  const candidatePath = typeof args.candidate === "string"
    ? path.resolve(args.candidate)
    : "";
  const samplePath = typeof args.sample === "string"
    ? path.resolve(args.sample)
    : path.join(repoRoot, "docs/spec/navigable_biodiversity_os/reassess_eval_samples.json");

  const spec = JSON.parse(await readFile(specPath, "utf8")) as EvalSpec;
  const candidate = candidatePath
    ? JSON.parse(await readFile(candidatePath, "utf8")) as CandidateFile
    : buildNavigableEvalCandidateFromReassessSamples(
        spec,
        JSON.parse(await readFile(samplePath, "utf8")) as { version: string; samples: unknown[] } as Parameters<typeof buildNavigableEvalCandidateFromReassessSamples>[1],
      );
  const score = scoreNavigableBiodiversityOsEval(spec, candidate);
  console.log(JSON.stringify({ specPath, candidatePath: candidatePath || null, samplePath: candidatePath ? null : samplePath, ...score }, null, 2));
  if (!score.passed) process.exit(1);
}

if (process.argv[1] && ["scoreNavigableBiodiversityOsEval.ts", "scoreNavigableBiodiversityOsEval.js"].includes(path.basename(process.argv[1]))) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
