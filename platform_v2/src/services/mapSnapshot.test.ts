import assert from "node:assert/strict";
import test from "node:test";
import {
  __test__,
  buildPublicCellRecords,
  buildPublicMapCells,
} from "./mapSnapshot.js";

type PreparedRows = Parameters<typeof buildPublicMapCells>[0];

function sampleRows(): PreparedRows {
  return [
    {
      occurrenceId: "occ-1",
      visitId: "visit-1",
      displayName: "モンシロチョウ",
      observedAt: "2026-04-08T09:00:00.000Z",
      latitude: 34.7116,
      longitude: 137.7274,
      municipality: "浜松市",
      prefecture: "静岡県",
      localityLabel: "浜松市",
      localityScope: "municipality",
      photoUrl: "/uploads/sample-1.jpg",
      taxonGroup: "insect",
      sourceKind: "v2_observation",
      sessionMode: "standard",
      visitMode: "manual",
      qualityGrade: "research",
      aiCandidateName: null,
      aiCandidateRank: null,
      isAiCandidate: false,
    },
    {
      occurrenceId: "occ-2",
      visitId: "visit-2",
      displayName: "モンシロチョウ",
      observedAt: "2026-04-09T09:00:00.000Z",
      latitude: 34.7121,
      longitude: 137.7279,
      municipality: "浜松市",
      prefecture: "静岡県",
      localityLabel: "浜松市",
      localityScope: "municipality",
      photoUrl: null,
      taxonGroup: "insect",
      sourceKind: "v2_observation",
      sessionMode: "standard",
      visitMode: "manual",
      qualityGrade: "casual",
      aiCandidateName: null,
      aiCandidateRank: null,
      isAiCandidate: false,
    },
  ];
}

test("buildPublicMapCells returns deterministic polygon cells with privacy props", () => {
  const collection = buildPublicMapCells(sampleRows(), 13);

  assert.equal(collection.type, "FeatureCollection");
  assert.equal(collection.features.length, 1);

  const feature = collection.features[0]!;
  assert.equal(feature.geometry.type, "Polygon");
  assert.equal(feature.properties.label, "浜松市");
  assert.equal(feature.properties.localityLabel, "浜松市");
  assert.equal(feature.properties.albumName, "浜松市・虫の小径");
  assert.equal(feature.properties.themeLabel, "虫の小径");
  assert.equal(feature.properties.scaleLabel, "近所メッシュ");
  assert.equal(feature.properties.nameEraLabel, null);
  assert.equal(feature.properties.scope, "municipality");
  assert.equal(feature.properties.gridM, 1000);
  assert.ok(feature.properties.radiusM > 0);
  assert.equal(feature.properties.count, 2);
  assert.equal(feature.properties.firstObservedAt, "2026-04-08T09:00:00.000Z");
  assert.equal(feature.properties.latestObservedAt, "2026-04-09T09:00:00.000Z");
  assert.ok(typeof feature.properties.cellId === "string" && feature.properties.cellId.length > 0);
  assert.equal(feature.geometry.coordinates[0]?.length, 5);
});

test("buildPublicMapCells falls back to prefecture when one cell mixes municipalities", () => {
  const collection = buildPublicMapCells([
    {
      ...sampleRows()[0]!,
      municipality: "浜松市",
      prefecture: "静岡県",
      localityLabel: "浜松市",
      localityScope: "municipality",
    },
    {
      ...sampleRows()[1]!,
      municipality: "静岡市",
      prefecture: "静岡県",
      localityLabel: "静岡市",
      localityScope: "municipality",
    },
  ], 10);

  assert.equal(collection.features.length, 1);
  assert.equal(collection.features[0]!.properties.label, "静岡県");
  assert.equal(collection.features[0]!.properties.albumName, "静岡県・虫の探索区");
  assert.equal(collection.features[0]!.properties.scope, "prefecture");
});

test("nearby area names prefer the version that was valid when the cell was observed", () => {
  const bounds: [number, number, number, number] = [137.72, 34.70, 137.73, 34.72];
  const base = {
    admin_level: "osm_park",
    source: "user_defined",
    entity_key: "osm:way:1",
    area_ha: "3",
    bbox_min_lat: "34.69",
    bbox_max_lat: "34.73",
    bbox_min_lng: "137.71",
    bbox_max_lng: "137.74",
  };

  const choice = __test__.chooseNearbyAreaName([
    {
      ...base,
      name: "新しい公園名",
      valid_from: "2035-01-01",
      valid_to: null,
    },
    {
      ...base,
      name: "古い公園名",
      valid_from: "2020-01-01",
      valid_to: "2034-12-31",
    },
  ], bounds, {
    firstObservedAt: "2026-04-08T09:00:00.000Z",
    latestObservedAt: "2026-04-09T09:00:00.000Z",
  });

  assert.deepEqual(choice, {
    name: "古い公園名",
    nameEraLabel: "観察当時の地名",
  });
});

test("buildPublicCellRecords drops exact coordinates and site-level names from public lists", () => {
  const rows = sampleRows();
  const cells = buildPublicMapCells(rows, 13);
  const cellId = cells.features[0]!.properties.cellId;
  const list = buildPublicCellRecords(rows, { cellId, zoom: 13 });

  assert.equal(list.items.length, 2);
  assert.equal(list.stats.gridM, 1000);
  assert.equal(list.stats.selectedCellId, cellId);

  const record = list.items[0] as Record<string, unknown>;
  assert.equal(record.localityLabel, "浜松市");
  assert.ok(!("lat" in record));
  assert.ok(!("lng" in record));
  assert.ok(!("placeName" in record));
  assert.ok(!("siteName" in record));
});
