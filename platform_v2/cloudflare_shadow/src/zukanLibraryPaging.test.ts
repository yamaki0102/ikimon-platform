import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { ownerHomeRecordPage, renderRecordsProductSection } from "./index";
import { decodePageCursor, encodePageCursor, likePatternFromQuery } from "./ownerRecordPaging";
import { renderZukanLibraryPage } from "./zukanLibraryAndProfile";
import { loadUserLibraryData, loadUserLibraryGroup } from "./zukanTopPage";

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
const OTHER = "other-1";

function fixture(t: test.TestContext) {
  const obs = new DatabaseSync(":memory:");
  const core = new DatabaseSync(":memory:");
  t.after(() => { obs.close(); core.close(); });
  obs.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, observed_at TEXT NOT NULL, taxon_label TEXT, note TEXT, public_area_label TEXT, visibility TEXT DEFAULT 'private', emergency_hidden INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE asset_ledger (observation_id TEXT, processing_state TEXT, public_derivative_key TEXT, public_derivative_verified_at TEXT, public_derivative_metadata_json TEXT, exif_scrub_state TEXT, public_ready_at TEXT, uploaded_at TEXT, mime TEXT, width INTEGER, height INTEGER, bytes INTEGER);
    CREATE TABLE observation_ai_review_targets (occurrence_id TEXT, ai_assessment_status TEXT, candidate_vernacular_name TEXT, candidate_scientific_name TEXT, ai_recommended_taxon_name TEXT);
    CREATE TABLE observation_reassessment_requests (observation_id TEXT, request_kind TEXT, request_state TEXT, updated_at TEXT);
    CREATE TABLE readmodel_public_observations (observation_id TEXT, public_area_label TEXT);
    CREATE TABLE civic_observation_contexts (visit_id TEXT, field_id TEXT);
    CREATE TABLE places (place_id TEXT, canonical_name TEXT, public_profile_status TEXT);
  `);
  const insert = obs.prepare("INSERT INTO observations (observation_id, owner_user_id, observed_at, taxon_label, public_area_label) VALUES (?, ?, ?, ?, ?)");
  const base = Date.parse("2026-05-21T00:00:00Z");
  for (let i = 0; i < 70; i += 1) {
    const at = new Date(base + Math.floor(i / 2) * 60_000).toISOString();
    insert.run(`old-${String(i).padStart(3, "0")}`, OWNER, at, i === 5 ? "ジンベエザメ" : `沖縄の生きもの${i}`, null);
  }
  const novBase = Date.parse("2026-11-20T00:00:00Z");
  for (let i = 0; i < 60; i += 1) {
    const at = new Date(novBase + Math.floor(i / 3) * 3_600_000).toISOString();
    insert.run(`new-${String(i).padStart(3, "0")}`, OWNER, at, `近所の鳥${i}`, "佐鳴湖公園");
  }
  for (let i = 0; i < 40; i += 1) {
    insert.run(`other-${i}`, OTHER, new Date(novBase + i * 1000).toISOString(), "他人の記録", "他人の場所");
  }
  obs.prepare("INSERT INTO readmodel_public_observations (observation_id, public_area_label) VALUES (?, ?)").run("old-010", "今帰仁村");
  const env = { OBS_DB: d1(obs), CORE_DB: d1(core) } as unknown as Env;
  return { env, obs };
}

function ids(groups: Awaited<ReturnType<typeof loadUserLibraryData>>["groups"]): string[] {
  return groups.flatMap((g) => g.photos.map((p) => p.observationId));
}

test("library: keyset pages cover all 130 owner records once, newest first, without other users", async (t) => {
  const { env } = fixture(t);
  const seen: string[] = [];
  let cursor: string | null = null;
  const sizes: number[] = [];
  for (let page = 0; page < 5; page += 1) {
    const data: Awaited<ReturnType<typeof loadUserLibraryData>> = await loadUserLibraryData(env, OWNER, "", { before: cursor });
    const got = ids(data.groups);
    sizes.push(got.length);
    seen.push(...got);
    cursor = data.nextCursor;
    if (!cursor) break;
  }
  assert.deepEqual(sizes, [60, 60, 10]);
  assert.equal(new Set(seen).size, 130);
  assert.ok(seen.every((id) => id.startsWith("old-") || id.startsWith("new-")));
  assert.ok(seen.slice(0, 60).every((id) => id.startsWith("new-")));
  assert.ok(seen.slice(60).every((id) => id.startsWith("old-")));
});

test("library: search runs in SQL over all records, not only the first page", async (t) => {
  const { env } = fixture(t);
  const byName = await loadUserLibraryData(env, OWNER, "ジンベエ");
  assert.deepEqual(ids(byName.groups), ["old-005"]);
  const byPlace = await loadUserLibraryData(env, OWNER, "今帰仁");
  assert.deepEqual(ids(byPlace.groups), ["old-010"]);
  const byDate = await loadUserLibraryData(env, OWNER, "2026-05-21");
  assert.equal(ids(byDate.groups).length, 60);
  assert.ok(byDate.nextCursor);
  const rest = await loadUserLibraryData(env, OWNER, "2026-05-21", { before: byDate.nextCursor });
  assert.equal(ids(rest.groups).length, 10);
  assert.equal(rest.nextCursor, null);
  assert.equal(ids((await loadUserLibraryData(env, OWNER, "%")).groups).length, 0);
  assert.equal(ids((await loadUserLibraryData(env, OWNER, "他人")).groups).length, 0);
});

test("library: a group of an old day resolves by key (detail and link flows)", async (t) => {
  const { env } = fixture(t);
  const first = await loadUserLibraryData(env, OWNER, "ジンベエ");
  const key = first.groups[0]!.groupKey;
  const group = await loadUserLibraryGroup(env, OWNER, key);
  assert.ok(group);
  assert.ok(group!.photos.some((p) => p.observationId === "old-005"));
  assert.equal(await loadUserLibraryGroup(env, OTHER, key), null);
});

test("library page: more button is a plain link with the cursor and keeps the search", () => {
  const cursor = encodePageCursor("2026-05-21T00:00:00.000Z", "old-069");
  const data = { libraryGroups: [{ groupKey: "2026-05-21__身近な場所", headerLabel: "5月21日・身近な場所", placeName: "身近な場所", published: false, photos: [{ observationId: "o1", title: "x", observedAt: "2026-05-21T00:00:00Z", photoUrl: null }] }], oneYearPair: null, libraryNextCursor: cursor };
  const html = renderZukanLibraryPage(data, { lang: "ja", authenticated: true, searchQuery: "沖縄" });
  const m = /<a class="zk-more-btn" data-load-more="1" href="([^"]+)">もっと見る<\/a>/.exec(html);
  assert.ok(m);
  const href = new URL(m![1]!.replace(/&amp;/g, "&"), "https://zukan.earth");
  assert.equal(href.pathname, "/ja/library");
  assert.equal(href.searchParams.get("before"), cursor);
  assert.equal(href.searchParams.get("q"), "沖縄");
  assert.match(html, /data-load-more-script/);
  const last = renderZukanLibraryPage({ ...data, libraryNextCursor: null }, { lang: "ja", authenticated: true });
  assert.doesNotMatch(last, /data-library-more/);
});

test("records (mine): 120 per page keyset paging, SQL search over all, owner only", async (t) => {
  const { env, obs } = fixture(t);
  const ins = obs.prepare("INSERT INTO observations (observation_id, owner_user_id, observed_at, taxon_label) VALUES (?, ?, ?, ?)");
  for (let i = 0; i < 100; i += 1) {
    ins.run(`mid-${String(i).padStart(3, "0")}`, OWNER, new Date(Date.parse("2026-08-01T00:00:00Z") + i * 60_000).toISOString(), `夏の虫${i}`);
  }
  const p1 = await ownerHomeRecordPage(OWNER, env, 120);
  assert.equal(p1.items.length, 120);
  assert.ok(p1.nextCursor);
  const p2 = await ownerHomeRecordPage(OWNER, env, 120, { before: p1.nextCursor });
  assert.equal(p2.items.length, 110);
  assert.equal(p2.nextCursor, null);
  const all = [...p1.items, ...p2.items].map((i) => i.visitId);
  assert.equal(new Set(all).size, 230);
  assert.ok(all.every((id) => !id.startsWith("other-")));
  const found = await ownerHomeRecordPage(OWNER, env, 120, { query: "ジンベエ" });
  assert.deepEqual(found.items.map((i) => i.visitId), ["old-005"]);
  const foundPlace = await ownerHomeRecordPage(OWNER, env, 120, { query: "今帰仁" });
  assert.deepEqual(foundPlace.items.map((i) => i.visitId), ["old-010"]);
  assert.equal((await ownerHomeRecordPage(OTHER, env, 120, { query: "ジンベエ" })).items.length, 0);

  const url = new URL("https://zukan.earth/ja/records?view=mine");
  const html = renderRecordsProductSection(p1.items, url, "mine", null, false, null, [], `/ja/records?view=mine&before=${encodeURIComponent(p1.nextCursor!)}`);
  assert.match(html, /data-records-more/);
  assert.match(html, /class="cf-records-native-more-link" data-load-more="1" href="[^"]*before=/);
  assert.match(html, />もっと見る</);
  assert.doesNotMatch(renderRecordsProductSection(p2.items, url, "mine", null, false, null, [], null), /data-records-more/);
});

test("cursor helpers reject malformed input and escape LIKE wildcards", () => {
  assert.equal(decodePageCursor("nope"), null);
  assert.equal(decodePageCursor("~x"), null);
  assert.equal(decodePageCursor("a~"), null);
  assert.deepEqual(decodePageCursor("2026-05-21T00:00:00.000Z~obs-1"), { observedAt: "2026-05-21T00:00:00.000Z", id: "obs-1" });
  assert.equal(likePatternFromQuery("   "), null);
  assert.equal(likePatternFromQuery("a%b_c"), "%a\\%b\\_c%");
});
