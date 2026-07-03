import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMapOwnObservationClusters, isMeaningfulOwnObservationLabel, type MapOwnObservation } from "./mapOwnObservations.js";

const source = readFileSync(new URL("./mapOwnObservations.ts", import.meta.url), "utf8");

test("owner map observations reject smoke and placeholder records even for the signed-in owner", () => {
  assert.match(source, /source_payload->>'source'/);
  assert.match(source, /e2e\|smoke\|fixture\|dummy\|placeholder/);
});

test("owner map observations require a meaningful label source before drawing exact points", () => {
  assert.match(source, /nullif\(o\.vernacular_name, ''\)/);
  assert.match(source, /nullif\(ai\.recommended_taxon_name, ''\)/);
  assert.match(source, /nullif\(v\.note, ''\)/);
  assert.match(source, /is not null/);
});

test("owner map observations only use promoted observation visits for exact owner pins", () => {
  assert.match(source, /v\.source_kind = 'v2_observation'/);
  assert.match(source, /coalesce\(v\.session_mode, ''\) = 'standard'/);
  assert.match(source, /coalesce\(v\.visit_mode, 'manual'\) in \('manual', 'survey'\)/);
});

test("owner map observations never fall back to place centers for exact owner pins", () => {
  assert.match(source, /v\.point_latitude as latitude/);
  assert.match(source, /v\.point_longitude as longitude/);
  assert.match(source, /and v\.point_latitude is not null/);
  assert.match(source, /and v\.point_longitude is not null/);
  assert.doesNotMatch(source, /coalesce\(v\.point_latitude, p\.center_latitude\) as latitude/);
  assert.doesNotMatch(source, /coalesce\(v\.point_longitude, p\.center_longitude\) as longitude/);
});

test("owner map observations reject labels that would render as empty-looking history", () => {
  for (const label of ["", " ", "同定待ち", "名前を確認中", "写真", "記録", "scan", "dummy plant", "Regression Manual Finch"]) {
    assert.equal(isMeaningfulOwnObservationLabel(label), false, label);
  }
  for (const label of ["アカメガシワ", "朝の水辺メモ", "白い花の群落"]) {
    assert.equal(isMeaningfulOwnObservationLabel(label), true, label);
  }
});

test("owner map observations can summarize dense private places without new storage", () => {
  const base: Omit<MapOwnObservation, "occurrenceId" | "visitId" | "displayName" | "observedAt" | "latitude" | "longitude"> = {
    photoUrl: "/uploads/a.jpg",
    mediaKind: "photo",
    localityLabel: "那覇市",
  };
  const items: MapOwnObservation[] = [
    { ...base, occurrenceId: "occ-1", visitId: "v1", displayName: "シロツメクサ", observedAt: "2026-06-20T01:00:00.000Z", latitude: 26.2100, longitude: 127.6800 },
    { ...base, occurrenceId: "occ-2", visitId: "v2", displayName: "アカメガシワ", observedAt: "2026-06-21T01:00:00.000Z", latitude: 26.2108, longitude: 127.6807 },
    { ...base, occurrenceId: "occ-3", visitId: "v3", displayName: "カタバミ", observedAt: "2026-06-22T01:00:00.000Z", latitude: 26.2112, longitude: 127.6812 },
    { ...base, occurrenceId: "occ-4", visitId: "v4", displayName: "遠い記録", observedAt: "2026-06-23T01:00:00.000Z", latitude: 35.6800, longitude: 139.7600 },
  ];

  const clusters = buildMapOwnObservationClusters(items, { radiusMeters: 1000, minRecords: 3, limit: 3 });

  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]?.recordCount, 3);
  assert.equal(clusters[0]?.label, "那覇市");
  assert.deepEqual(clusters[0]?.occurrenceIds, ["occ-3", "occ-2", "occ-1"]);
  assert.equal(clusters[0]?.representativeOccurrenceId, "occ-3");
});
