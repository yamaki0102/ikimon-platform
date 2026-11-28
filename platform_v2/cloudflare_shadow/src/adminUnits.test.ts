import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminIndex,
  geometryBbox,
  publishedLevelFor,
  resolveAdminCodes,
  simplifyGeometry,
  type AdminBoundary,
  type AdminGeometry,
  type Ring
} from "./adminUnits";

const sq = (x0: number, y0: number, x1: number, y1: number): Ring => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];

function unit(code: string, level: AdminBoundary["level"], parent: string | null, geometry: AdminGeometry): AdminBoundary {
  return { code, level, parent_code: parent, bbox: geometryBbox(geometry), geometry };
}

const units = [
  unit("22101", "ward", "22100", { type: "Polygon", coordinates: [sq(0, 0, 10, 10), sq(4, 4, 6, 6)] }),
  unit("22102", "ward", "22100", { type: "MultiPolygon", coordinates: [[sq(10, 0, 20, 10)], [sq(30, 0, 40, 10)]] }),
  unit("22201", "city", null, { type: "Polygon", coordinates: [sq(0, 20, 10, 30)] }),
  unit("22302", "village", null, { type: "Polygon", coordinates: [sq(0, 40, 10, 50)] }),
  unit("221010010", "town", "22101", { type: "Polygon", coordinates: [sq(0, 0, 5, 10)] }),
  unit("221010020", "town", "22101", { type: "Polygon", coordinates: [sq(5, 0, 10, 10)] })
];
const index = buildAdminIndex(units);

test("ward and town resolve with hole and multipolygon", () => {
  assert.deepEqual(resolveAdminCodes(2, 2, index), { country_code: "JP", pref_code: "22", city_code: "22100", ward_code: "22101", town_code: "221010010" });
  assert.equal(resolveAdminCodes(7, 2, index).town_code, "221010020");
  assert.equal(resolveAdminCodes(5, 5, index).ward_code, null);
  assert.equal(resolveAdminCodes(35, 5, index).ward_code, "22102");
  assert.equal(resolveAdminCodes(35, 5, index).town_code, null);
});

test("city without towns and village limited to prefecture", () => {
  const c = resolveAdminCodes(5, 25, index);
  assert.equal(c.city_code, "22201");
  assert.equal(c.ward_code, null);
  const v = resolveAdminCodes(5, 45, index);
  assert.equal(v.pref_code, "22");
  assert.equal(v.city_code, null);
  assert.equal(resolveAdminCodes(100, 100, index).pref_code, null);
});

test("published level caps", () => {
  const codes = resolveAdminCodes(2, 2, index);
  assert.equal(publishedLevelFor(codes, null), "town");
  assert.equal(publishedLevelFor(codes, { is_child_or_rare: true }), "pref");
  assert.equal(publishedLevelFor(codes, { coarsened: 1 }), "pref");
  assert.equal(publishedLevelFor(codes, { location_share_mode: "hidden" }), "hidden");
  assert.equal(publishedLevelFor(codes, { risk_lane: "sensitive" }), "hidden");
  assert.equal(publishedLevelFor(codes, { municipality: "某村" }), "pref");
  assert.equal(publishedLevelFor(resolveAdminCodes(35, 5, index), {}), "ward");
  assert.equal(publishedLevelFor(resolveAdminCodes(5, 45, index), {}), "pref");
  assert.equal(publishedLevelFor(resolveAdminCodes(100, 100, index), {}), "hidden");
});

test("simplify keeps shape", () => {
  const ring: Ring = [];
  for (let i = 0; i <= 100; i++) ring.push([i / 10, (i % 2) * 0.00001]);
  ring.push([10, 10], [0, 10], ring[0]);
  const g = simplifyGeometry({ type: "Polygon", coordinates: [ring] }, 0.0003);
  assert.ok(g.type === "Polygon" && g.coordinates[0].length < 10 && g.coordinates[0].length >= 4);
});
