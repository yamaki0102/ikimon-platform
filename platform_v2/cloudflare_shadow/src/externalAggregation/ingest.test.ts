import assert from "node:assert/strict";
import test from "node:test";
import { fetchSource, robotsAllows, type FetchImpl } from "./fetchSource";
import { ingestFacts } from "./ingest";
import { migratedDb } from "./sqliteDb.testkit";
import { runExternalAggregationTick } from "./tick";
import type { ExtractedFact } from "./types";

const fact = (ref: string, title = "t"): ExtractedFact => ({
  kind: "event", source_id: "E1", external_ref: ref, url: `https://x.jp/${ref}`, title, starts_at: "2026-12-05",
  ends_at: null, all_day: true, venue_name: null, venue_address: null, lat: null, lng: null, organizer_name: null, fetched_at: "x",
});

test("migration seeds sources disabled; blocked ones are marked blocked", () => {
  const { sqlite } = migratedDb();
  const rows = sqlite.prepare("SELECT source_id,terms_status,enabled FROM ext_sources ORDER BY source_id").all() as any[];
  assert.equal(rows.length, 13);
  assert.ok(rows.every(r => r.enabled === 0));
  for (const id of ["E5", "E12", "E13", "E14"]) assert.equal(rows.find(r => r.source_id === id).terms_status, "blocked");
  assert.equal((sqlite.prepare("SELECT terms_status FROM ext_sources WHERE source_id='E4'").get() as any).terms_status, "conditional");
});

test("ingest is idempotent, updates changes, and marks vanished records gone", async () => {
  const { db, sqlite } = migratedDb();
  await ingestFacts(db, "E1", [fact("a"), fact("b")], "2026-11-28T00:00:00.000Z");
  await ingestFacts(db, "E1", [fact("a"), fact("b")], "2026-11-28T00:00:00.000Z");
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM ext_source_records").get() as any).n, 2);
  const r = await ingestFacts(db, "E1", [fact("a", "新題名")], "2026-11-28T06:00:00.000Z");
  assert.equal(r.gone, 1);
  const rows = sqlite.prepare("SELECT external_ref,gone_at,first_seen_at,last_seen_at,raw_json FROM ext_source_records ORDER BY external_ref").all() as any[];
  assert.equal(rows[0].gone_at, null);
  assert.equal(rows[0].first_seen_at, "2026-11-28T00:00:00.000Z");
  assert.equal(rows[0].last_seen_at, "2026-11-28T06:00:00.000Z");
  assert.ok(rows[0].raw_json.includes("新題名") && !rows[0].raw_json.includes("fetched_at"));
  assert.equal(rows[1].gone_at, "2026-11-28T06:00:00.000Z");
  await ingestFacts(db, "E1", [fact("a"), fact("b")], "2026-11-28T12:00:00.000Z");
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM ext_source_records WHERE gone_at IS NOT NULL").get() as any).n, 0);
});

test("tick fetches only enabled allowed/conditional sources, at most 2, and spaces them 6h", async () => {
  const { db, sqlite } = migratedDb();
  const calls: string[] = [];
  const feed = `<rss><channel><item><title>A</title><link>https://www.kokuchpro.com/e/1</link><guid>g1</guid><description>開催日時：2026/12/20 10:00</description></item></channel></rss>`;
  const fetchImpl: FetchImpl = async input => {
    calls.push(input);
    if (input.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /", { status: 200 });
    return new Response(feed, { status: 200, headers: { "content-type": "application/rss+xml", etag: '"v1"' } });
  };
  const env = { EXTERNAL_FETCH_ENABLED: "on", OBS_DB: db };
  await runExternalAggregationTick(env, undefined, { fetchImpl, now: Date.parse("2026-11-28T00:00:00Z") });
  assert.equal(calls.length, 0);
  sqlite.exec("UPDATE ext_sources SET enabled=1 WHERE source_id IN ('E4','E5','E1','E2')");
  await runExternalAggregationTick(env, undefined, { fetchImpl, now: Date.parse("2026-11-28T00:00:00Z") });
  const hosts = new Set(calls.map(c => new URL(c).host));
  assert.ok(!hosts.has("peatix.com"));
  assert.ok(calls.filter(c => !c.endsWith("/robots.txt")).length <= 2 * 3);
  const states = sqlite.prepare("SELECT source_id,last_status FROM ext_fetch_state ORDER BY source_id").all() as any[];
  assert.equal(states.length, 2);
  assert.deepEqual(states.map(s => s.source_id), ["E1", "E2"]);
  const before = calls.length;
  await runExternalAggregationTick(env, undefined, { fetchImpl, now: Date.parse("2026-11-28T03:00:00Z") });
  assert.equal(calls.length > before, true);
  const afterThird = calls.length;
  await runExternalAggregationTick(env, undefined, { fetchImpl, now: Date.parse("2026-11-28T04:00:00Z") });
  assert.equal(calls.length, afterThird);
  await runExternalAggregationTick(env, undefined, { fetchImpl, now: Date.parse("2026-11-28T10:00:00Z") });
  assert.ok(calls.length > afterThird);
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM ext_source_records WHERE source_id='E4'").get() as any).n, 1);
});

test("fetchSource sends conditional headers, honors 304, robots and the fetch cap", async () => {
  const seen: Array<Record<string, string>> = [];
  const f304: FetchImpl = async (input, init) => {
    if (input.endsWith("/robots.txt")) return new Response("", { status: 404 });
    seen.push(init?.headers as Record<string, string>);
    return new Response(null, { status: 304 });
  };
  const src = { source_id: "E1", listing_url: "https://x.jp/a", method: "jsonld", etag: '"e"', last_modified: "Mon, 01 Jan 2026 00:00:00 GMT" };
  const out = await fetchSource(src, f304);
  assert.equal(out.status, "not_modified");
  assert.equal(seen[0]!["if-none-match"], '"e"');
  assert.equal(seen[0]!["if-modified-since"], src.last_modified);
  assert.ok(seen[0]!["user-agent"]!.startsWith("ZUKAN external events contact:"));
  let n = 0;
  const f500: FetchImpl = async () => { n++; return new Response("x", { status: 503 }); };
  const bad = await fetchSource(src, f500);
  assert.equal(bad.status, "error");
  assert.equal(n, 3);
  const blocked = await fetchSource(src, async input => (input.endsWith("/robots.txt") ? new Response("User-agent: *\nDisallow: /a", { status: 200 }) : new Response("x")));
  assert.equal(blocked.status, "robots_blocked");
  assert.equal(robotsAllows("User-agent: *\nDisallow: /\nAllow: /pub", "/pub/x"), true);
});
