import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  __test__,
  buildPublicCellRecords,
  buildPublicMapCells,
  PUBLIC_MAP_AGGREGATE_POLICY,
} from "./mapSnapshot.js";
import { __test__ as schedulerTest } from "./publicMapSnapshotScheduler.js";

type PreparedRows = Parameters<typeof __test__.buildPublicMapSnapshotPayload>[0];

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
    {
      occurrenceId: "occ-3",
      visitId: "visit-3",
      displayName: "ヒヨドリ",
      observedAt: "2026-04-10T09:00:00.000Z",
      latitude: 34.7124,
      longitude: 137.7281,
      municipality: "浜松市",
      prefecture: "静岡県",
      localityLabel: "浜松市",
      localityScope: "municipality",
      photoUrl: "/uploads/sample-3.jpg",
      taxonGroup: "bird",
      sourceKind: "v2_observation",
      sessionMode: "standard",
      visitMode: "manual",
      qualityGrade: "research",
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
  assert.equal(feature.properties.count, 3);
  assert.equal(feature.properties.firstObservedAt, "2026-04-08T09:00:00.000Z");
  assert.equal(feature.properties.latestObservedAt, "2026-04-10T09:00:00.000Z");
  assert.ok(typeof feature.properties.cellId === "string" && feature.properties.cellId.length > 0);
  assert.equal(feature.geometry.coordinates[0]?.length, 5);
  assert.deepEqual(collection.stats.privacy, PUBLIC_MAP_AGGREGATE_POLICY);
  assert.equal(collection.stats.totalRecords, 3);
  assert.equal(collection.stats.provenance.sampleSize, 3);
});

