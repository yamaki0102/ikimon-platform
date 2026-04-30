import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CandidateFile, CandidateResult, EvalSpec } from "./scoreNavigableBiodiversityOsEval.js";

type ReassessEvalSample = {
  question_id: string;
  navigable_os: {
    branch: string;
    sources_used: string[];
    recalled: string[];
    context_tokens_baseline: number;
    context_tokens_variant: number;
  };
  observation_package: {
    review_state?: { public_claim_limit?: string | null };
    occurrences: Array<{
      occurrence_id: string;
      taxon_rank: string | null;
      safe_public_rank: string;
      evidence_tier: number | null;
      risk_lane: string;
    }>;
  };
  reassess_output: {
    confidence_band?: string;
    recommended_rank?: string | null;
    recommended_taxon_name?: string | null;
    narrative?: string;
    simple_summary?: string;
    next_step_text?: string;
    fun_fact?: string;
    claim_refs_used?: string[];
  };
};

type ReassessSampleFile = {
  version: string;
  samples: ReassessEvalSample[];
};

function isStrongClaim(text: string): boolean {
  return /自然回復|回復を証明|自然再生|企業価値|健康効果|法的|駆除|捕獲|運搬|nature[- ]positive|recovery|restoration|legal|removal|capture/i.test(text);
}

function unsupportedClaims(sample: ReassessEvalSample): CandidateResult["unsupported_claims"] {
  const refs = sample.reassess_output.claim_refs_used ?? [];
  if (refs.length > 0) return [];
  const fields = [
    sample.reassess_output.narrative,
    sample.reassess_output.simple_summary,
    sample.reassess_output.next_step_text,
    sample.reassess_output.fun_fact,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return fields
    .filter(isStrongClaim)
    .map((text) => ({ severity: "critical", text }));
}

function speciesOverclaims(sample: ReassessEvalSample): string[] {
  const outputRank = (sample.reassess_output.recommended_rank ?? "").toLowerCase();
  if (outputRank !== "species") return [];
  const target = sample.observation_package.occurrences[0] ?? null;
  if (!target) return ["species output without occurrence evidence"];
  const publicClaimLimit = sample.observation_package.review_state?.public_claim_limit ?? "";
  if (target.safe_public_rank !== "species") {
    return [`species output exceeds safe_public_rank=${target.safe_public_rank}`];
  }
  if (publicClaimLimit && publicClaimLimit !== "observation_supported") {
    return [`species output exceeds public_claim_limit=${publicClaimLimit}`];
  }
  return [];
}

export function buildNavigableEvalCandidateFromReassessSamples(
  spec: EvalSpec,
  sampleFile: ReassessSampleFile,
): CandidateFile {
  const sampleByQuestion = new Map(sampleFile.samples.map((sample) => [sample.question_id, sample]));
  return {
    results: spec.questions.map((question) => {
      const sample = sampleByQuestion.get(question.id);
      if (!sample) {
        return {
          question_id: question.id,
          branch_selected: "",
          sources_used: [],
          recalled: [],
          context_tokens_baseline: 0,
          context_tokens_variant: 0,
          unsupported_claims: [{ severity: "critical", text: "missing reassess eval sample" }],
          species_overclaims: [],
        };
      }
      return {
        question_id: question.id,
        branch_selected: sample.navigable_os.branch,
        sources_used: sample.navigable_os.sources_used,
        recalled: sample.navigable_os.recalled,
        context_tokens_baseline: sample.navigable_os.context_tokens_baseline,
        context_tokens_variant: sample.navigable_os.context_tokens_variant,
        unsupported_claims: unsupportedClaims(sample),
        species_overclaims: speciesOverclaims(sample),
      };
    }),
  };
}

function parseArgs(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    if (key) out[key] = rest.length > 0 ? rest.join("=") : true;
  }
  return out;
}

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const args = parseArgs();
  const specPath = typeof args.spec === "string"
    ? path.resolve(args.spec)
    : path.join(repoRoot, "docs/spec/navigable_biodiversity_os/eval_questions.json");
  const samplePath = typeof args.sample === "string"
    ? path.resolve(args.sample)
    : path.join(repoRoot, "docs/spec/navigable_biodiversity_os/reassess_eval_samples.json");
  const outputPath = typeof args.output === "string" ? path.resolve(args.output) : "";
  const spec = JSON.parse(await readFile(specPath, "utf8")) as EvalSpec;
  const samples = JSON.parse(await readFile(samplePath, "utf8")) as ReassessSampleFile;
  const candidate = buildNavigableEvalCandidateFromReassessSamples(spec, samples);
  const json = JSON.stringify(candidate, null, 2);
  if (outputPath) {
    await writeFile(outputPath, `${json}\n`, "utf8");
  } else {
    console.log(json);
  }
}

if (process.argv[1] && ["generateNavigableBiodiversityOsEvalCandidate.ts", "generateNavigableBiodiversityOsEvalCandidate.js"].includes(path.basename(process.argv[1]))) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
