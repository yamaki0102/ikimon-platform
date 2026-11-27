import assert from "node:assert/strict";
import test from "node:test";
import { renderMapExplorerV2Document } from "../../src/ui/mapExplorerV2";

test("map client fetches area-polygons with bbox and zoom gating", () => {
  const html = renderMapExplorerV2Document({ lang: "ja", authenticated: false, basePath: "" });
  assert.match(html, /"areaPolygonsApi":"\/api\/v1\/map\/area-polygons"/);
  assert.match(html, /CFG\.areaPolygonsApi \+ '\?bbox='/);
  assert.match(html, /zoom='/);
  assert.match(html, /z < 13/);
  assert.match(html, /zv2-area-fill/);
  assert.match(html, /zv2-area-line/);
  assert.match(html, /areaTimer = setTimeout\(fetchAreaPolygons, 300\)/);
  assert.match(html, /abort\(\)/);
  const scripts = [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
  assert.ok(scripts.length > 0);
  for (const code of scripts) assert.doesNotThrow(() => new Function(code));
});
