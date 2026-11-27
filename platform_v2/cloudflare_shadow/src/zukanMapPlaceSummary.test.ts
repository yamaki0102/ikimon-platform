import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { renderMapExplorerV2Document } from "../../src/ui/mapExplorerV2";
import { handleMapPlaceSummaryApi, summarizeMapPlaceCandidates } from "./zukanMapPlaceSummary";

function sqliteObsDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async all<T>() {
          return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
        },
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
  } as unknown as Env["OBS_DB"];
}

function setup(t: test.TestContext, importRows: number) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT, public_profile_status TEXT, superseded_by_place_id TEXT, place_kind TEXT, locality_label TEXT);
    CREATE TABLE place_boundaries (boundary_id TEXT, place_id TEXT, is_primary INTEGER, valid_to TEXT, superseded_by_boundary_id TEXT, bbox_west REAL, bbox_south REAL, bbox_east REAL, bbox_north REAL, boundary_geojson TEXT);
    CREATE TABLE record_place_memberships (record_id TEXT, place_id TEXT, membership_state TEXT, public_precision TEXT, removed_at TEXT);
    CREATE TABLE production_import_visits (visit_id TEXT PRIMARY KEY, observed_at TEXT, public_visibility TEXT, owner_user_id TEXT);
    CREATE TABLE production_import_occurrences (occurrence_id TEXT PRIMARY KEY, visit_id TEXT, scientific_name TEXT, vernacular_name TEXT, created_at TEXT, taxon_rank TEXT);
    CREATE TABLE observation_data_rights (visit_id TEXT, withdrawal_status TEXT, record_consent TEXT);
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, observed_at TEXT, taxon_label TEXT, exact_lat REAL, exact_lng REAL, visibility TEXT, emergency_hidden INTEGER DEFAULT 0, owner_user_id TEXT);
    CREATE TABLE asset_ledger (observation_id TEXT, public_derivative_key TEXT, processing_state TEXT, public_derivative_verified_at TEXT, public_derivative_metadata_json TEXT, exif_scrub_state TEXT, public_ready_at TEXT, mime TEXT, width INTEGER, height INTEGER, bytes INTEGER);
    INSERT INTO places VALUES ('p1','連理の木','published',NULL,'park','浜松市中央区');
    INSERT INTO places VALUES ('p-draft','x','draft',NULL,'park',NULL);
    INSERT INTO place_boundaries VALUES ('b1','p1',1,NULL,NULL,137.0,34.0,137.1,34.1,NULL);
  `);
  const mem = sqlite.prepare("INSERT INTO record_place_memberships VALUES (?, 'p1', 'confirmed', 'place', NULL)");
  const vis = sqlite.prepare("INSERT INTO production_import_visits (visit_id, observed_at, public_visibility) VALUES (?, ?, ?)");
  const occ = sqlite.prepare("INSERT INTO production_import_occurrences (occurrence_id, visit_id, scientific_name, vernacular_name, created_at) VALUES (?, ?, NULL, ?, ?)");
  const rights = sqlite.prepare("INSERT INTO observation_data_rights VALUES (?, ?, 'public_summary')");
  const asset = sqlite.prepare("INSERT INTO asset_ledger VALUES (?, ?, 'uploaded', '2026-01-01', '{}', 'scrubbed', '2026-01-01', 'image/jpeg', 800, 600, 90000)");
  const names = ["スズメ", "メジロ", "名前待ち", "スズメ", "ヒヨドリ", "ツバメ", "カワセミ"];
  for (let i = 0; i < importRows; i++) {
    const id = `v${i}`;
    mem.run(id);
    vis.run(id, `2026-03-${String(10 + i).padStart(2, "0")}T00:00:00Z`, "public");
    occ.run(`o${i}`, id, names[i % names.length], "2026-03-01");
    rights.run(id, "active");
    asset.run(id, i === 1 ? "obs/o0.jpg" : `obs/o${i}.jpg`);
  }
  mem.run("v-priv");
  vis.run("v-priv", "2026-04-30T00:00:00Z", "private");
  occ.run("o-priv", "v-priv", "秘密の鳥", "2026-04-30");
  rights.run("v-priv", "active");
  asset.run("v-priv", "obs/secret.jpg");
  mem.run("v-wd");
  vis.run("v-wd", "2026-04-29T00:00:00Z", "public");
  occ.run("o-wd", "v-wd", "撤回の鳥", "2026-04-29");
  rights.run("v-wd", "withdrawn");
  sqlite.exec(`
    INSERT INTO observations (observation_id, observed_at, taxon_label, exact_lat, exact_lng, visibility, emergency_hidden) VALUES ('n1','2026-05-01T00:00:00Z','オオルリ',34.05,137.05,'public',0);
    INSERT INTO observations (observation_id, observed_at, taxon_label, exact_lat, exact_lng, visibility, emergency_hidden) VALUES ('n2','2026-05-02T00:00:00Z','隠し',34.05,137.05,'private',0);
    INSERT INTO observation_data_rights VALUES ('n1','active','public_summary');
    INSERT INTO observation_data_rights VALUES ('n2','active','public_summary');
    INSERT INTO asset_ledger VALUES ('n1','obs/n1.jpg','uploaded','2026-01-01','{}','scrubbed','2026-01-01','image/jpeg',800,600,90000);
  `);
  return sqliteObsDb(sqlite);
}

type Body = {
  ok: boolean;
  summary: {
    kind: string;
    locality: string;
    recordCount: number | null;
    hidden: boolean;
    speciesCount: number | null;
    lastObservedAt: string | null;
    recentPhotos: Array<{ observationId: string; photoUrl: string }>;
    recentTaxa: string[];
  };
};

test("summary returns deduped photos and taxa, excludes private and withdrawn", async (t) => {
  const db = setup(t, 6);
  const res = await handleMapPlaceSummaryApi(db, "p1");
  assert.equal(res.status, 200);
  const { summary } = (await res.json()) as Body;
  assert.equal(summary.kind, "park");
  assert.equal(summary.locality, "浜松市中央区");
  assert.equal(summary.recordCount, 7);
  assert.equal(summary.hidden, false);
  assert.equal(summary.recentPhotos.length, 4);
  assert.equal(new Set(summary.recentPhotos.map((p) => p.photoUrl)).size, 4);
  assert.equal(new Set(summary.recentPhotos.map((p) => p.observationId)).size, 4);
  assert.equal(summary.recentPhotos[0]?.photoUrl, "/obs/n1.jpg");
  const raw = JSON.stringify(summary);
  for (const leak of ["secret", "秘密の鳥", "撤回の鳥", "隠し"]) assert.ok(!raw.includes(leak), leak);
  assert.ok(!summary.recentTaxa.includes("名前待ち"));
  assert.equal(new Set(summary.recentTaxa).size, summary.recentTaxa.length);
  assert.ok(summary.recentTaxa.length <= 5 && summary.recentTaxa[0] === "オオルリ");
  assert.equal(summary.speciesCount, 5);
  assert.equal(summary.lastObservedAt, "2026-05-01T00:00:00Z");
});

test("summary hides details below the public record threshold and 404s for unpublished", async (t) => {
  const db = setup(t, 0);
  const res = await handleMapPlaceSummaryApi(db, "p1");
  const { summary } = (await res.json()) as Body;
  assert.equal(summary.hidden, true);
  assert.equal(summary.recordCount, null);
  assert.deepEqual(summary.recentPhotos, []);
  assert.deepEqual(summary.recentTaxa, []);
  assert.equal((await handleMapPlaceSummaryApi(db, "p-draft")).status, 404);
  assert.equal((await handleMapPlaceSummaryApi(db, "nope")).status, 404);
});

test("summarize dedupes same photo url across different records", () => {
  const cands = [
    { id: "a", ids: ["a"], label: "スズメ", observedAt: "3" },
    { id: "b", ids: ["b"], label: "スズメ", observedAt: "2" },
    { id: "c", ids: ["c"], label: "名前なし", observedAt: "1" },
  ];
  const s = summarizeMapPlaceCandidates(cands, new Map([["a", "/x.jpg"], ["b", "/x.jpg"], ["c", "/y.jpg"]]), 3);
  assert.deepEqual(s.recentPhotos.map((p) => p.observationId), ["a", "c"]);
  assert.deepEqual(s.recentTaxa, ["スズメ"]);
  assert.equal(s.speciesCount, 1);
});

test("map card markup carries summary sections for both languages", () => {
  for (const lang of ["ja", "en"] as const) {
    const html = renderMapExplorerV2Document({ lang, authenticated: false, displayName: "", basePath: "", placeTab: false });
    assert.match(html, /placeSummaryApi/);
    assert.match(html, /\/api\/v1\/map\/places\/__ID__\/summary/);
    for (const k of ["zv2-sstrip", "zv2-schips", "zv2-skel", "loadPlaceSummary", "relDays"]) assert.ok(html.includes(k), k);
  }
  assert.ok(renderMapExplorerV2Document({ lang: "ja", authenticated: false, displayName: "", basePath: "", placeTab: false }).includes("最後の記録"));
});

test("summary count equals list count and zero species is null", async (t) => {
  const db = setup(t, 6);
  const { summary } = (await (await handleMapPlaceSummaryApi(db, "p1")).json()) as Body;
  const { loadBulkV2PlaceStats } = await import("./zukanMapView");
  const stats = await loadBulkV2PlaceStats(db, ["p1"], null);
  assert.equal(summary.recordCount, stats.get("p1")?.recordCount);
  const s0 = summarizeMapPlaceCandidates([{ id: "a", ids: ["a"], label: "名前なし", observedAt: "1" }], new Map(), 3);
  assert.equal(s0.speciesCount, null);
});

test("card renders kind as words and omits zero species", () => {
  const html = renderMapExplorerV2Document({ lang: "ja", authenticated: false, displayName: "", basePath: "", placeTab: false });
  assert.ok(html.includes("nature_area: '自然エリア'"));
  assert.ok(html.includes("spN && spN > 0"));
});
