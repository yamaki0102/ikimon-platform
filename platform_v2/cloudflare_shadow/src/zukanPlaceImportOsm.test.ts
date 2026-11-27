import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { loadCloudflarePlaceAtlasProfile } from "./placeAtlasProfileNative";
import { searchD1PublicPlaces } from "./placeRegistryD1";
import { handleMapPlacesBoundsApi } from "./zukanMapView";
import { classifyOsmPlaceKind, normalizePlaceSearchText as tsNormalize } from "../../src/services/placeDomain";
import {
  buildPlaces,
  classifyFeature,
  dedupeCandidates,
  douglasPeucker,
  elementPolygons,
  evaluateElement,
  haversineMeters,
  normalizePlaceSearchText,
  placeIdFor,
  polygonsAreaHa,
  renderImportSql,
  renderRollbackSql,
  simplifyPolygons,
  stitchRings,
  buildOverpassQuery,
  main as runImport,
  type OsmCandidate,
  type OsmElement,
} from "../scripts/import-places-osm.mjs";

const MIGRATIONS = "migrations/observations";
const BATCH = "osm-test-20261127";
const CTX = { batch: BATCH, locality: "静岡県浜松市", retrievedAt: "2026-11-27T01:14:58Z" };

function squareWay(id: number, lat: number, lng: number, sizeM: number, tags: Record<string, string>): OsmElement {
  const dLat = sizeM / 110_540;
  const dLng = sizeM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring = [
    { lat, lon: lng },
    { lat, lon: lng + dLng },
    { lat: lat + dLat, lon: lng + dLng },
    { lat: lat + dLat, lon: lng },
    { lat, lon: lng },
  ];
  return { type: "way", id, tags, geometry: ring };
}

const STATION = { lat: 34.703, lng: 137.735 };

function fixtureElements(): OsmElement[] {
  const castle: OsmElement = {
    type: "relation",
    id: 7001,
    tags: { name: "テスト城跡", historic: "castle", heritage: "2", type: "multipolygon", "name:en": "Test Castle Ruins", "name:ja-Hira": "てすとじょうあと", alt_name: "テスト城;てすとじょう" },
    members: [
      { type: "way", ref: 1, role: "outer", geometry: [{ lat: 34.704, lon: 137.736 }, { lat: 34.704, lon: 137.737 }, { lat: 34.705, lon: 137.737 }] },
      { type: "way", ref: 2, role: "outer", geometry: [{ lat: 34.704, lon: 137.736 }, { lat: 34.705, lon: 137.736 }, { lat: 34.705, lon: 137.737 }] },
      { type: "way", ref: 3, role: "inner", geometry: [{ lat: 34.7043, lon: 137.7363 }, { lat: 34.7043, lon: 137.7366 }, { lat: 34.7046, lon: 137.7366 }, { lat: 34.7046, lon: 137.7363 }, { lat: 34.7043, lon: 137.7363 }] },
    ],
  };
  return [
    squareWay(101, STATION.lat + 0.0005, STATION.lng + 0.0005, 200, { name: "テスト緑地公園", leisure: "park", "name:en": "Test Green Park", "name:ko": "테스트" }),
    squareWay(102, 34.71, 137.74, 5, { name: "豆公園", leisure: "park" }),
    squareWay(103, 34.72, 137.75, 200, { leisure: "park" }),
    squareWay(104, 34.72, 137.76, 200, { name: "私有公園", leisure: "park", access: "private" }),
    squareWay(105, 34.73, 137.76, 200, { name: "テスト小学校", leisure: "park", amenity: "school" }),
    squareWay(106, 34.74, 137.76, 200, { name: "テスト自然保護区", boundary: "protected_area" }),
    squareWay(107, 34.75, 137.76, 200, { name: "裏庭", leisure: "garden", "garden:type": "residential" }),
    squareWay(108, 34.76, 137.76, 200, { name: "遺跡の小さな史跡", historic: "ruins" }),
    squareWay(109, 34.77, 137.76, 200, { name: "ただの碑", historic: "memorial" }),
    castle,
    { type: "node", id: 8001, lat: 34.7031, lon: 137.7351, tags: { name: "O'Brien's 碑 \"石\"", historic: "monument", heritage: "2" } },
    { type: "node", id: 8002, lat: 34.7032, lon: 137.7352, tags: { name: "点の公園", leisure: "park" } },
    { type: "node", id: 8003, lat: 34.80, lon: 137.80, tags: { name: "点の道標", historic: "wayside_shrine" } },
    squareWay(110, STATION.lat + 0.0005, STATION.lng + 0.0005, 190, { name: "テスト緑地公園", leisure: "park" }),
    squareWay(101, STATION.lat + 0.0005, STATION.lng + 0.0005, 200, { name: "テスト緑地公園", leisure: "park" }),
    squareWay(111, STATION.lat + 0.02, STATION.lng, 200, { name: "テスト緑地公園", leisure: "park" }),
  ];
}

