import assert from "node:assert/strict";
import test from "node:test";
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
