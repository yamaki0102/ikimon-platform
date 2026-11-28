import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { loadUserLibraryV2Data, normalizeLibrarySort, renderLibraryV2Page } from "./zukanLibraryV2";

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
    CREATE TABLE asset_ledger (observation_id TEXT, processing_state TEXT, public_derivative_key TEXT, uploaded_at TEXT, mime TEXT, duration_ms INTEGER);
    CREATE TABLE observation_ai_review_targets (occurrence_id TEXT, candidate_vernacular_name TEXT, candidate_scientific_name TEXT, ai_recommended_taxon_name TEXT);
  `);
  const insert = obs.prepare("INSERT INTO observations (observation_id, owner_user_id, observed_at, taxon_label, note, public_area_label) VALUES (?, ?, ?, ?, ?, ?)");
  const photo = obs.prepare("INSERT INTO asset_ledger (observation_id, processing_state, public_derivative_key, uploaded_at, mime) VALUES (?, 'uploaded', ?, '2026-01-01', 'image/webp')");
  const add = (id: string, at: string, taxon: string, note: string | null = null, area: string | null = null) => {
    insert.run(id, OWNER, at, taxon, note, area);
    photo.run(id, `derived/${id}/display.webp`);
  };
  const env = { OBS_DB: d1(obs), CORE_DB: d1(core) } as unknown as Env;
  return { env, obs, add };
}

const dayAt = (i: number) => new Date(Date.UTC(2024, 0, 1, 3) + i * 86_400_000).toISOString();

function seedDays(add: (id: string, at: string, taxon: string) => void, n: number) {
  for (let i = 0; i < n; i += 1) add(`d-${String(i).padStart(4, "0")}`, dayAt(i), `生きもの${i}`);
}

test("sort=old: ascending order and the cursor continues without gaps", async (t) => {
  const { env, add } = fixture(t);
  seedDays(add, 130);
  const seen: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 5; page += 1) {
    const data: Awaited<ReturnType<typeof loadUserLibraryV2Data>> = await loadUserLibraryV2Data(env, OWNER, "", { sort: "old", before: cursor });
    seen.push(...data.visits.flatMap((v) => v.observationIds));
    cursor = data.nextCursor;
    if (!cursor) break;
  }
  assert.equal(seen.length, 130);
  assert.deepEqual(seen, [...seen].sort());
  assert.equal(seen[0], "d-0000");
  assert.equal(seen[129], "d-0129");
  const first = await loadUserLibraryV2Data(env, OWNER, "", { sort: "new" });
  assert.equal(first.visits[0]!.observationIds[0], "d-0129");
});

test("invalid sort falls back to new", async (t) => {
  const { env, add } = fixture(t);
  seedDays(add, 5);
  assert.equal(normalizeLibrarySort("bogus"), "new");
  assert.equal(normalizeLibrarySort(null), "new");
  assert.equal(normalizeLibrarySort("old"), "old");
  const data = await loadUserLibraryV2Data(env, OWNER, "", { sort: "bogus" });
  assert.equal(data.visits[0]!.observationIds[0], "d-0004");
});

test("search finds an old observation beyond the newest 300 (and beyond the SQL cap)", async (t) => {
  const { env, obs, add } = fixture(t);
  add("ancient", "2020-01-01T03:00:00.000Z", "ジンベエザメ");
  obs.exec("BEGIN");
  const ins = obs.prepare("INSERT INTO observations (observation_id, owner_user_id, observed_at, taxon_label) VALUES (?, ?, ?, ?)");
  for (let i = 0; i < 1100; i += 1) ins.run(`n-${String(i).padStart(4, "0")}`, OWNER, new Date(Date.UTC(2023, 0, 1) + i * 86_400_000).toISOString(), `近所の鳥${i}`);
  obs.exec("COMMIT");
  const res = await loadUserLibraryV2Data(env, OWNER, "ジンベエ");
  assert.deepEqual(res.visits.flatMap((v) => v.observationIds), ["ancient"]);
  assert.equal(res.visits[0]!.matchedByCandidate, false);
});

test("search: AI candidate match is flagged, confirmed match is not", async (t) => {
  const { env, obs, add } = fixture(t);
  add("confirmed", "2025-05-01T03:00:00.000Z", "アオサギ");
  add("cand", "2025-04-01T03:00:00.000Z", "未同定");
  obs.prepare("INSERT INTO observation_ai_review_targets VALUES (?, ?, ?, ?)").run("occ:cand:0", "アオサギ", null, null);
  const res = await loadUserLibraryV2Data(env, OWNER, "アオサギ");
  const byId = new Map(res.visits.map((v) => [v.observationIds[0]!, v]));
  assert.equal(byId.get("confirmed")!.matchedByCandidate, false);
  assert.equal(byId.get("cand")!.matchedByCandidate, true);
});

test("old AI candidate beyond the window is found via SQL", async (t) => {
  const { env, obs, add } = fixture(t);
  add("cand-old", "2019-04-01T03:00:00.000Z", "未同定");
  obs.prepare("INSERT INTO observation_ai_review_targets VALUES (?, ?, ?, ?)").run("occ:cand-old:0", "ミサゴ", null, null);
  obs.exec("BEGIN");
  const ins = obs.prepare("INSERT INTO observations (observation_id, owner_user_id, observed_at, taxon_label) VALUES (?, ?, ?, ?)");
  for (let i = 0; i < 1100; i += 1) ins.run(`n-${i}`, OWNER, new Date(Date.UTC(2023, 0, 1) + i * 86_400_000).toISOString(), `鳥${i}`);
  obs.exec("COMMIT");
  const res = await loadUserLibraryV2Data(env, OWNER, "ミサゴ", { sort: "old" });
  assert.deepEqual(res.visits.flatMap((v) => v.observationIds), ["cand-old"]);
  assert.equal(res.visits[0]!.matchedByCandidate, true);
});

test("badge renders only for candidate matches; sort toggle and links keep sort", async (t) => {
  const { env, obs, add } = fixture(t);
  add("confirmed", "2025-05-01T03:00:00.000Z", "アオサギ");
  add("cand", "2025-04-01T03:00:00.000Z", "未同定");
  obs.prepare("INSERT INTO observation_ai_review_targets VALUES (?, ?, ?, ?)").run("occ:cand:0", "アオサギ", null, null);
  const all = await loadUserLibraryV2Data(env, OWNER, "アオサギ");
  const render = (visits: typeof all.visits, extra: { sort?: "new" | "old"; nextCursor?: string | null } = {}) =>
    renderLibraryV2Page({ visits, lang: "ja", authenticated: true, searchQuery: "アオサギ", ...extra });
  const confirmedOnly = render(all.visits.filter((v) => !v.matchedByCandidate));
  const candOnly = render(all.visits.filter((v) => v.matchedByCandidate));
  assert.ok(!confirmedOnly.includes("候補で一致"));
  assert.ok(candOnly.includes("候補で一致"));
  assert.ok(candOnly.includes("新しい順") && candOnly.includes("古い順"));
  const en = renderLibraryV2Page({ visits: all.visits.filter((v) => v.matchedByCandidate), lang: "en", authenticated: true, searchQuery: "x" });
  assert.ok(en.includes("Matched by AI candidate") && en.includes("Newest") && en.includes("Oldest"));
  const old = render(all.visits, { sort: "old", nextCursor: "2025-04-01T03:00:00.000Z~cand" });
  assert.ok(old.includes('name="sort" value="old"'));
  assert.match(old, /data-load-more="1" href="[^"]*sort=old/);
  assert.match(old, /href="[^"]*" data-library-sort-old="1" aria-current="true"/);
});