test("normalizePlaceSearchText matches the TypeScript normalizer", () => {
  for (const sample of ["常磐 公園", "Ｔｏｋｉｗａ　Park", "O'Brien's・碑", "「テスト」（公園）", "  ", "", "A-b_c/d"]) {
    assert.equal(normalizePlaceSearchText(sample), tsNormalize(sample), sample);
  }
});

test("classification: park, nature, heritage and place kinds agree with the TS classifier", () => {
  assert.deepEqual(classifyFeature({ leisure: "park" }), { category: "park", heritage: false, placeKind: "park" });
  assert.deepEqual(classifyFeature({ leisure: "garden" }), { category: "park", heritage: false, placeKind: "park" });
  assert.deepEqual(classifyFeature({ leisure: "nature_reserve" }), { category: "park", heritage: false, placeKind: "nature_area" });
  assert.deepEqual(classifyFeature({ boundary: "protected_area" }), { category: "nature", heritage: false, placeKind: "nature_area" });
  assert.deepEqual(classifyFeature({ boundary: "national_park" }), { category: "nature", heritage: false, placeKind: "nature_area" });
  assert.deepEqual(classifyFeature({ historic: "castle" }), { category: "heritage", heritage: true, placeKind: "other_named_area" });
  assert.deepEqual(classifyFeature({ heritage: "2", amenity: "place_of_worship" }), { category: "heritage", heritage: true, placeKind: "temple_shrine" });
  assert.deepEqual(classifyFeature({ heritage: "4", tourism: "museum" }), { category: "heritage", heritage: true, placeKind: "museum" });
  assert.deepEqual(classifyFeature({ leisure: "park", heritage: "3" }), { category: "park", heritage: true, placeKind: "park" });
  assert.equal(classifyFeature({ historic: "memorial" }), null);
  assert.equal(classifyFeature({ historic: "wayside_shrine" }), null);
  assert.equal(classifyFeature({ heritage: "no" }), null);
  assert.equal(classifyFeature({ shop: "mall" }), null);
  for (const tags of [{ leisure: "park" }, { leisure: "garden" }, { leisure: "nature_reserve" }, { boundary: "protected_area" }, { heritage: "2", amenity: "place_of_worship" }, { heritage: "4", tourism: "museum" }] as Array<Record<string, string>>) {
    const ours = classifyFeature(tags)!.placeKind;
    assert.equal(ours, classifyOsmPlaceKind({ ...tags, name: "x" }), JSON.stringify(tags));
  }
});

