import {
  CARD_ID_MODEL,
  applyDecisionCheck,
  applySecondCheck,
  callCardDecision,
  callCardGemini,
  decisionQuestion
} from "./observationCardMode";

export type BenchmarkSample = {
  id: string;
  image: { assetId: string; mimeType: string; base64Data: string };
  candidateName: string;
  candidateScientificName: string;
  groundTruthIsMatch: boolean;
  license: string;
};

export type BenchmarkRates = {
  total: number;
  falseDowngradeRate: number;
  falseAgreeRate: number;
  skippedRate: number;
  avgMsPerImage: number;
};

export function evaluateDecisionWithThresholds(
  p: number | null,
  agreeThreshold: number,
  coarserThreshold: number
): "agree" | "coarser" | "conflict" | "skipped" {
  if (p === null || !Number.isFinite(p)) return "skipped";
  if (p >= agreeThreshold) return "agree";
  if (p >= coarserThreshold) return "coarser";
  return "conflict";
}

export function computeBenchmarkRates(
  outcomes: Array<{ groundTruthIsMatch: boolean; result: "agree" | "coarser" | "conflict" | "skipped"; durationMs: number }>
): BenchmarkRates {
  const total = outcomes.length;
  if (total === 0) {
    return { total: 0, falseDowngradeRate: 0, falseAgreeRate: 0, skippedRate: 0, avgMsPerImage: 0 };
  }
  const trueMatches = outcomes.filter((o) => o.groundTruthIsMatch).length;
  const trueMismatches = outcomes.filter((o) => !o.groundTruthIsMatch).length;
  const falseDowngrades = outcomes.filter((o) => o.groundTruthIsMatch && (o.result === "coarser" || o.result === "conflict")).length;
  const falseAgrees = outcomes.filter((o) => !o.groundTruthIsMatch && o.result === "agree").length;
  const skipped = outcomes.filter((o) => o.result === "skipped").length;
  const totalMs = outcomes.reduce((sum, o) => sum + o.durationMs, 0);

  return {
    total,
    falseDowngradeRate: trueMatches > 0 ? falseDowngrades / trueMatches : 0,
    falseAgreeRate: trueMismatches > 0 ? falseAgrees / trueMismatches : 0,
    skippedRate: skipped / total,
    avgMsPerImage: totalMs / total
  };
}

export async function runSpeciesRecheckComparison(
  apiKey: string,
  samples: BenchmarkSample[],
  thresholds: Array<{ agree: number; coarser: number }> = [
    { agree: 0.8, coarser: 0.5 },
    { agree: 0.75, coarser: 0.45 },
    { agree: 0.85, coarser: 0.6 }
  ]
) {
  const oldOutcomes: Array<{ groundTruthIsMatch: boolean; result: "agree" | "coarser" | "conflict" | "skipped"; durationMs: number }> = [];
  const decisionProbs: Array<{ groundTruthIsMatch: boolean; p: number | null; durationMs: number }> = [];

  for (const sample of samples) {
    const lead = { name: sample.candidateName, scientific_name: sample.candidateScientificName, rank: "species", confidence_band: "high" };

    const t0 = performance.now();
    let oldRes: "agree" | "coarser" | "conflict" | "skipped" = "skipped";
    try {
      const raw = await callCardGemini(
        apiKey,
        CARD_ID_MODEL,
        [
          { inline_data: { mime_type: sample.image.mimeType, data: sample.image.base64Data } },
          { text: `Identify species. Candidate: ${sample.candidateName} (${sample.candidateScientificName}). Return JSON {"name":"...","scientific_name":"...","rank":"species"}.` }
        ],
        { temperature: 0.1, thinkingLevel: "minimal" }
      );
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      oldRes = applySecondCheck({ ...lead }, parsed) as "agree" | "coarser" | "conflict" | "skipped";
    } catch {
      oldRes = "skipped";
    }
    oldOutcomes.push({ groundTruthIsMatch: sample.groundTruthIsMatch, result: oldRes, durationMs: performance.now() - t0 });

    const t1 = performance.now();
    let p: number | null = null;
    try {
      p = await callCardDecision(apiKey, [sample.image], decisionQuestion(lead));
    } catch {
      p = null;
    }
    decisionProbs.push({ groundTruthIsMatch: sample.groundTruthIsMatch, p, durationMs: performance.now() - t1 });
  }

  return {
    oldRates: computeBenchmarkRates(oldOutcomes),
    newByThreshold: thresholds.map((th) => ({
      agreeThreshold: th.agree,
      coarserThreshold: th.coarser,
      rates: computeBenchmarkRates(
        decisionProbs.map((d) => ({
          groundTruthIsMatch: d.groundTruthIsMatch,
          result: evaluateDecisionWithThresholds(d.p, th.agree, th.coarser),
          durationMs: d.durationMs
        }))
      )
    })),
    defaultCheckMatches: applyDecisionCheck({ confidence_band: "high" }, 0.8) === "agree"
  };
}
