import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import worker from "./index";

type Fault = "" | "owner" | "legacy" | "media" | "null-result" | "null-rows" | "not-an-array";

function fixture() {
  const obs = new DatabaseSync(":memory:");
  const migrations = new URL("../migrations/observations/", import.meta.url);
  for (const file of readdirSync(migrations).filter(file => file.endsWith(".sql")).sort()) {
    obs.exec(readFileSync(new URL(file, migrations), "utf8"));
  }
  const insertObservation = obs.prepare(`INSERT INTO observations
    (observation_id, draft_id, owner_user_id, observed_at, public_cell, visibility, taxon_label, emergency_hidden)
    VALUES (?, ?, ?, '2026-10-17T00:00:00.000Z', 'blurred', 'private', ?, ?)`);
  insertObservation.run("mine", "draft-mine", "nonempty", "Private owner record", 0);
  insertObservation.run("hidden-mine", "draft-hidden", "hidden", "Hidden owner record", 1);
  for (let index = 0; index < 12; index++) {
    const id = `other-${index}`;
    insertObservation.run(id, `draft-${id}`, "other-user", "Other private record", 0);
    obs.prepare(`INSERT INTO production_import_evidence_assets(asset_id, visit_id, occurrence_id, asset_role)
      VALUES (?, ?, ?, 'observation_photo')`).run(`import-${id}`, id, `occ:${id}:0`);
    obs.prepare(`INSERT INTO asset_ledger
      (asset_id, draft_id, observation_id, owner_user_id, object_key, mime, bytes, processing_state)
      VALUES (?, ?, ?, 'other-user', ?, 'image/jpeg', 100000, 'uploaded')`)
      .run(`asset-${id}`, `draft-${id}`, id, `original/${id}`);
  }
  const core = new DatabaseSync(":memory:");
  core.exec(`CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY, user_id TEXT, display_name TEXT,
    role_name TEXT, rank_label TEXT, banned INTEGER, expires_at TEXT, last_used_at TEXT)`);
  for (const [user, banned, expires] of [
    ["empty", 0, "2099-01-01"], ["nonempty", 0, "2099-01-01"], ["hidden", 0, "2099-01-01"],
    ["banned", 1, "2099-01-01"], ["expired", 0, "2000-01-01"],
  ] as const) {
    core.prepare("INSERT INTO auth_sessions VALUES (?, ?, ?, 'Observer', NULL, ?, ?, NULL)")
      .run(createHash("sha256").update(`token-${user}`).digest("hex"), user, user, banned, expires);
  }
  const calls: Array<{ database: string; sql: string; method: string }> = [];
  let fault: Fault = "";
  const database = (sqlite: DatabaseSync, name: string) => ({
    prepare(sql: string) {
      const statement = (values: SQLInputValue[] = []) => ({
        bind: (...next: SQLInputValue[]) => statement(next),
        async first() {
          calls.push({ database: name, sql, method: "first" });
          return sqlite.prepare(sql).get(...values) ?? null;
        },
        async all() {
          calls.push({ database: name, sql, method: "all" });
          if (name === "obs" && sql.includes("FROM observations o")) {
            if (fault === "owner") throw new Error("fixture D1 unavailable");
            if (fault === "legacy" && sql.includes("art.ai_assessment_status")) {
              throw new Error("no such table: observation_ai_review_targets");
            }
            if (fault === "null-result") return null;
            if (fault === "null-rows") return { results: null };
            if (fault === "not-an-array") return { results: { length: 0 } };
          }
          if (name === "obs" && fault === "media" && sql.includes("FROM production_import_evidence_assets")) {
            throw new Error("fixture media unavailable");
          }
          return { results: sqlite.prepare(sql).all(...values) };
        },
        async run() {
          calls.push({ database: name, sql, method: "run" });
          return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } };
        },
      });
      return statement();
    },
  });
  const shell = "<!doctype html><html><head><title>Records fixture</title></head><body><main>legacy records</main></body></html>";
  const env = {
    ENVIRONMENT: "production", CORE_DB: database(core, "core"), OBS_DB: database(obs, "obs"),
    ASSET_BUCKET: {
      async get(key: string) {
        if (!/^original-ui\/html\/(ja|en|es|pt-br)\/records\.html$/u.test(key)) return null;
        return { body: new Response(shell).body, httpMetadata: { contentType: "text/html; charset=utf-8" } };
      },
    },
  };
  return {
    calls,
    async fetch(user: string, path = "/ja/records?view=mine", method = "GET", nextFault: Fault = "") {
      fault = nextFault;
      calls.length = 0;
      return worker.fetch(new Request(`https://zukan.earth${path}`, {
        method, headers: user === "guest" ? {} : { cookie: `ikimon_v2_session=token-${user}` },
      }), env as never);
    },
    observationCalls: () => calls.filter(call => call.database === "obs"),
    mediaCalls: () => calls.filter(call => call.database === "obs" && /GROUP BY (?:COALESCE|observation_id)/u.test(call.sql)),
    close() { core.close(); obs.close(); },
  };
}