test("filters: names, restrictions, schools, small parks, points", () => {
  const reason = (el: OsmElement) => {
    const result = evaluateElement(el);
    return result.ok ? "ok" : result.reason;
  };
  const els = fixtureElements();
  const byId = (type: string, id: number) => els.find((el) => el.type === type && el.id === id)!;
  assert.equal(reason(byId("way", 101)), "ok");
  assert.equal(reason(byId("way", 102)), "too_small");
  assert.equal(reason(byId("way", 103)), "no_name");
  assert.equal(reason(byId("way", 104)), "restricted_access");
  assert.equal(reason(byId("way", 105)), "school");
  assert.equal(reason(byId("way", 106)), "ok");
  assert.equal(reason(byId("way", 107)), "private_garden");
  assert.equal(reason(byId("way", 108)), "ok");
  assert.equal(reason(byId("way", 109)), "not_target");
  assert.equal(reason(byId("relation", 7001)), "ok");
  assert.equal(reason(byId("node", 8001)), "ok");
  assert.equal(reason(byId("node", 8002)), "point_not_heritage");
  assert.equal(reason(byId("node", 8003)), "not_target");
  const node = (id: number, tags: Record<string, string>): OsmElement => ({ type: "node", id, lat: 34.7, lon: 137.7, tags });
  assert.equal(reason(node(8101, { name: "記念碑", historic: "monument" })), "point_clutter");
  assert.equal(reason(node(8102, { name: "記念碑", historic: "monument", heritage: "4" })), "ok");
  assert.equal(reason(node(8103, { name: "城", historic: "castle" })), "ok");
  assert.equal(reason(node(8104, { name: "貝塚", historic: "archaeological_site" })), "ok");
  assert.equal(reason(node(8105, { name: "城跡", historic: "ruins" })), "ok");
  assert.equal(reason(node(8106, { name: "誰かの墓", historic: "tomb" })), "tomb_no_heritage");
  assert.equal(reason(squareWay(8107, 34.7, 137.7, 20, { name: "慰霊殿", historic: "tomb" })), "tomb_no_heritage");
  assert.equal(reason(node(8108, { name: "古墳", historic: "tomb", heritage: "2" })), "ok");
  const tinyHeritage = squareWay(120, 34.7, 137.7, 5, { name: "小さな古墳", historic: "archaeological_site" });
  assert.equal(reason(tinyHeritage), "ok");
  const tinyHeritagePark = squareWay(121, 34.7, 137.7, 5, { name: "小さな史跡公園", leisure: "park", heritage: "2" });
  assert.equal(reason(tinyHeritagePark), "ok");
  const openWay: OsmElement = { type: "way", id: 122, tags: { name: "石垣", historic: "ruins" }, geometry: [{ lat: 34.7, lon: 137.7 }, { lat: 34.7001, lon: 137.7002 }] };
  const circle = evaluateElement(openWay);
  assert.ok(circle.ok && circle.candidate.isCircle && circle.candidate.polygons[0]![0]!.length === 25);
  const openPark: OsmElement = { ...openWay, id: 123, tags: { name: "線の公園", leisure: "park" } };
  assert.equal(reason(openPark), "no_polygon");
  const named = evaluateElement({ ...squareWay(124, 34.7, 137.7, 200, { "name:ja": "日本語だけ", leisure: "park" }) });
  assert.ok(named.ok && named.candidate.name === "日本語だけ");
});

test("names and aliases: canonical order, multilingual, reading, alternates, no canonical duplicate", () => {
  const result = evaluateElement(fixtureElements().find((el) => el.type === "relation")!);
  assert.ok(result.ok);
  const aliases = result.candidate.aliases;
  assert.equal(result.candidate.name, "テスト城跡");
  assert.ok(aliases.some((a) => a.alias === "Test Castle Ruins" && a.language === "en" && a.kind === "multilingual"));
  assert.ok(aliases.some((a) => a.alias === "てすとじょうあと" && a.language === "ja-Hira" && a.kind === "reading"));
  assert.ok(aliases.some((a) => a.alias === "テスト城" && a.language === null && a.kind === "alternate"));
  assert.ok(!aliases.some((a) => a.normalized === normalizePlaceSearchText("テスト城跡")));
  assert.equal(new Set(aliases.map((a) => a.normalized)).size, aliases.length);
});