test("buildPublicMapCells suppresses cells below the public aggregate threshold", () => {
  const collection = buildPublicMapCells(sampleRows().slice(0, PUBLIC_MAP_AGGREGATE_POLICY.minCellRecords - 1), 13);

  assert.equal(collection.features.length, 0);
  assert.equal(collection.stats.totalReturned, 0);
  assert.equal(collection.stats.totalAll, 0);
  assert.equal(collection.stats.totalRecords, 0);
  assert.equal(collection.stats.provenance.sampleSize, 0);
  assert.deepEqual(collection.stats.privacy, PUBLIC_MAP_AGGREGATE_POLICY);
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
    {
      ...sampleRows()[2]!,
      municipality: "浜松市",
      prefecture: "静岡県",
      localityLabel: "浜松市",
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

  assert.equal(list.items.length, 3);
  assert.equal(list.stats.gridM, 1000);
  assert.equal(list.stats.selectedCellId, cellId);
  assert.deepEqual(list.stats.privacy, PUBLIC_MAP_AGGREGATE_POLICY);
  assert.equal(list.stats.totalAll, 3);

  const record = list.items[0] as Record<string, unknown>;
  assert.equal(record.localityLabel, "浜松市");
  assert.ok(!("lat" in record));
  assert.ok(!("lng" in record));
  assert.ok(!("placeName" in record));
  assert.ok(!("siteName" in record));
});

test("buildPublicCellRecords hides selected cells below the aggregate threshold", () => {
  const publicCellId = buildPublicMapCells(sampleRows(), 13).features[0]!.properties.cellId;
  const list = buildPublicCellRecords(sampleRows().slice(0, PUBLIC_MAP_AGGREGATE_POLICY.minCellRecords - 1), {
    cellId: publicCellId,
    zoom: 13,
  });

  assert.equal(list.items.length, 0);
  assert.equal(list.stats.totalReturned, 0);
  assert.equal(list.stats.totalAll, 0);
  assert.equal(list.stats.provenance.sampleSize, 0);
  assert.deepEqual(list.stats.privacy, PUBLIC_MAP_AGGREGATE_POLICY);
});

test("buildPublicCellRecords suppresses low-count cells in viewport lists", () => {
  const lowCountCellRows = sampleRows().slice(0, 2).map((row, index) => ({
    ...row,
    occurrenceId: `low-occ-${index + 1}`,
    visitId: `low-visit-${index + 1}`,
    latitude: 35.6581 + index * 0.0001,
    longitude: 139.7017 + index * 0.0001,
    municipality: "渋谷区",
    prefecture: "東京都",
    localityLabel: "渋谷区",
    localityScope: "municipality" as const,
  }));
  const list = buildPublicCellRecords([...sampleRows(), ...lowCountCellRows], { zoom: 13 });

  assert.equal(list.items.length, 3);
  assert.equal(list.stats.totalAll, 3);
  assert.ok(list.items.every((item) => item.localityLabel === "浜松市"));
});

test("sensitive redlist records use coarser cells and masked list fields", () => {
  const sensitiveRows = sampleRows().map((row, index) => ({
    ...row,
    occurrenceId: `rare-occ-${index + 1}`,
    visitId: `rare-visit-${index + 1}`,
    displayName: "ヤマネ",
    photoUrl: `/uploads/rare-${index + 1}.jpg`,
    taxonGroup: "mammal" as const,
    publicCoordMode: "mesh_1km" as const,
    publicCoordReason: "rare_redlist" as const,
  }));
  const collection = buildPublicMapCells(sensitiveRows, 13);

  assert.equal(collection.features.length, 1);
  const feature = collection.features[0]!;
  assert.equal(feature.properties.gridM, PUBLIC_MAP_AGGREGATE_POLICY.sensitiveMinCellMeters);
  assert.equal(feature.properties.count, 3);

  const list = buildPublicCellRecords(sensitiveRows, {
    cellId: feature.properties.cellId,
    zoom: 13,
  });
  assert.equal(list.items.length, 3);
  assert.ok(list.items.every((item) => item.displayName === "大切な生きもの"));
  assert.ok(list.items.every((item) => item.photoUrl === null));
});

test("municipality precision records use the broad public map grid", () => {
  const municipalityRows = sampleRows().map((row) => ({
    ...row,
    publicCoordMode: "municipality" as const,
    publicCoordReason: "context_explicit" as const,
  }));
  const collection = buildPublicMapCells(municipalityRows, 13);

  assert.equal(collection.features.length, 1);
  assert.equal(collection.features[0]!.properties.gridM, PUBLIC_MAP_AGGREGATE_POLICY.municipalityMinCellMeters);
});

test("fixed bbox scope covers the whole public cell instead of the exact bbox", () => {
  const rows = sampleRows();
  const feature = buildPublicMapCells(rows, 13).features[0]!;
  const { centroidLat, centroidLng } = feature.properties;
  const narrowBbox: [number, number, number, number] = [
    centroidLng - 0.00001,
    centroidLat - 0.00001,
    centroidLng + 0.00001,
    centroidLat + 0.00001,
  ];
  const rawPointIsInsideExactBbox = rows[0]!.longitude >= narrowBbox[0]
    && rows[0]!.longitude <= narrowBbox[2]
    && rows[0]!.latitude >= narrowBbox[1]
    && rows[0]!.latitude <= narrowBbox[3];

  assert.equal(rawPointIsInsideExactBbox, false);
  const scope = __test__.buildPublicMapFixedCellScope(narrowBbox, 1000);
  assert.equal(__test__.publicRecordInFixedScope(rows[0]!, scope), true);
  assert.equal(__test__.publicRecordInFixedScope(rows[1]!, scope), true);

  const tinierScope = __test__.buildPublicMapFixedCellScope([
    centroidLng - 0.000005,
    centroidLat - 0.000005,
    centroidLng + 0.000005,
    centroidLat + 0.000005,
  ], 1000);
  assert.deepEqual(
    scope.ranges.find((range) => range.gridM === 1000),
    tinierScope.ranges.find((range) => range.gridM === 1000),
  );
});

test("fixed bbox scope includes the sensitive coarse cell cover", () => {
  const sensitiveRows = sampleRows().map((row) => ({
    ...row,
    publicCoordMode: "mesh_1km" as const,
    publicCoordReason: "rare_redlist" as const,
  }));
  const feature = buildPublicMapCells(sensitiveRows, 13).features[0]!;
  const { centroidLat, centroidLng } = feature.properties;
  const scope = __test__.buildPublicMapFixedCellScope([
    centroidLng - 0.00001,
    centroidLat - 0.00001,
    centroidLng + 0.00001,
    centroidLat + 0.00001,
  ], 1000);

  assert.ok(scope.ranges.some((range) => range.gridM === PUBLIC_MAP_AGGREGATE_POLICY.sensitiveMinCellMeters));
  assert.equal(__test__.publicRecordInFixedScope(sensitiveRows[0]!, scope), true);
});

test("public map snapshot payload stores public cell memberships instead of coordinates", () => {
  const payload = __test__.buildPublicMapSnapshotPayload(sampleRows(), "2026-06-19T00:00:00.000Z");

  assert.equal(payload.version, 1);
  assert.equal(payload.generatedAt, "2026-06-19T00:00:00.000Z");
  assert.equal(payload.records.length, 3);

  const record = payload.records[0] as Record<string, unknown>;
  assert.ok(!("latitude" in record));
  assert.ok(!("longitude" in record));
  assert.equal(typeof record.cellIdsByRequestedGrid, "object");
  assert.ok((record.cellIdsByRequestedGrid as Record<string, string>)["1000"]);
  assert.ok((record.cellIdsByRequestedGrid as Record<string, string>)["3000"]);
  assert.ok((record.cellIdsByRequestedGrid as Record<string, string>)["10000"]);
});

test("refreshPublicMapSnapshot serializes snapshot rewrites with a transaction advisory lock", async () => {
  const source = await readFile(new URL("./mapSnapshot.ts", import.meta.url), "utf8");

  assert.match(source, /PUBLIC_MAP_REFRESH_LOCK_KEY/);
  assert.match(source, /pg_advisory_xact_lock\(hashtext\(\$1\)\)/);
  assert.match(source, /await client\.query\("begin"\)/);
  assert.match(source, /await client\.query\("commit"\)/);
});

test("public map snapshot status detects missing, fresh, and stale snapshots", () => {
  const now = new Date("2026-06-19T12:00:00.000Z");
  const maxAgeMs = 6 * 60 * 60 * 1000;

  const missing = __test__.publicMapSnapshotStatusFromRow(null, { now, maxAgeMs });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, "missing");

  const fresh = __test__.publicMapSnapshotStatusFromRow({
    generated_at: "2026-06-19T08:30:00.000Z",
    source_sample_size: "120",
    public_record_count: "90",
    refreshed_by: "test",
  }, { now, maxAgeMs });
  assert.equal(fresh.ok, true);
  assert.equal(fresh.status, "fresh");
  assert.equal(fresh.ageSeconds, 12_600);
  assert.equal(fresh.sourceSampleSize, 120);
  assert.equal(fresh.publicRecordCount, 90);

  const stale = __test__.publicMapSnapshotStatusFromRow({
    generated_at: "2026-06-19T05:00:00.000Z",
    source_sample_size: 120,
    public_record_count: 90,
    refreshed_by: "test",
  }, { now, maxAgeMs });
  assert.equal(stale.ok, false);
  assert.equal(stale.status, "stale");
});