test("empty and hidden-only owner Records skip both global media queries, including the legacy reader", async () => {
  const value = fixture();
  try {
    for (const lang of ["ja", "en", "es", "pt-br"]) for (const method of ["GET", "HEAD"]) {
      for (const [user, fault, queries] of [["empty", "", 1], ["hidden", "", 1], ["empty", "legacy", 2]] as const) {
        const response = await value.fetch(user, `/${lang}/records?view=mine&q=missing`, method, fault);
        const body = await response.text();
        assert.equal(response.status, 200);
        assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
        assert.equal(value.observationCalls().length, queries, `${lang}/${method}/${user}/${fault}`);
        assert.equal(value.mediaCalls().length, 0);
        if (method === "HEAD") assert.equal(body, "");
        else {
          assert.match(body, /data-records-mode="mine"/u);
          assert.doesNotMatch(body, /role="status"|Other private record|Hidden owner record/u);
        }
      }
    }
  } finally { value.close(); }
});

test("nonempty owner results retain media reads and private ownership even when search returns no matches", async () => {
  const value = fixture();
  try {
    for (const query of ["", "&q=missing"]) {
      const response = await value.fetch("nonempty", `/ja/records?view=mine${query}`);
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.equal(value.observationCalls().length, 3);
      assert.equal(value.mediaCalls().length, 2);
      assert.doesNotMatch(body, /Other private record|Hidden owner record/u);
      if (!query) {
        assert.match(body, /Private owner record/u);
        assert.match(body, /非公開/u);
      } else assert.doesNotMatch(body, /class="cf-records-native-card"/u);
    }
    const response = await value.fetch("nonempty", "/ja/records?view=mine", "GET", "media");
    assert.match(await response.text(), /Private owner record/u);
    assert.equal(value.observationCalls().length, 2);
    assert.equal(value.mediaCalls().length, 1);
  } finally { value.close(); }
});

test("owner failures and malformed D1 results remain unavailable instead of becoming empty success", async () => {
  const value = fixture();
  try {
    for (const fault of ["owner", "null-result", "null-rows", "not-an-array"] as const) {
      const response = await value.fetch("empty", "/ja/records?view=mine", "GET", fault);
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.match(body, /role="status"/u);
      assert.match(body, /記録を読み込めませんでした。/u);
      assert.doesNotMatch(body, /まだ記録はありません。/u);
      assert.equal(value.observationCalls().length, fault === "owner" ? 1 : 3);
      assert.equal(value.mediaCalls().length, fault === "owner" ? 0 : 2);
    }
  } finally { value.close(); }
});

test("guest, banned and expired owner requests retain redirects and never read observations", async () => {
  const value = fixture();
  try {
    for (const user of ["guest", "banned", "expired"]) for (const method of ["GET", "HEAD"]) {
      const response = await value.fetch(user, "/en/records?view=mine&q=missing", method);
      assert.equal(response.status, 303);
      assert.equal(response.headers.get("location"), "/en/login?redirect=%2Fen%2Frecords%3Fview%3Dmine%26q%3Dmissing");
      assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
      assert.equal(value.observationCalls().length, 0);
    }
  } finally { value.close(); }
});

test("public Records keeps its existing readers and cannot expose another user's private cards", async () => {
  const value = fixture();
  try {
    for (const user of ["guest", "empty", "nonempty", "banned", "expired"]) {
      const response = await value.fetch(user, "/ja/records?view=public");
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.match(body, /data-records-mode="public"/u);
      assert.doesNotMatch(body, /Private owner record|Other private record|Hidden owner record/u);
      assert.equal(value.observationCalls().length, 2);
      assert.equal(value.mediaCalls().length, 0);
      assert.ok(value.observationCalls().every(call => /public_map_snapshot_records_v1|readmodel_public_observations/u.test(call.sql)));
    }
  } finally { value.close(); }
});
