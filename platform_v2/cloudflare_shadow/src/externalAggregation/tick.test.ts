import assert from "node:assert/strict";
import test from "node:test";
import { HAMAMATSU_ODPF_URL } from "./extractHamamatsuOdpf";
import { SAMPLE } from "./extractHamamatsuOdpf.test";
import { migratedDb } from "./sqliteDb.testkit";
import { runExternalAggregationTick } from "./tick";

test("tick does nothing while the flag is off and never throws", async () => {
  const { db, sqlite } = migratedDb();
  sqlite.exec("UPDATE ext_sources SET enabled=1");
  let called = 0;
  const fetchImpl = async () => { called++; return new Response("", { status: 200 }); };
  for (const flag of [undefined, "off", "true"]) {
    await runExternalAggregationTick({ EXTERNAL_FETCH_ENABLED: flag, OBS_DB: db }, undefined, { fetchImpl });
  }
  assert.equal(called, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM ext_fetch_state").get() as any).n, 0);
  const broken: any = { EXTERNAL_FETCH_ENABLED: "on", OBS_DB: { prepare() { throw new Error("db down"); } } };
  await assert.doesNotReject(runExternalAggregationTick(broken, undefined, { fetchImpl }));
});

test("a throwing fetch is recorded as error and does not stop the tick", async () => {
  const { db, sqlite } = migratedDb();
  sqlite.exec("UPDATE ext_sources SET enabled=1 WHERE source_id='E1'");
  await assert.doesNotReject(runExternalAggregationTick({ EXTERNAL_FETCH_ENABLED: "on", OBS_DB: db }, undefined, {
    fetchImpl: async () => { throw new Error("net"); },
  }));
  const row = sqlite.prepare("SELECT last_status FROM ext_fetch_state WHERE source_id='E1'").get() as any;
  assert.ok(String(row.last_status).startsWith("error"));
});

test("E1 uses the hamamatsu adapter and reaches ext_events", async () => {
  const { db, sqlite } = migratedDb();
  sqlite.exec("UPDATE ext_sources SET enabled=1, terms_status='allowed' WHERE source_id='E1'");
  const urls: string[] = [];
  const fetchImpl = async (u: string) => {
    urls.push(u);
    return u.endsWith("robots.txt") ? new Response("", { status: 404 }) : new Response(JSON.stringify(SAMPLE), { status: 200 });
  };
  await runExternalAggregationTick({ EXTERNAL_FETCH_ENABLED: "on", OBS_DB: db }, undefined, { fetchImpl, now: Date.parse("2026-11-28T00:00:00Z") });
  assert.ok(urls.includes(HAMAMATSU_ODPF_URL));
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM ext_source_records WHERE source_id='E1'").get() as any).n, 4);
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM ext_events WHERE status='active'").get() as any).n, 4);
});
