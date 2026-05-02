import assert from "node:assert/strict";
import test from "node:test";
import { hasUsableObservationCoordinates, normalizeObservationLocality } from "./localityNormalization.js";

test("normalizes the old hard-coded Shizuoka prefecture and infers Hamamatsu from coordinates", () => {
  assert.deepEqual(
    normalizeObservationLocality({
      prefecture: "Shizuoka",
      municipality: "",
      latitude: 34.8142588,
      longitude: 137.7330983,
    }),
    { prefecture: "静岡県", municipality: "浜松市" },
  );
});

test("does not keep Shizuoka as a municipality when it is really a prefecture label", () => {
  assert.deepEqual(
    normalizeObservationLocality({
      prefecture: null,
      municipality: "Shizuoka",
    }),
    { prefecture: "静岡県", municipality: null },
  );
});

test("keeps explicit Japanese municipality labels", () => {
  assert.deepEqual(
    normalizeObservationLocality({
      prefecture: "静岡県",
      municipality: "浜松市",
      latitude: 34.7,
      longitude: 137.7,
    }),
    { prefecture: "静岡県", municipality: "浜松市" },
  );
});

test("does not treat zero-zero as usable observation coordinates", () => {
  assert.equal(hasUsableObservationCoordinates(0, 0), false);
  assert.equal(hasUsableObservationCoordinates(34.8142588, 137.7330983), true);
});
