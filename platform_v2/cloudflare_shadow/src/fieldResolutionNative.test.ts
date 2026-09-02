import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveFieldsForPointNative,
  type FieldResolutionNativeDatabase,
} from "./fieldResolutionNative";

const ryuyoGeometry = JSON.stringify({
  type: "Polygon",
  coordinates: [[
    [137.8393578, 34.6684471], [137.8391405, 34.6708363],
    [137.8391517, 34.6712001], [137.8394498, 34.6708521],
    [137.8405761, 34.6693071], [137.8407421, 34.6690781],
    [137.8393578, 34.6684471],
  ]],
});
function database(rows: unknown[]): FieldResolutionNativeDatabase {
  return {
    prepare(sql) {
      assert.match(sql, /production_import_area_polygon_readmodel/);
      return {
        bind() { return this; },
        async all<T>() { return { results: rows as T[] }; },
      };
    },
  };
}

test("resolves an inside point and rejects an outside control point", async () => {
  const rows = [{
    field_id: "372eafbd-ea9c-4b2f-ab5f-434b81b928b2",
    bbox_min_lat: 34.6684471, bbox_max_lat: 34.6712001,
    bbox_min_lng: 137.8391405, bbox_max_lng: 137.8407421,
    geometry_json: ryuyoGeometry,
  }];
  assert.deepEqual(await resolveFieldsForPointNative(34.6695, 137.8400, database(rows)), [
    "372eafbd-ea9c-4b2f-ab5f-434b81b928b2",
  ]);
  assert.deepEqual(await resolveFieldsForPointNative(34.6720, 137.8400, database(rows)), []);
});

test("invalid coordinates fail closed", async () => {
  assert.deepEqual(await resolveFieldsForPointNative(Number.NaN, 137.84, database([])), []);
});
