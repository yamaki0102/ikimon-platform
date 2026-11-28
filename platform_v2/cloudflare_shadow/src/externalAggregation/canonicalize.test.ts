import assert from "node:assert/strict";
import test from "node:test";
import { runCanonicalize } from "./canonicalize";
import { migratedDb } from "./sqliteDb.testkit";

const fact = (o: Record<string, unknown> = {}) => ({
  kind: "event", source_id: "E1", external_ref: "a", url: "https://x/a", title: "観察会", starts_at: "2026-12-05T10:00:00+09:00", ends_at: null,
  all_day: false, venue_name: "浜松市動物園", venue_address: "浜松市中央区", lat: 34.7, lng: 137.7, organizer_name: "浜松市動物園", ...o,
});
function add(sqlite: any, id: string, f: any, gone: string | null = null) {
  sqlite.prepare("INSERT INTO ext_source_records (record_id,source_id,external_ref,url,kind,raw_json,content_hash,first_seen_at,last_seen_at,gone_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(id, f.source_id, f.external_ref, f.url, "event", JSON.stringify(f), "h", "2026-11-01", "2026-11-01", gone);
}
const NOW = Date.parse("2026-11-28T00:00:00Z");

test("school venue name is hidden and has no coordinates", async () => {
  const { db, sqlite } = migratedDb();
  add(sqlite, "r1", fact({ venue_name: "第一小学校" }));
  await runCanonicalize(db, NOW);
  const p = sqlite.prepare("SELECT name,lat,lng FROM ext_places").get() as any;
  assert.deepEqual([p.name, p.lat, p.lng], ["非公開の会場", null, null]);
});

test("past events expire, gone-only records hide, orgs stay per source", async () => {
  const { db, sqlite } = migratedDb();
  add(sqlite, "r1", fact({ starts_at: "2026-10-01T10:00:00+09:00" }));
  add(sqlite, "r2", fact({ external_ref: "g", title: "別の会", starts_at: "2026-12-20" }), "2026-11-20");
  add(sqlite, "r3", fact({ source_id: "E4", external_ref: "z", title: "第三の会", starts_at: "2026-12-21" }));
  await runCanonicalize(db, NOW);
  const st = Object.fromEntries(sqlite.prepare("SELECT title,status FROM ext_events").all().map((r: any) => [r.title, r.status]));
  assert.deepEqual(st, { "観察会": "expired", "別の会": "hidden", "第三の会": "active" });
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM ext_orgs").get() as any).n, 2);
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM ext_org_keys WHERE key_type='name_locality'").get() as any).n, 2);
});

test("running twice is idempotent", async () => {
  const { db, sqlite } = migratedDb();
  add(sqlite, "r1", fact());
  add(sqlite, "r2", fact({ source_id: "E4", external_ref: "b" }));
  await runCanonicalize(db, NOW);
  const count = () => ["ext_events", "ext_places", "ext_orgs", "ext_item_sources"].map(t => (sqlite.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as any).n);
  const first = count();
  const again = await runCanonicalize(db, NOW);
  assert.deepEqual(count(), first);
  assert.equal(again.records, 0);
});
