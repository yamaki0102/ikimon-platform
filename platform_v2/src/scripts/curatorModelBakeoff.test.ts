import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateScores,
  BAKEOFF_FIXTURES,
  scoreFixtureOutput,
  selectBakeoffWinner,
  type FixtureScore,
} from "./curatorModelBakeoff.js";

test("curator bakeoff fixtures cover 4 domains x 10 cases", () => {
  assert.equal(BAKEOFF_FIXTURES.length, 40);
  const counts = BAKEOFF_FIXTURES.reduce<Record<string, number>>((acc, fixture) => {
    acc[fixture.kind] = (acc[fixture.kind] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(counts, {
    "invasive-law": 10,
    redlist: 10,
    "paper-research": 10,
    "satellite-update": 10,
  });
});

test("fixture scorer fails missing required fields, enum violations, long excerpts, and duplicates", () => {
  const fixture = BAKEOFF_FIXTURES.find((item) => item.kind === "invasive-law");
  assert.ok(fixture);
  const score = scoreFixtureOutput({
    fixture,
    provider: "gemini",
    model: "gemini-3.1-flash-lite-preview",
    output: {
      rows: [
        {
          scientific_name: fixture.expectedFields["rows.0.scientific_name"],
          mhlw_category: "bad-enum",
          source_excerpt: "x".repeat(601),
        },
        {
          scientific_name: fixture.expectedFields["rows.0.scientific_name"],
          mhlw_category: "bad-enum",
          source_excerpt: "duplicate",
        },
      ],
    },
  });
  assert.equal(score.schemaValid, false);
  assert.ok(score.criticalFailures.some((failure) => failure.startsWith("enum_violation")));
  assert.ok(score.criticalFailures.some((failure) => failure.startsWith("source_excerpt_too_long")));
  assert.ok(score.criticalFailures.some((failure) => failure.startsWith("duplicate_row")));
});

function aggregate(provider: "gemini" | "deepseek", fieldAccuracyPct: number, criticalFailureCount = 0) {
  const scores: FixtureScore[] = Array.from({ length: 10 }, (_, index) => ({
    fixtureId: `${provider}-${index}`,
    provider,
    model: provider === "gemini" ? "gemini-3.1-flash-lite-preview" : "deepseek-v4-flash",
    schemaValid: criticalFailureCount === 0,
    fieldAccuracyPct,
    criticalFailures: index < criticalFailureCount ? ["critical"] : [],
    costUsd: 0.001,
  }));
  return aggregateScores(provider, scores[0]?.model ?? provider, scores);
}

test("winner policy keeps Gemini when quality delta is within threshold", () => {
  const winner = selectBakeoffWinner(aggregate("gemini", 96), aggregate("deepseek", 98));
  assert.equal(winner.winner, "gemini");
  assert.equal(winner.reason, "no_material_quality_difference_use_default_gemini");
});

test("winner policy selects DeepSeek only on explicit quality threshold", () => {
  const winner = selectBakeoffWinner(aggregate("gemini", 90), aggregate("deepseek", 96));
  assert.equal(winner.winner, "deepseek");
  assert.equal(winner.reason, "deepseek_field_accuracy_gt_5pt");
});

test("winner policy selects DeepSeek when Gemini has a critical failure and DeepSeek has zero", () => {
  const winner = selectBakeoffWinner(aggregate("gemini", 99, 1), aggregate("deepseek", 94, 0));
  assert.equal(winner.winner, "deepseek");
  assert.equal(winner.reason, "gemini_critical_failure_deepseek_zero");
});