test("relation rings are stitched from split outer ways and holes attach to the outer", () => {
  const rel = fixtureElements().find((el) => el.type === "relation")!;
  const polygons = elementPolygons(rel);
  assert.equal(polygons.length, 1);
  assert.equal(polygons[0]!.length, 2);
  const outer = polygons[0]![0]!;
  assert.deepEqual(outer[0], outer[outer.length - 1]);
  const full = polygonsAreaHa([[outer]]);
  const withHole = polygonsAreaHa(polygons);
  assert.ok(withHole < full && withHole > 0);
  assert.deepEqual(stitchRings([[[0, 0], [1, 0]], [[1, 1], [1, 0]], [[1, 1], [0, 0]]]).map((ring) => ring.length), [4]);
  assert.deepEqual(stitchRings([[[0, 0], [1, 0], [1, 1]]]), []);
});

test("simplification keeps closed rings, drops detail below tolerance and caps points at 500", () => {
  const circle = (n: number, r: number) => {
    const ring: number[][] = [];
    for (let i = 0; i < n; i += 1) ring.push([137.7 + (r * Math.cos((2 * Math.PI * i) / n)) / 91_000, 34.7 + (r * Math.sin((2 * Math.PI * i) / n)) / 110_540]);
    ring.push([...ring[0]!]);
    return ring;
  };
  const dense = circle(5000, 1000);
  const simplified = douglasPeucker(dense, 5);
  assert.ok(simplified.length < 120 && simplified.length > 8, String(simplified.length));
  assert.deepEqual(simplified[0], simplified[simplified.length - 1]);
  const noisy = circle(4000, 3000).map(([x, y], i) => [x! + (i % 2 === 0 ? 0.00004 : -0.00004), y!]);
  noisy[noisy.length - 1] = [...noisy[0]!];
  const capped = simplifyPolygons([[noisy]], { toleranceM: 0.5, maxPoints: 500 });
  const points = capped.polygons.reduce((sum, polygon) => sum + polygon.reduce((s, ring) => s + ring.length, 0), 0);
  assert.ok(points <= 500, String(points));
  assert.ok(capped.toleranceM > 0.5);
  for (const polygon of capped.polygons) for (const ring of polygon) assert.deepEqual(ring[0], ring[ring.length - 1]);
});

test("dedupe: same OSM id, same name within 200 m keeps the larger, far or other names stay, production rows are dropped", () => {
  const result = buildPlaces(fixtureElements());
  const names = result.places.map((place) => `${place.sourceId}:${place.name}`);
  assert.equal(result.dropped.duplicate_osm_id, 1);
  assert.equal(result.dropped.duplicate_name_near, 1);
  assert.ok(names.includes("way:101:テスト緑地公園"));
  assert.ok(!names.includes("way:110:テスト緑地公園"));
  assert.ok(names.includes("way:111:テスト緑地公園"));

  const withExisting = buildPlaces(fixtureElements(), {
    existing: { sourceIds: ["osm:way:106", "relation:7001"], places: [{ name: "テスト 緑地公園", lat: STATION.lat + 0.0006, lng: STATION.lng + 0.0006 }] },
  });
  const left = withExisting.places.map((place) => place.sourceId);
  assert.ok(!left.includes("way:106"));
  assert.ok(!left.includes("relation:7001"));
  assert.ok(!left.includes("way:101"));
  assert.ok(left.includes("way:111"));
  assert.equal(withExisting.dropped.already_in_production, 4);

  const a = { sourceId: "way:1", osmType: "way", osmId: 1, name: "同名", lat: 34.7, lng: 137.7, areaHa: 1, isCircle: false } as OsmCandidate;
  const b = { ...a, sourceId: "way:2", osmId: 2, areaHa: 3, lat: 34.7005 } as OsmCandidate;
  const kept = dedupeCandidates([a, b]).kept;
  assert.deepEqual(kept.map((c) => c.sourceId), ["way:2"]);
  assert.ok(haversineMeters(34.7, 137.7, 34.7005, 137.7) < 200);
});

