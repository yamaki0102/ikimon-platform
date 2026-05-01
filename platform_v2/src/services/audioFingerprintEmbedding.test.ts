import assert from "node:assert/strict";
import test from "node:test";
import { audioFingerprintToEmbedding, __test__ } from "./audioFingerprintEmbedding.js";

test("audio fingerprint embedding is 1280-dimensional, finite, and normalized", () => {
  const vector = audioFingerprintToEmbedding({
    peakHz: 220,
    centroidHz: 3200,
    rolloffHz: 9000,
    energy: 0.00005,
    voiceBandRatio: 0.3,
    bandEnergies: [0.4, 0.2, 0.1, 0.1, 0.1, 0.1],
  });
  assert.equal(vector.length, __test__.EMBEDDING_DIMENSION);
  assert.ok(vector.every(Number.isFinite));
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  assert.ok(Math.abs(norm - 1) < 0.00005);
});

test("audio fingerprint embedding changes with spectral shape", () => {
  const low = audioFingerprintToEmbedding({ peakHz: 180, centroidHz: 1200, rolloffHz: 3000, bandEnergies: [0.8, 0.1, 0.05, 0.03, 0.01, 0.01] });
  const high = audioFingerprintToEmbedding({ peakHz: 4000, centroidHz: 6000, rolloffHz: 10000, bandEnergies: [0.05, 0.05, 0.1, 0.2, 0.3, 0.3] });
  assert.notDeepEqual(low.slice(0, 16), high.slice(0, 16));
});
