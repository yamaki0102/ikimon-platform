import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyAreaRecord,
  classifyAreaRecordCandidates,
  RYUYO_FIELD_ID,
  RYUYO_NEARBY_METERS,
} from "./areaEncyclopediaNative";

const geometry = {
  type: "Polygon" as const,
  coordinates: [[
    [137.8, 34.65],
    [137.802, 34.65],
    [137.802, 34.652],
    [137.8, 34.652],
    [137.8, 34.65],
  ]],
};

test("Ryuyo separates core and nearby records without changing candidate data", () => {
  const candidates = [
    { visitId: "nearby", observedAt: "2026-09-02", displayName: "周辺", lat: 34.651, lng: 137.8022 },
    { visitId: "core-old", observedAt: "2026-08-01", displayName: "園内", lat: 34.651, lng: 137.801 },
    { visitId: "core-new", observedAt: "2026-09-03", displayName: "園内", lat: 34.6515, lng: 137.801 },
    { visitId: "outside", observedAt: "2026-09-04", displayName: "範囲外", lat: 34.651, lng: 137.81 },
  ];
  const result = classifyAreaRecordCandidates(RYUYO_FIELD_ID, geometry, candidates);

  assert.deepEqual(result.core.map((item) => item.visitId), ["core-new", "core-old"]);
  assert.deepEqual(result.nearby.map((item) => item.visitId), ["nearby"]);
  assert.equal(candidates.some((item) => "resolvedFieldIds" in item), false);
});

test("nearby context is not assigned to arbitrary fields", () => {
  const point = { lat: 34.651, lng: 137.8022 };
  assert.equal(classifyAreaRecord(RYUYO_FIELD_ID, geometry, point), "nearby");
  assert.equal(classifyAreaRecord("another-field", geometry, point), "outside");
});

test("records beyond 300 metres are excluded from Ryuyo context", () => {
  assert.equal(
    classifyAreaRecord(RYUYO_FIELD_ID, geometry, { lat: 34.651, lng: 137.81 }),
    "outside",
  );
});

test("real Ryuyo OSM boundary keeps the park and nearby 300 m context separate", () => {
  const ryuyoBoundary = {
    type: "Polygon" as const,
    coordinates: [[
      [137.8393578, 34.6684471],
      [137.8391405, 34.6708363],
      [137.8391517, 34.6712001],
      [137.8394498, 34.6708521],
      [137.8405761, 34.6693071],
      [137.8407421, 34.6690781],
      [137.8393578, 34.6684471],
    ]],
  };
  const candidates = [
    { visitId: "ryuyo-park-core", observedAt: "2026-09-28", displayName: "園内記録", lat: 34.6698, lng: 137.8398 },
    { visitId: "ryuyo-park-nearby", observedAt: "2026-09-29", displayName: "周辺記録", lat: 34.6698, lng: 137.8415 },
    { visitId: "ryuyo-park-outside", observedAt: "2026-09-29", displayName: "範囲外", lat: 34.6698, lng: 137.8445 },
  ];

  const result = classifyAreaRecordCandidates(RYUYO_FIELD_ID, ryuyoBoundary, candidates);

  assert.equal(RYUYO_NEARBY_METERS, 300);
  assert.deepEqual(result.core.map(({ visitId }) => visitId), ["ryuyo-park-core"]);
  assert.deepEqual(result.nearby.map(({ visitId }) => visitId), ["ryuyo-park-nearby"]);
  assert.deepEqual(candidates.map(({ visitId }) => visitId), [
    "ryuyo-park-core",
    "ryuyo-park-nearby",
    "ryuyo-park-outside",
  ]);
});