test("place ids are stable hashes of the OSM reference", () => {
  assert.equal(placeIdFor("way", 125727939), placeIdFor("way", 125727939));
  assert.notEqual(placeIdFor("way", 1), placeIdFor("relation", 1));
  assert.match(placeIdFor("node", 5), /^plc_[0-9a-f]{16}$/u);
  const a = buildPlaces(fixtureElements()).places.map((place) => place.placeId);
  const b = buildPlaces(fixtureElements().reverse()).places.map((place) => place.placeId);
  assert.deepEqual([...a].sort(), [...b].sort());
});

test("overpass query covers parks, protected areas, heritage and historic types for the area", () => {
  const query = buildOverpassQuery({ kind: "area", name: "浜松市", adminLevel: "7" });
  assert.match(query, /\["name"="浜松市"\]/u);
  assert.match(query, /park\|garden\|nature_reserve/u);
  assert.match(query, /protected_area\|national_park/u);
  assert.match(query, /\["heritage"\]/u);
  assert.match(query, /castle\|archaeological_site\|ruins\|monument\|tomb/u);
  assert.match(query, /out geom;$/u);
  assert.match(buildOverpassQuery({ kind: "relation", relationId: "123" }), /area\(3600000123\)/u);
  assert.match(buildOverpassQuery({ kind: "bbox", bbox: [34.6, 137.6, 34.85, 137.91] }), /\(34\.6,137\.6,34\.85,137\.91\)/u);
});

test("SQL: escapes quotes, stays under the statement size limit, is deterministic, and rollback only flips the batch to private", () => {
  const { places } = buildPlaces(fixtureElements());
  const sql = renderImportSql(places, CTX);
  assert.equal(sql, renderImportSql(places, CTX));
  assert.match(sql, /O''Brien''s 碑 "石"/u);
  assert.doesNotMatch(sql, /O'Brien's/u);
  for (const statement of sql.split("\n")) assert.ok(Buffer.byteLength(statement) < 90_000, "statement too large");
  assert.doesNotMatch(sql, /\b(DELETE|DROP|UPDATE)\b/u);
  assert.equal((sql.match(/INSERT OR IGNORE INTO places /gu) ?? []).length, places.length);
  const rollback = renderRollbackSql(BATCH);
  assert.equal(rollback, `UPDATE places SET public_profile_status = 'private', updated_at = CURRENT_TIMESTAMP WHERE json_extract(metadata_json, '$.importBatch') = '${BATCH}' AND public_profile_status = 'published';\n`);
  assert.doesNotMatch(rollback, /DELETE|DROP/u);
});

function openDb(t: test.TestContext): DatabaseSync {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(`${MIGRATIONS}/${file}`, "utf8"));
  }
  return sqlite;
}

function d1(sqlite: DatabaseSync) {
  const statement = (query: string) => {
    let values: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        values = args;
        return stmt;
      },
      async run() {
        const result = sqlite.prepare(query).run(...(values as never[]));
        return { meta: { changes: Number(result.changes) } };
      },
      async all<T>() {
        return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
      },
      async first<T>() {
        return (sqlite.prepare(query).get(...(values as never[])) ?? null) as T | null;
      },
    };
    return stmt;
  };
  return {
    prepare: statement,
    async batch(statements: Array<{ run(): Promise<unknown> }>) {
      const results: unknown[] = [];
      for (const stmt of statements) results.push(await stmt.run());
      return results;
    },
  };
}

