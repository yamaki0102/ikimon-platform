import assert from "node:assert/strict";
import test from "node:test";
import { percentile, summarizeSamples, BENCHMARK_CASES } from "./routeBenchmark.mjs";

test("route benchmark reports stable p50/p95 and response bytes from seeded route samples", () => {
  assert.equal(percentile([40, 10, 30, 20], 0.5), 20);
  assert.equal(percentile([40, 10, 30, 20], 0.95), 40);
  assert.deepEqual(summarizeSamples([
    { serverRenderMs: 7, materializationMs: 10, payloadBytes: 1000, wireBytes: 29, sqlCalls: 4 },
    { serverRenderMs: 14, materializationMs: 20, payloadBytes: 2000, wireBytes: 35, sqlCalls: 5 },
    { serverRenderMs: 21, materializationMs: 30, payloadBytes: 3000, wireBytes: 38, sqlCalls: 5 },
    { serverRenderMs: 28, materializationMs: 40, payloadBytes: 4000, wireBytes: 39, sqlCalls: 6 },
  ]), {
    samples: 4,
    p50ServerRenderMs: 14,
    p95ServerRenderMs: 28,
    p50MaterializationMs: 20,
    p95MaterializationMs: 40,
    p50PayloadBytes: 2000,
    p95PayloadBytes: 4000,
    p50PayloadKiB: 1.95,
    p95PayloadKiB: 3.91,
    p50WireBytes: 35,
    p95WireBytes: 39,
    p50WireKiB: 0.03,
    p95WireKiB: 0.04,
    sqlCallsPerRequestP50: 5,
    sqlCallsPerRequestP95: 6,
  });
});

test("benchmark covers successful public home, map, observation, and species renders", () => {
  assert.deepEqual(BENCHMARK_CASES.map((item) => item.name), [
    "home", "map", "observation-detail", "species-detail",
  ]);
  assert.ok(BENCHMARK_CASES.every((item) => item.expectedStatus === 200));
  assert.ok(BENCHMARK_CASES.every((item) => item.expectedContent));
});
