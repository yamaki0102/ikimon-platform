import assert from "node:assert/strict";
import test from "node:test";
import {
  buildViewerOwnedExactCoordinateDisclosure,
  coarsenPublicCoordinateToCell,
  decidePublicCoordinateVisibility,
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
  assert.equal(pickPublicGridMeters(15), 500);

  assert.equal(maxZoomForGrid(500), 15.4);
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
    zoom: 15,
  });

  assert.equal(summary.label, "浜松市");
  assert.equal(summary.scope, "municipality");
  assert.equal(summary.gridM, 500);
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

test("buildPublicLocationSummary accepts coordinate range boundaries", () => {
  for (const coordinates of [
    { latitude: -90, longitude: -180 },
    { latitude: 90, longitude: 180 },
  ]) {
    const summary = buildPublicLocationSummary({
      municipality: "境界地点",
      prefecture: "境界県",
      ...coordinates,
    });

    assert.equal(summary.label, "境界地点");
    assert.ok(summary.cellId);
    assert.ok(typeof summary.centroidLat === "number");
    assert.ok(typeof summary.centroidLng === "number");
  }
});

test("buildPublicLocationSummary drops cell and geometry for out-of-range coordinates", () => {
  for (const coordinates of [
    { latitude: -90.000001, longitude: 0 },
    { latitude: 90.000001, longitude: 0 },
    { latitude: 0, longitude: -180.000001 },
    { latitude: 0, longitude: 180.000001 },
  ]) {
    const summary = buildPublicLocationSummary({
      municipality: "浜松市",
      prefecture: "静岡県",
      ...coordinates,
    });

    assert.equal(summary.label, "浜松市");
    assert.equal(summary.scope, "municipality");
    assert.equal(summary.cellId, null);
    assert.equal(summary.gridM, null);
    assert.equal(summary.radiusM, null);
    assert.equal(summary.centroidLat, null);
    assert.equal(summary.centroidLng, null);
  }
});

test("buildPublicLocationSummary infers Okinawa prefecture from coordinates when locality is missing", () => {
  const summary = buildPublicLocationSummary({
    latitude: 26.2124,
    longitude: 127.6809,
    zoom: 13,
  });

  assert.equal(summary.label, "沖縄県");
  assert.equal(summary.scope, "prefecture");
  assert.ok(summary.cellId);
  assert.ok(typeof summary.centroidLat === "number");
  assert.ok(typeof summary.centroidLng === "number");
});

test("buildPublicLocationSummary infers other prefectures and overseas countries from coordinates", () => {
  assert.deepEqual(
    resolvePublicLocalityLabel({ latitude: 35.6812, longitude: 139.7671 }),
    { label: "東京都", scope: "prefecture" },
  );

  assert.deepEqual(
    resolvePublicLocalityLabel({ latitude: 34.8134, longitude: 137.7319 }),
    { label: "静岡県", scope: "prefecture" },
  );

  assert.deepEqual(
    resolvePublicLocalityLabel({ latitude: 48.8566, longitude: 2.3522 }),
    { label: "フランス", scope: "country" },
  );

  assert.deepEqual(
    resolvePublicLocalityLabel({ latitude: -17.7, longitude: -149.4 }),
    { label: "海外", scope: "country" },
  );
});

test("buildPublicLocationSummary uses explicit overseas country when coordinates are missing", () => {
  const summary = buildPublicLocationSummary({
    country: "US",
    latitude: null,
    longitude: null,
  });

  assert.equal(summary.label, "アメリカ合衆国");
  assert.equal(summary.scope, "country");
});

test("decidePublicCoordinateVisibility exposes exact coordinates only to the record owner", () => {
  assert.deepEqual(
    decidePublicCoordinateVisibility({
      policy: "viewer_owned",
      viewerUserId: "user-1",
      ownerUserId: "user-1",
      latitude: 34.7116,
      longitude: 137.7274,
    }),
    { canExposeExact: true, reason: "viewer_owner" },
  );

  assert.deepEqual(
    decidePublicCoordinateVisibility({
      policy: "viewer_owned",
      viewerUserId: "user-2",
      ownerUserId: "user-1",
      latitude: 34.7116,
      longitude: 137.7274,
    }),
    { canExposeExact: false, reason: "not_owner" },
  );

  assert.deepEqual(
    decidePublicCoordinateVisibility({
      policy: "viewer_owned",
      viewerUserId: "user-1",
      ownerUserId: "user-1",
      latitude: 999,
      longitude: 137.7274,
    }),
    { canExposeExact: false, reason: "invalid_coordinates" },
  );
});

test("buildViewerOwnedExactCoordinateDisclosure preserves owner exact points without exposing others", () => {
  assert.deepEqual(
    buildViewerOwnedExactCoordinateDisclosure({
      viewerUserId: "user-1",
      ownerUserId: "user-1",
      latitude: 34.7116,
      longitude: 137.7274,
    }),
    {
      isViewerOwned: true,
      exactLatitude: 34.7116,
      exactLongitude: 137.7274,
    },
  );

  assert.deepEqual(
    buildViewerOwnedExactCoordinateDisclosure({
      viewerUserId: null,
      ownerUserId: "user-1",
      latitude: 34.7116,
      longitude: 137.7274,
    }),
    {},
  );
});

test("coarsenPublicCoordinateToCell returns a public cell centroid instead of the raw point", () => {
  const point = coarsenPublicCoordinateToCell(34.7116, 137.7274, 1000);

  assert.ok(point);
  assert.equal(point.gridM, 1000);
  assert.ok(point.cellId.length > 0);
  assert.notEqual(point.lat, 34.7116);
  assert.notEqual(point.lng, 137.7274);
});