const count = (sqlite: DatabaseSync, table: string): number =>
  Number((sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);

const counts = (sqlite: DatabaseSync) =>
  ["places", "place_source_references", "place_boundaries", "place_policies", "place_aliases"].map((table) => count(sqlite, table));

function stubEnv(sqlite: DatabaseSync): Env {
  const core = { prepare() { const s: Record<string, unknown> = { bind: () => s, run: async () => ({ meta: {} }), all: async () => ({ results: [] }), first: async () => null }; return s; } };
  return { OBS_DB: d1(sqlite), CORE_DB: core, ENVIRONMENT: "test" } as unknown as Env;
}

test("local D1: import.sql applies, is idempotent, and the places show in map, search and page", async (t) => {
  const sqlite = openDb(t);
  const { places } = buildPlaces(fixtureElements());
  const sql = renderImportSql(places, CTX);
  sqlite.exec(sql);
  const first = counts(sqlite);
  assert.equal(first[0], places.length);
  assert.equal(first[1], places.length);
  assert.equal(first[2], places.length);
  assert.equal(first[3], places.length);
  sqlite.exec(sql);
  assert.deepEqual(counts(sqlite), first);

  const park = places.find((place) => place.sourceId === "way:101")!;
  const row = sqlite.prepare("SELECT * FROM places WHERE place_id = ?").get(park.placeId) as Record<string, string>;
  assert.equal(row.public_profile_status, "published");
  assert.equal(row.verification_status, "osm_imported");
  assert.equal(row.place_kind, "park");
  assert.equal(row.locality_label, "静岡県浜松市");
  assert.equal(JSON.parse(row.metadata_json!).importBatch, BATCH);
  const source = sqlite.prepare("SELECT * FROM place_source_references WHERE place_id = ?").get(park.placeId) as Record<string, string>;
  assert.equal(source.source_type, "osm");
  assert.equal(source.source_id, "way:101");
  assert.equal(source.source_url, "https://www.openstreetmap.org/way/101");
  assert.equal(source.verification_status, "source_verified");
  assert.equal(JSON.parse(source.source_payload_json!).attribution, "© OpenStreetMap contributors");
  const boundary = sqlite.prepare("SELECT * FROM place_boundaries WHERE place_id = ?").get(park.placeId) as Record<string, any>;
  assert.equal(boundary.is_primary, 1);
  assert.equal(boundary.validation_state, "valid");
  assert.ok(boundary.area_ha > 3.5 && boundary.area_ha < 4.5, String(boundary.area_ha));
  assert.ok(Math.abs((boundary.bbox_south + boundary.bbox_north) / 2 - park.lat) < 1e-5);

  const db = d1(sqlite) as unknown as Env["OBS_DB"];
  const map = await handleMapPlacesBoundsApi(new URL(`https://zukan.earth/api/v1/map/places?lat=${STATION.lat}&lng=${STATION.lng}&radiusKm=2`), db);
  const mapped = ((await map.json()) as { places: Array<{ placeId: string; name: string }> }).places.map((place) => place.name);
  assert.ok(mapped.includes("テスト緑地公園"));
  assert.ok(mapped.includes("テスト城跡"));
  assert.ok(mapped.includes("O'Brien's 碑 \"石\""));
  assert.ok(!mapped.includes("豆公園"));

  const search = await searchD1PublicPlaces({ db: db as never, query: park.placeId, limit: 2 });
  const hit = search.results.find((candidate) => candidate.canonicalPlaceId === park.placeId);
  assert.ok(hit);
  assert.equal(hit.osmSourceId, "way:101");
  const byAlias = await searchD1PublicPlaces({ db: db as never, query: "Test Green Park", limit: 5 });
  assert.ok(byAlias.results.some((candidate) => candidate.canonicalPlaceId === park.placeId));

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: db as never,
    placeRef: { kind: "osm_area", entityKey: "osm:way:101", osmType: "way", osmId: 101 },
    generatedAt: "2026-11-27T00:00:00Z",
    fetchFn: async () => {
      throw new Error("no network");
    },
  });
  assert.ok(profile);
  assert.equal(profile.place.canonicalPlaceId, park.placeId);
  assert.equal(profile.place.name, "テスト緑地公園");
});

