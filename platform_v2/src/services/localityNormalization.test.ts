import assert from "node:assert/strict";
import test from "node:test";
import { hasUsableObservationCoordinates, normalizeObservationCountry, normalizeObservationLocality } from "./localityNormalization.js";

test("normalizes the old hard-coded Shizuoka prefecture without guessing municipality from a bbox", () => {
  assert.deepEqual(
    normalizeObservationLocality({
      prefecture: "Shizuoka",
      municipality: "",
      latitude: 34.8142588,
      longitude: 137.7330983,
    }),
    { prefecture: "静岡県", municipality: null },
  );
});

test("does not infer Shizuoka City from a broad coordinate bbox", () => {
  assert.deepEqual(
    normalizeObservationLocality({
      prefecture: null,
      municipality: null,
      latitude: 35.12,
      longitude: 138.61,
    }),
    { prefecture: "静岡県", municipality: null },
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

test("infers Okinawa prefecture from coordinates when client locality is missing", () => {
  assert.deepEqual(
    normalizeObservationLocality({
      prefecture: null,
      municipality: null,
      latitude: 26.2124,
      longitude: 127.6809,
    }),
    { prefecture: "沖縄県", municipality: null },
  );
});

test("infers other Japanese prefectures from coordinates when client locality is missing", () => {
  assert.deepEqual(
    normalizeObservationLocality({
      latitude: 35.6812,
      longitude: 139.7671,
    }),
    { prefecture: "東京都", municipality: null },
  );
});

test("normalizes common Okinawa English locality labels", () => {
  assert.deepEqual(
    normalizeObservationLocality({
      prefecture: "Okinawa",
      municipality: "Naha",
    }),
    { prefecture: "沖縄県", municipality: "那覇市" },
  );
});

test("infers overseas country code from coordinates when client country is missing", () => {
  assert.equal(normalizeObservationCountry(null, 48.8566, 2.3522), "FR");
  assert.equal(normalizeObservationCountry(null, -17.7, -149.4), "ZZ");
  assert.equal(normalizeObservationCountry("United States", null, null), "US");
});

test("keeps explicit ward-level Japanese municipality labels", () => {
  assert.deepEqual(
    normalizeObservationLocality({
      prefecture: "静岡県",
      municipality: "浜松市浜名区",
      latitude: 34.8,
      longitude: 137.7,
    }),
    { prefecture: "静岡県", municipality: "浜松市浜名区" },
  );
});

test("does not treat zero-zero as usable observation coordinates", () => {
  assert.equal(hasUsableObservationCoordinates(0, 0), false);
  assert.equal(hasUsableObservationCoordinates(34.8142588, 137.7330983), true);
});
