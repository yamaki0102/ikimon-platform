import assert from "node:assert/strict";
import test from "node:test";
import { computeBenchmarkRates, evaluateDecisionWithThresholds } from "./speciesRecheckBenchmark";

test("speciesRecheckBenchmark computes false downgrade, false agree, skipped rates and sweeps thresholds", () => {
  const outcomes = [
    { groundTruthIsMatch: true, result: evaluateDecisionWithThresholds(0.9, 0.8, 0.5), durationMs: 100 },
    { groundTruthIsMatch: true, result: evaluateDecisionWithThresholds(0.6, 0.8, 0.5), durationMs: 100 },
    { groundTruthIsMatch: false, result: evaluateDecisionWithThresholds(0.85, 0.8, 0.5), durationMs: 100 },
    { groundTruthIsMatch: false, result: null === null ? evaluateDecisionWithThresholds(null, 0.8, 0.5) : "agree", durationMs: 100 }
  ];
  const rates = computeBenchmarkRates(outcomes);
  assert.equal(rates.total, 4);
  assert.equal(rates.falseDowngradeRate, 0.5);
  assert.equal(rates.falseAgreeRate, 0.5);
  assert.equal(rates.skippedRate, 0.25);
  assert.equal(rates.avgMsPerImage, 100);
});