test("local D1: worker serves imported way, relation and node places with the OSM attribution; owner-registered stay without it; rollback hides", async (t) => {
  const { worker } = await import("./index");
  const sqlite = openDb(t);
  const { places } = buildPlaces(fixtureElements());
  sqlite.exec(renderImportSql(places, CTX));
  const env = stubEnv(sqlite);
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("no network");
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = realFetch;
  });
  const idOf = (sourceId: string) => places.find((place) => place.sourceId === sourceId)!.placeId;
  for (const [sourceId, name] of [["way:101", "テスト緑地公園"], ["relation:7001", "テスト城跡"], ["node:8001", "O&#39;Brien&#39;s 碑 &quot;石&quot;"]] as const) {
    const page = await worker.fetch(new Request(`https://zukan.earth/ja/places/${idOf(sourceId)}`), env);
    assert.equal(page.status, 200, sourceId);
    const html = await page.text();
    assert.ok(html.includes(name), `${sourceId} name`);
    assert.match(html, /data-osm-attribution/u, sourceId);
    assert.match(html, /© OpenStreetMap contributors/u, sourceId);
    assert.match(html, /https:\/\/www\.openstreetmap\.org\/copyright/u, sourceId);
  }
  sqlite.exec(`INSERT INTO places (place_id, canonical_name, canonical_name_normalized, public_profile_status, metadata_json) VALUES ('plc_owner0000000001', '登録公園', '登録公園', 'published', '{}');
    INSERT INTO place_source_references (source_reference_id, place_id, source_type, source_id, source_confidence, verification_status, precedence_rank) VALUES ('src_o1', 'plc_owner0000000001', 'owner_registered', 'plc_owner0000000001', 0.6, 'source_verified', 50);
    INSERT INTO place_boundaries (boundary_id, place_id, geometry_kind, boundary_geojson, source_reference_id, source_type, is_primary, validation_state, bbox_west, bbox_south, bbox_east, bbox_north)
      VALUES ('bnd_o1', 'plc_owner0000000001', 'Polygon', '{"type":"Polygon","coordinates":[[[137.8,34.8],[137.801,34.8],[137.801,34.801],[137.8,34.801],[137.8,34.8]]]}', 'src_o1', 'owner_registered', 1, 'valid', 137.8, 34.8, 137.801, 34.801);
    INSERT INTO place_policies (place_policy_id, place_id, place_visibility) VALUES ('pol_o1', 'plc_owner0000000001', 'public');`);
  const owner = await worker.fetch(new Request("https://zukan.earth/ja/places/plc_owner0000000001"), env);
  assert.equal(owner.status, 200);
  assert.doesNotMatch(await owner.text(), /data-osm-attribution/u);

  sqlite.exec(renderRollbackSql(BATCH));
  assert.equal(count(sqlite, "places"), places.length + 1);
  const hidden = await worker.fetch(new Request(`https://zukan.earth/ja/places/${idOf("way:101")}`), env);
  assert.equal(hidden.status, 404);
  const stillOwner = await worker.fetch(new Request("https://zukan.earth/ja/places/plc_owner0000000001"), env);
  assert.equal(stillOwner.status, 200);
  const map = await handleMapPlacesBoundsApi(new URL(`https://zukan.earth/api/v1/map/places?lat=${STATION.lat}&lng=${STATION.lng}&radiusKm=2`), env.OBS_DB);
  assert.deepEqual(((await map.json()) as { places: unknown[] }).places, []);
});

test("local D1: a production place that already owns the OSM source id leaves no orphan rows", (t) => {
  const sqlite = openDb(t);
  sqlite.exec(`INSERT INTO places (place_id, canonical_name, canonical_name_normalized, public_profile_status) VALUES ('plc_seed', '別名の公園', '別名の公園', 'published');
    INSERT INTO place_source_references (source_reference_id, place_id, source_type, source_id, verification_status) VALUES ('src_seed', 'plc_seed', 'osm', 'way:101', 'source_verified');`);
  const { places } = buildPlaces(fixtureElements());
  sqlite.exec(renderImportSql(places, CTX));
  assert.equal(count(sqlite, "places"), places.length);
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) AS n FROM places WHERE place_id = ?").get(places.find((p) => p.sourceId === "way:101")!.placeId) as { n: number }).n), 0);
  assert.equal(count(sqlite, "place_boundaries"), places.length - 1);
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) AS n FROM place_boundaries WHERE place_id NOT IN (SELECT place_id FROM places)").get() as { n: number }).n), 0);
  assert.equal(Number((sqlite.prepare("SELECT COUNT(*) AS n FROM place_aliases WHERE place_id NOT IN (SELECT place_id FROM places)").get() as { n: number }).n), 0);
});

