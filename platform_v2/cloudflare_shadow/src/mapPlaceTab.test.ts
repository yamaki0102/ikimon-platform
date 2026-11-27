import assert from "node:assert/strict";
import test from "node:test";
import { renderMapExplorerV2Document } from "../../src/ui/mapExplorerV2";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";

const base = { lang: "ja" as const, authenticated: true, basePath: "" };

function clientScript(html: string): string {
  const parts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? "");
  return parts[parts.length - 1] ?? "";
}

function extractFn(script: string, name: string): string {
  const start = script.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  let depth = 0;
  let i = script.indexOf("{", start);
  for (; i < script.length; i++) {
    if (script[i] === "{") depth++;
    else if (script[i] === "}" && --depth === 0) break;
  }
  return script.slice(start, i + 1);
}

test("flag registered and off by default", () => {
  const f = PROTOTYPE_FLAGS.find((x) => x.flag === "MAP_PLACE_TAB_ENABLED");
  assert.ok(f);
  
  const off = renderMapExplorerV2Document(base);
  assert.ok(!off.includes('data-place-tab="1"'));
  assert.ok(off.includes('"placeTab":false'));
});

test("place tab markup", () => {
  const html = renderMapExplorerV2Document({ ...base, placeTab: true });
  assert.ok(html.includes('class="zv2-app zv2-pt"'));
  assert.ok(html.includes('id="zv2-plist"'));
  assert.ok(html.includes('"placeTab":true'));
  assert.ok(html.indexOf('class="zv2-stage"') < html.indexOf('id="zv2-plist"'));
  assert.ok(html.includes("zv2-zero-label"));
  assert.ok(html.includes("zv2-near-label"));
});

test("list rows: link, distance order, no duplicate photos, cap", () => {
  const script = clientScript(renderMapExplorerV2Document({ ...base, placeTab: true }));
  const src = ["t", "recLabel", "fmtDist", "renderPlaceTabList"].map((n) => extractFn(script, n)).join("\n");
  const CFG = { lang: "ja", placeTab: true, defaultCenter: [137.7, 34.7] };
  const EN = CFG.lang !== "ja";
  const plistEl = { innerHTML: "" };
  const state = { userCenter: { lat: 34.7, lng: 137.7 }, map: null as null };
  const places = Array.from({ length: 30 }, (_, i) => ({
    placeId: `p${i}`,
    name: `場所${i}`,
    lat: 34.7 + i * 0.001,
    lng: 137.7,
    recordCount: i % 5 === 0 ? 0 : i + 1,
    placeKind: "park",
    photoUrl: i % 2 === 0 ? "https://x/same.jpg" : `https://x/${i}.jpg`,
  }));
  const run = new Function(
    "EN", "plistEl", "state", "CFG", "esc", "kindLabel", "placeHref", "distMeters", "rcOf", "renderListHtml", "places",
    `${src}\nrenderPlaceTabList(places.filter((p) => p.recordCount > 0).reverse(), places.filter((p) => p.recordCount === 0));`,
  );
  const dm = (aLat: number, aLng: number, bLat: number, bLng: number) => Math.hypot((aLat - bLat) * 111320, (aLng - bLng) * 91000);
  run(EN, plistEl, state, CFG, (v: unknown) => String(v), () => "公園", (id: string) => `/ja/places/${id}`, dm, (p: { recordCount: number }) => p.recordCount, () => "EMPTY", places);
  const html = plistEl.innerHTML;
  assert.equal((html.match(/data-zv2-place-row=/g) ?? []).length, 20);
  assert.ok(html.indexOf('href="/ja/places/p0"') < html.indexOf('href="/ja/places/p1"'));
  assert.equal((html.match(/same\.jpg/g) ?? []).length, 1);
  const srcs = [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(srcs).size, srcs.length);
  assert.ok(html.includes("ここから 0m"));
  assert.ok(html.indexOf("記録はまだありません") >= 0 && html.indexOf("記録はまだありません") < html.indexOf("記録 2件"));
  assert.ok(html.indexOf('href="/ja/places/p0"') >= 0);
  assert.ok(html.includes("zv2-thumb-ph"));
});

test("no request loop from list rendering", () => {
  const script = clientScript(renderMapExplorerV2Document({ ...base, placeTab: true }));
  assert.ok(!extractFn(script, "renderPlaceTabList").includes("fetch"));
  assert.ok(!extractFn(script, "renderUI").includes("fetchPlaces"));
  assert.ok(script.includes("state.lastMoveFetchKey"));
  const fetchCalls = script.match(/fetchPlaces\(\)/g) ?? [];
  assert.ok(fetchCalls.length <= 4);
});
