import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicLocationSummary,
  maxZoomForGrid,
  pickPublicGridMeters,
  resolvePublicLocalityLabel,
  summarizePublicLocalitySet,
} from "./publicLocation.js";

test("resolvePublicLocalityLabel prefers municipality, then prefecture, then blurred copy", () => {
  assert.deepEqual(
    resolvePublicLocalityLabel({
      municipality: "浜松市",
      prefecture: "静岡県",
    }),
    { label: "浜松市", scope: "municipality" },
  );

  assert.deepEqual(
    resolvePublicLocalityLabel({
      municipality: "",
      prefecture: "静岡県",
    }),
    { label: "静岡県", scope: "prefecture" },
  );

  assert.deepEqual(
    resolvePublicLocalityLabel({
      municipality: null,
      prefecture: null,
      placeName: "浜松城公園 共生エリア",
      siteName: "浜松城公園",
    } as Parameters<typeof resolvePublicLocalityLabel>[0] & { placeName: string; siteName: string }),
    { label: "位置をぼかしています", scope: "blurred" },
  );
});

test("summarizePublicLocalitySet falls back from mixed municipalities to prefecture, then blurred", () => {
  assert.deepEqual(
    summarizePublicLocalitySet([
      { municipality: "浜松市", prefecture: "静岡県" },
      { municipality: "浜松市", prefecture: "静岡県" },
    ]),
    { label: "浜松市", scope: "municipality" },
  );

  assert.deepEqual(
    summarizePublicLocalitySet([
      { municipality: "浜松市", prefecture: "静岡県" },
      { municipality: "静岡市", prefecture: "静岡県" },
    ]),
    { label: "静岡県", scope: "prefecture" },
  );

  assert.deepEqual(
    summarizePublicLocalitySet([
      { municipality: "浜松市", prefecture: "静岡県" },
      { municipality: "名古屋市", prefecture: "愛知県" },
    ]),
    { label: "位置をぼかしています", scope: "blurred" },
  );
});

test("public grid meters and capped zoom use the calibrated thresholds", () => {
  assert.equal(pickPublicGridMeters(undefined), 3000);
  assert.equal(pickPublicGridMeters(9), 10000);
  assert.equal(pickPublicGridMeters(10), 3000);
  assert.equal(pickPublicGridMeters(13), 1000);

  assert.equal(maxZoomForGrid(1000), 13.2);
  assert.equal(maxZoomForGrid(3000), 11.8);
  assert.equal(maxZoomForGrid(10000), 10.1);
});

test("buildPublicLocationSummary emits cell-centered area metadata without exact coordinates", () => {
  const summary = buildPublicLocationSummary({
    municipality: "浜松市",
    prefecture: "静岡県",
    latitude: 34.7116,
    longitude: 137.7274,
    zoom: 13,
  });

  assert.equal(summary.label, "浜松市");
  assert.equal(summary.scope, "municipality");
  assert.equal(summary.gridM, 1000);
  assert.ok(typeof summary.cellId === "string" && summary.cellId.length > 0);
  assert.ok(typeof summary.radiusM === "number" && summary.radiusM > 0);
  assert.ok(typeof summary.centroidLat === "number");
  assert.ok(typeof summary.centroidLng === "number");
  assert.equal(summary.displayMode, "area");
});

test("buildPublicLocationSummary keeps label but drops geometry when coordinates are missing", () => {
  const summary = buildPublicLocationSummary({
    municipality: null,
    prefecture: "静岡県",
    latitude: null,
    longitude: null,
  });

  assert.equal(summary.label, "静岡県");
  assert.equal(summary.scope, "prefecture");
  assert.equal(summary.cellId, null);
  assert.equal(summary.gridM, null);
  assert.equal(summary.centroidLat, null);
  assert.equal(summary.centroidLng, null);
});