test("CLI main writes summary, places.jsonl, import.sql and rollback.sql from a cached Overpass response without a network call", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "osm-import-"));
  writeFileSync(join(dir, "overpass-raw.json"), JSON.stringify({ osm3s: { timestamp_osm_base: "2026-11-27T01:14:58Z" }, elements: fixtureElements() }));
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("network_must_not_be_used");
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = realFetch;
  });
  const summary = await runImport(["--area", "hamamatsu", "--out", dir, "--dry-run"]);
  assert.ok(summary.imported >= 5);
  const written = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8")) as { batch: string; byCategory: Record<string, { count: number; samples: string[] }> };
  assert.equal(written.batch, "osm-hamamatsu-20261127");
  assert.ok(written.byCategory.park!.count >= 1 && written.byCategory.heritage!.count >= 1 && written.byCategory.nature!.count >= 1);
  assert.equal(readFileSync(join(dir, "places.jsonl"), "utf8").trim().split("\n").length, summary.imported);
  assert.match(readFileSync(join(dir, "import.sql"), "utf8"), /^-- importBatch=osm-hamamatsu-20261127 /u);
  assert.match(readFileSync(join(dir, "rollback.sql"), "utf8"), /osm-hamamatsu-20261127/u);
});

test("optional: a real import.sql from OSM_IMPORT_SQL_FILE applies cleanly twice and every place resolves", { skip: !process.env.OSM_IMPORT_SQL_FILE }, async (t) => {
  const sqlite = openDb(t);
  const sql = readFileSync(process.env.OSM_IMPORT_SQL_FILE!, "utf8");
  sqlite.exec(sql);
  const first = counts(sqlite);
  sqlite.exec(sql);
  assert.deepEqual(counts(sqlite), first);
  assert.equal(first[0], first[1]);
  assert.equal(first[0], first[2]);
  assert.equal(first[0], first[3]);
  const orphan = sqlite.prepare("SELECT COUNT(*) AS n FROM place_boundaries WHERE place_id NOT IN (SELECT place_id FROM places)").get() as { n: number };
  assert.equal(Number(orphan.n), 0);
  const db = d1(sqlite) as unknown as Env["OBS_DB"];
  const lat = Number(process.env.OSM_PROBE_LAT ?? 34.703);
  const lng = Number(process.env.OSM_PROBE_LNG ?? 137.735);
  const map = await handleMapPlacesBoundsApi(new URL(`https://zukan.earth/api/v1/map/places?lat=${lat}&lng=${lng}&radiusKm=3`), db);
  const near = ((await map.json()) as { places: Array<{ placeId: string; name: string }> }).places;
  assert.ok(near.length > 0, "map query near Hamamatsu station returned nothing");
  const { worker } = await import("./index");
  const env = stubEnv(sqlite);
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("no network");
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = realFetch;
  });
  const sample = [near[0]!, ...(sqlite.prepare("SELECT place_id AS placeId FROM places WHERE place_id IN (SELECT place_id FROM place_source_references WHERE source_type = 'osm_node') LIMIT 1").all() as Array<{ placeId: string }>)];
  for (const item of sample) {
    const page = await worker.fetch(new Request(`https://zukan.earth/ja/places/${item.placeId}`), env);
    assert.equal(page.status, 200, item.placeId);
    assert.match(await page.text(), /data-osm-attribution/u);
  }
  console.log(JSON.stringify({ placesInSql: first[0], nearStation: near.length, sampleNames: near.slice(0, 5).map((p) => p.name) }));
});
