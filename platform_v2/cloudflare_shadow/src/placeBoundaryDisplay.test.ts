import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadPlaceBoundaries, parsePlaceBoundaryGeometry, renderPlaceBoundarySection } from "./placeBoundary";
import { handleMapPlacesBoundsApi } from "./zukanMapView";
import { renderGlobalPlaceDetailPage } from "./placeDetailPage";

const sql = readFileSync(new URL("../migrations/observations/0062_aikan_lenri_verified_boundary.sql", import.meta.url), "utf8");
const geometryJson = /'(\{"type":"Polygon".*?\]\})'/s.exec(sql)![1];
const PLACE = "ikimon:aikan:renri-no-ki";

function fakeDb(rows: Array<Record<string, unknown>>) {
  return {
    prepare(query: string) {
      return {
        bind(..._args: unknown[]) {
          return {
            all: async () => ({ results: /area_polygon_readmodel/.test(query) ? rows : [] }),
            first: async () => null,
          };
        },
      };
    },
  } as never;
}

test("helper parses the 0062 polygon", async () => {
  const g = parsePlaceBoundaryGeometry(geometryJson);
  assert.equal(g?.type, "Polygon");
  assert.equal(g?.coordinates[0].length, 19);
  assert.equal(parsePlaceBoundaryGeometry("{bad"), null);
  const map = await loadPlaceBoundaries(fakeDb([{ field_id: "7cb246a5", entity_key: PLACE, geometry_json: geometryJson }]), [PLACE]);
  assert.equal(map.get(PLACE)?.type, "Polygon");
  assert.equal((await loadPlaceBoundaries(fakeDb([]), [PLACE])).size, 0);
});

test("canonical place_boundaries row is returned and rendered; readmodel fallback remains", async () => {
  const db = {
    prepare(query: string) {
      const rows = /FROM place_boundaries/.test(query)
        ? [{ place_id: "plc_x", boundary_geojson: geometryJson }]
        : /area_polygon_readmodel/.test(query)
          ? [{ field_id: "f", entity_key: PLACE, geometry_json: geometryJson }]
          : [];
      const stmt: any = { bind: () => stmt, all: async () => ({ results: rows }) };
      return stmt;
    },
  } as never;
  const map = await loadPlaceBoundaries(db, ["plc_x", PLACE]);
  assert.equal(map.get("plc_x")?.type, "Polygon");
  assert.equal(map.get(PLACE)?.type, "Polygon");
  assert.match(renderPlaceBoundarySection(map.get("plc_x"), "ja", "x"), /data-place-boundary/);
});

test("section renders svg outline only with polygon", () => {
  const g = parsePlaceBoundaryGeometry(geometryJson);
  const html = renderPlaceBoundarySection(g, "ja", "連理の木の下で");
  assert.match(html, /data-place-boundary/);
  assert.match(html, /この場所の範囲/);
  assert.match(html, /stroke="#143f2e" stroke-width="2"/);
  assert.equal(renderPlaceBoundarySection(null, "ja", "x"), "");
});

test("map data includes boundary for a place with a row", async () => {
  const db = {
    prepare(query: string) {
      const rows = /area_polygon_readmodel/.test(query)
        ? [{ field_id: "7cb246a5", entity_key: PLACE, geometry_json: geometryJson }]
        : /FROM places p/i.test(query)
          ? [{ place_id: PLACE, name: "連理の木の下で", lat: 34.8144, lng: 137.7332, place_kind: "park" }]
          : [];
      const stmt: any = { bind: () => stmt, all: async () => ({ results: rows }), first: async () => null, run: async () => ({}) };
      return stmt;
    },
  } as never;
  const res = await handleMapPlacesBoundsApi(new URL("https://x.test/api/v1/map/places?v2=1&minLat=34.8&maxLat=34.82&minLng=137.72&maxLng=137.74"), db);
  const body = (await res.json()) as { places: Array<{ placeId: string; boundary?: { type: string } }> };
  const p = body.places.find((x) => x.placeId === PLACE);
  assert.ok(p, JSON.stringify(body));
  assert.equal(p.boundary?.type, "Polygon");
});

test("place page includes boundary section only when polygon present", () => {
  const source = readFileSync(new URL("./placeDetailPage.ts", import.meta.url), "utf8");
  assert.match(source, /renderPlaceBoundarySection\(input\.boundary/);
  const map = readFileSync(new URL("../../src/ui/mapExplorerV2.ts", import.meta.url), "utf8");
  assert.match(map, /zv2-bnd-line/);
  assert.equal(typeof renderGlobalPlaceDetailPage, "function");
});
