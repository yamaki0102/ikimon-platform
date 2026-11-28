import assert from "node:assert/strict";
import test from "node:test";
import { runCanonicalize } from "./canonicalize";
import { dedupeKey } from "./dedupe";
import { migratedDb } from "./sqliteDb.testkit";

const fact = (o: Record<string, unknown> = {}) => ({
  kind: "event", source_id: "E1", external_ref: "a", url: "https://x/a", title: "自然観察会", starts_at: "2026-12-05T10:00:00+09:00", ends_at: null,
  all_day: false, venue_name: "浜松市動物園", venue_address: null, lat: null, lng: null, organizer_name: null, ...o,
});

function addRecord(sqlite: any, id: string, sourceId: string, f: any) {
  sqlite.prepare("INSERT INTO ext_source_records (record_id,source_id,external_ref,url,kind,raw_json,content_hash,first_seen_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(id, sourceId, f.external_ref, f.url, f.kind, JSON.stringify(f), "h", "2026-11-01", "2026-11-01");
}

test("same event from two sources becomes one event with two sources", async () => {
  const { db, sqlite } = migratedDb();
  addRecord(sqlite, "r1", "E1", fact());
  addRecord(sqlite, "r2", "E4", fact({ source_id: "E4", external_ref: "b" }));
  await runCanonicalize(db, Date.parse("2026-11-28T00:00:00Z"));
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM ext_events").get() as any).n, 1);
  const roles = sqlite.prepare("SELECT role FROM ext_item_sources ORDER BY record_id").all().map((r: any) => r.role);
  assert.deepEqual(roles, ["official", "listing"]);
});

test("different day makes two events; full/half width differences make one", async () => {
  const { db, sqlite } = migratedDb();
  addRecord(sqlite, "r1", "E1", fact());
  addRecord(sqlite, "r2", "E1", fact({ external_ref: "c", starts_at: "2026-12-12T10:00:00+09:00" }));
  await runCanonicalize(db, Date.parse("2026-11-28T00:00:00Z"));
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM ext_events").get() as any).n, 2);
  assert.equal(await dedupeKey(fact({ title: "ＡＢＣ　観察会" })), await dedupeKey(fact({ title: "abc 観察会" })));
});