test("public map snapshot scheduler clamps unsafe refresh intervals", () => {
  assert.equal(
    schedulerTest.resolveRefreshIntervalMs({ IKIMON_PUBLIC_MAP_SNAPSHOT_REFRESH_INTERVAL_MINUTES: "1" }),
    5 * 60 * 1000,
  );
  assert.equal(
    schedulerTest.resolveRefreshIntervalMs({ IKIMON_PUBLIC_MAP_SNAPSHOT_REFRESH_INTERVAL_MINUTES: "90" }),
    90 * 60 * 1000,
  );
  assert.equal(
    schedulerTest.publicMapSnapshotRefreshDisabled({ IKIMON_PUBLIC_MAP_SNAPSHOT_REFRESH_DISABLED: "1" }),
    true,
  );
  assert.equal(
    schedulerTest.resolveWriteRefreshDebounceMs({ IKIMON_PUBLIC_MAP_SNAPSHOT_WRITE_REFRESH_DEBOUNCE_SECONDS: "5" }),
    30 * 1000,
  );
});

test("public map request read path does not aggregate source rows directly", async () => {
  const source = await readFile(new URL("./mapSnapshot.ts", import.meta.url), "utf8");
  const cellsBody = source.match(/export async function getMapCells[\s\S]*?\n}\n\nexport async function getMapObservations/)?.[0] ?? "";
  const observationsBody = source.match(/export async function getMapObservations[\s\S]*?\n}\n\nexport const __test__/)?.[0] ?? "";

  assert.match(cellsBody, /loadPublicMapSnapshotPayload/);
  assert.match(observationsBody, /loadPublicMapSnapshotPayload/);
  assert.doesNotMatch(cellsBody, /fetchPublicMapRows/);
  assert.doesNotMatch(observationsBody, /fetchPublicMapRows/);
});

test("public map source read excludes staging regression seed provenance without blocking detail pages", async () => {
  const mapSource = await readFile(new URL("./mapSnapshot.ts", import.meta.url), "utf8");
  const qualitySource = await readFile(new URL("./observationQualityGate.ts", import.meta.url), "utf8");

  assert.match(mapSource, /regression\[-_\]\?seed/);
  assert.doesNotMatch(qualitySource, /regression\[-_\]\?seed/);
});

test("public map snapshot refresh is wired to app startup and write/import exits", async () => {
  const appSource = await readFile(new URL("../app.ts", import.meta.url), "utf8");
  const observationWriteSource = await readFile(new URL("./observationWrite.ts", import.meta.url), "utf8");
  const trackWriteSource = await readFile(new URL("./trackWrite.ts", import.meta.url), "utf8");
  const legacyImportSource = await readFile(new URL("../scripts/bootstrapLegacyImport.ts", import.meta.url), "utf8");
  const mapSnapshotSource = await readFile(new URL("./mapSnapshot.ts", import.meta.url), "utf8");

  assert.match(appSource, /startPublicMapSnapshotScheduler\(\)/);
  assert.match(observationWriteSource, /queuePublicMapSnapshotRefresh\("observation-upsert", \{ force: true \}\)/);
  assert.match(trackWriteSource, /queuePublicMapSnapshotRefresh\("track-upsert", \{ force: true \}\)/);
  assert.match(legacyImportSource, /refreshPublicMapSnapshotIfStale\(\{[\s\S]*refreshedBy: "import:bootstrapLegacyImport"/);
  assert.match(mapSnapshotSource, /update staleness_alerts[\s\S]*resolved_at = now\(\)[\s\S]*registry_key = \$1/);
});

test("public map photos fall back to visit-level assets", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "mapSnapshot.ts"), "utf8");

  assert.match(source, /where \(ea\.occurrence_id = o\.occurrence_id or ea\.visit_id = o\.visit_id\)/);
  assert.match(source, /order by case when ea\.occurrence_id = o\.occurrence_id then 0 else 1 end/);
});
