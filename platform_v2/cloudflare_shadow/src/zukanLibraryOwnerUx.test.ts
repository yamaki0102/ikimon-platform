import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { loadOwnerAreaLabels, ownerAreaCellKey, buildOwnerAreaBackfillSql, OWNER_AREA_BACKFILL_SQL } from "./ownerAreaLabel";
import { renderLibraryGroup, renderLibraryGroups, ZUKAN_LIBRARY_CSS } from "./zukanLibraryBlocks";
import { loadUserLibraryData, type TopLibraryGroup } from "./zukanTopPage";

function d1(sqlite: DatabaseSync) {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) { values = args; return stmt; },
        async all<T>() { return { results: sqlite.prepare(query).all(...(values as never[])) as T[] }; },
        async first<T>() { return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null; },
        async run() { sqlite.prepare(query).run(...(values as never[])); return { success: true }; },
      };
      return stmt;
    },
  };
}

const OWNER = "owner-1";

function fixture(t: test.TestContext) {
  const obs = new DatabaseSync(":memory:");
  const core = new DatabaseSync(":memory:");
  t.after(() => { obs.close(); core.close(); });
  obs.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, observed_at TEXT NOT NULL, taxon_label TEXT, note TEXT, public_area_label TEXT, visibility TEXT DEFAULT 'private', emergency_hidden INTEGER NOT NULL DEFAULT 0, exact_lat REAL, exact_lng REAL);
    CREATE TABLE owner_area_label_cache (observation_id TEXT PRIMARY KEY, label TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE asset_ledger (observation_id TEXT, processing_state TEXT, public_derivative_key TEXT, public_derivative_verified_at TEXT, public_derivative_metadata_json TEXT, exif_scrub_state TEXT, public_ready_at TEXT, uploaded_at TEXT, mime TEXT, width INTEGER, height INTEGER, bytes INTEGER);
    CREATE TABLE observation_ai_review_targets (occurrence_id TEXT, ai_assessment_status TEXT, candidate_vernacular_name TEXT, candidate_scientific_name TEXT, ai_recommended_taxon_name TEXT);
    CREATE TABLE observation_reassessment_requests (observation_id TEXT, request_kind TEXT, request_state TEXT, updated_at TEXT);
    CREATE TABLE readmodel_public_observations (observation_id TEXT, public_area_label TEXT);
    CREATE TABLE civic_observation_contexts (visit_id TEXT, field_id TEXT);
    CREATE TABLE places (place_id TEXT, canonical_name TEXT, public_profile_status TEXT);
  `);
  const ins = obs.prepare("INSERT INTO observations (observation_id, owner_user_id, observed_at, taxon_label, public_area_label, exact_lat, exact_lng) VALUES (?, ?, ?, ?, ?, ?, ?)");
  ins.run("cached", OWNER, "2026-10-03T08:00:00.000Z", "未同定", null, 34.7123456, 137.7123456);
  ins.run("located-unresolved", OWNER, "2026-10-02T08:00:00.000Z", "未同定", null, 34.7, 137.7);
  ins.run("no-location", OWNER, "2026-10-01T08:00:00.000Z", "未同定", null, null, null);
  ins.run("no-photo", OWNER, "2026-09-04T23:27:48.194Z", "未同定", null, 34.7, 137.7);
  ins.run("labeled", OWNER, "2026-08-01T08:00:00.000Z", "スズメ", "浜松市", 34.7, 137.7);
  obs.prepare("INSERT INTO owner_area_label_cache (observation_id, label, updated_at) VALUES ('cached', '磐田市', '2026-11-26')").run();
  const photo = obs.prepare("INSERT INTO asset_ledger (observation_id, processing_state, public_derivative_key, public_derivative_verified_at, exif_scrub_state, public_ready_at, uploaded_at, mime) VALUES (?, 'uploaded', ?, '2026-01-01', 'scrubbed', '2026-01-01', '2026-01-01', 'image/webp')");
  for (const id of ["cached", "located-unresolved", "no-location", "labeled"]) photo.run(id, `derived/${id}/display.webp`);
  obs.prepare("INSERT INTO asset_ledger (observation_id, processing_state, public_derivative_key, exif_scrub_state, mime) VALUES ('no-photo', 'uploaded', NULL, 'failed', 'image/png')").run();
  return { env: { OBS_DB: d1(obs), CORE_DB: d1(core) } as unknown as Env };
}

test("owner library: private records get a coarse area from the cache, never coordinates", async (t) => {
  const { env } = fixture(t);
  const { groups } = await loadUserLibraryData(env, OWNER);
  const byId = (id: string) => groups.find((g) => g.photos.some((p) => p.observationId === id))!;
  assert.equal(byId("cached").areaLabel, "磐田市");
  assert.match(byId("cached").headerLabel, /・磐田市$/);
  assert.equal(byId("labeled").areaLabel, "浜松市");
  assert.match(byId("no-location").headerLabel, /・場所なし$/);
  assert.equal(byId("located-unresolved").areaLabel, null);
  assert.doesNotMatch(byId("located-unresolved").headerLabel, /場所なし|身近/);
  const html = renderLibraryGroups(groups, { prefix: "/ja", isEn: false, mode: "library" });
  assert.doesNotMatch(html.replace(/<[^>]+>/g, ""), /身近な場所/);
  assert.doesNotMatch(html, /34\.7|137\.7/);
  assert.match(html, /磐田市/);
  assert.match(html, /場所なし/);
});

test("owner library: groups without a displayable photo are hidden", async (t) => {
  const { env } = fixture(t);
  const { groups } = await loadUserLibraryData(env, OWNER);
  const all = groups.flatMap((g) => g.photos.map((p) => p.observationId));
  assert.ok(!all.includes("no-photo"));
  assert.equal(all.length, 4);
  const html = renderLibraryGroups(groups, { prefix: "/ja", isEn: false, mode: "library" });
  assert.doesNotMatch(html, /zk-fallback/);
  const empty: TopLibraryGroup = { groupKey: "k", headerLabel: "9月5日", placeName: "x", published: false, photos: [{ observationId: "no-photo", photoUrl: null, title: "未同定", observedAt: "2026-09-04T23:27:48.194Z" }] };
  assert.doesNotMatch(renderLibraryGroups([empty], { prefix: "/ja", isEn: false, mode: "library" }), /data-library-group/);
});

test("owner library: private chip says 自分のみ and actions are buttons", () => {
  const group: TopLibraryGroup = { groupKey: "2026-10-03__p", headerLabel: "10月3日（土）・磐田市", placeName: "磐田市", published: false, photos: [{ observationId: "a", photoUrl: "https://example.test/a.webp", title: "a", observedAt: "2026-10-03T08:00:00Z" }] };
  const lib = renderLibraryGroup(group, { prefix: "/ja", isEn: false, mode: "library" });
  assert.match(lib, /<span class="zk-chip is-private" data-library-status="private">自分のみ<\/span>/);
  assert.doesNotMatch(lib, /まだ自分だけに見えています/);
  assert.match(lib, /<a class="zk-btn is-primary" href="[^"]+">まとめて確認・公開<\/a>/);
  assert.match(lib, /<a class="zk-btn is-secondary" href="[^"]+">リンクで共有する<\/a>/);
  assert.equal((lib.match(/is-primary/g) ?? []).length, 1);
  const top = renderLibraryGroup(group, { prefix: "/ja", isEn: false, mode: "top" });
  assert.match(top, /<button type="button" class="zk-btn is-primary zk-act" data-zukan-open-popover/);
  const pub = renderLibraryGroup({ ...group, published: true }, { prefix: "/ja", isEn: false, mode: "library" });
  assert.match(pub, /zk-chip is-public/);
  assert.match(pub, /zk-btn is-danger/);
  assert.equal((pub.match(/is-primary/g) ?? []).length, 0);
});

test("library css: buttons have explicit colors incl. visited and 44px target", () => {
  assert.match(ZUKAN_LIBRARY_CSS, /\.zk-actions \.zk-btn:visited/);
  assert.match(ZUKAN_LIBRARY_CSS, /\.zk-btn\.is-primary:visited/);
  assert.match(ZUKAN_LIBRARY_CSS, /min-height:44px/);
  assert.doesNotMatch(ZUKAN_LIBRARY_CSS, /text-decoration:underline;cursor:pointer/);
});

test("owner area cache: lookup tolerates a missing table and sanitizes labels", async (t) => {
  const { env } = fixture(t);
  assert.deepEqual([...(await loadOwnerAreaLabels(env, ["cached", "nope"]))], [["cached", "磐田市"]]);
  const broken = { OBS_DB: { prepare() { throw new Error("no such table: owner_area_label_cache"); } } } as unknown as Env;
  assert.equal((await loadOwnerAreaLabels(broken, ["cached"])).size, 0);
});

test("owner area backfill: select-only, rounded cells, idempotent sql", () => {
  assert.match(OWNER_AREA_BACKFILL_SQL, /^SELECT/);
  assert.match(OWNER_AREA_BACKFILL_SQL, /ROUND\(o\.exact_lat, 2\)/);
  assert.equal(ownerAreaCellKey({ observation_id: "a", public_cell: "34.71,137.73", lat2: null, lng2: null }), "34.71,137.73");
  assert.equal(ownerAreaCellKey({ observation_id: "a", public_cell: "hidden", lat2: 34.71, lng2: 137.73 }), "34.71,137.73");
  assert.equal(ownerAreaCellKey({ observation_id: "a", public_cell: "hidden", lat2: null, lng2: null }), null);
  const sql = buildOwnerAreaBackfillSql([{ observationId: "a'b", label: "磐田市" }]);
  assert.match(sql.updates, /INSERT OR IGNORE INTO owner_area_label_cache/);
  assert.match(sql.updates, /'a''b'/);
  assert.match(sql.rollback, /DELETE FROM owner_area_label_cache/);
});
