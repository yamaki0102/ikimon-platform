import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import type { PublicProgram, ProgramProfile } from "../../src/services/publicProgram";
import worker from "./index";

function program(prefix = "12345678", profile: ProgramProfile = "event"): PublicProgram {
  return { schema: "ikimon.public-program/v1", requestId: `${prefix}-1234-4123-8123-123456789abc`,
    profile, title: "Local authorization fixture", startsAt: "2026-10-21T01:00:00.000Z",
    endsAt: "2026-10-21T03:00:00.000Z", timezone: "Asia/Tokyo", placeLabel: "Synthetic public place",
    description: "", conditions: "", stations: profile === "stamp_rally" ? [{ id: "stop-1", name: "Stop" }] : [] };
}

type Bound = {
  sql: string; values: SQLInputValue[]; bind(...values: SQLInputValue[]): Bound;
  first(): Promise<unknown>; all(): Promise<{ results: unknown[] }>;
  run(): Promise<{ meta: { changes: number } }>;
};

function fixture() {
  const obs = new DatabaseSync(":memory:");
  const migrations = new URL("../migrations/observations/", import.meta.url);
  for (const file of readdirSync(migrations).filter(file => file.endsWith(".sql")).sort()) {
    obs.exec(readFileSync(new URL(file, migrations), "utf8"));
  }
  const core = new DatabaseSync(":memory:");
  core.exec(`CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY, user_id TEXT, display_name TEXT,
    role_name TEXT, rank_label TEXT, banned INTEGER, expires_at TEXT, last_used_at TEXT)`);
  for (const [user, banned, expires] of [
    ["active", 0, "2099-01-01"], ["other", 0, "2099-01-01"],
    ["banned", 1, "2099-01-01"], ["expired", 0, "2000-01-01"],
  ] as const) {
    core.prepare("INSERT INTO auth_sessions VALUES (?, ?, ?, 'Observer', NULL, ?, ?, NULL)")
      .run(createHash("sha256").update(`fixture-token-${user}`).digest("hex"), user, user, banned, expires);
  }
  // Executed OBS operations only. CORE session lookup/touch is a separate boundary.
  const operations = { reads: 0, writes: 0, batches: 0 };
  const database = (sqlite: DatabaseSync, observationDatabase = false) => ({
    prepare(sql: string) {
      const statement = (values: SQLInputValue[] = []): Bound => ({
        sql, values, bind: (...next: SQLInputValue[]) => statement(next),
        async first() {
          if (observationDatabase) operations.reads++;
          return sqlite.prepare(sql).get(...values) ?? null;
        },
        async all() {
          if (observationDatabase) operations.reads++;
          return { results: sqlite.prepare(sql).all(...values) };
        },
        async run() {
          const result = sqlite.prepare(sql).run(...values);
          if (observationDatabase) operations.writes += Number(result.changes);
          return { meta: { changes: Number(result.changes) } };
        },
      });
      return statement();
    },
    async batch(statements: Bound[]) {
      if (observationDatabase) operations.batches++;
      sqlite.exec("BEGIN");
      try {
        const results = statements.map(statement => {
          const result = sqlite.prepare(statement.sql).run(...statement.values);
          if (observationDatabase) operations.writes += Number(result.changes);
          return { meta: { changes: Number(result.changes) } };
        });
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  });
  const env = { ENVIRONMENT: "production", CORE_DB: database(core), OBS_DB: database(obs, true),
    ASSET_BUCKET: { async get() { throw new Error("authorization fixture must not read R2"); } } };
  return {
    obs, core, operations,
    async fetch(user: string, body: unknown, path = "/api/v1/programs/receive", origin = "https://zukan.earth", raw = false) {
      Object.assign(operations, { reads: 0, writes: 0, batches: 0 });
      return worker.fetch(new Request(`https://zukan.earth${path}`, {
        method: "POST", headers: { origin, "content-type": "application/json", "sec-fetch-site": "same-origin",
          ...(user === "guest" ? {} : { cookie: `ikimon_v2_session=fixture-token-${user}` }) },
        body: raw ? String(body) : JSON.stringify(body),
      }), env as never);
    },
    config(id: string) {
      const row = obs.prepare("SELECT config_json FROM observation_event_sessions WHERE session_id=?").get(id);
      return row ? JSON.parse(String(row.config_json)) as Record<string, unknown> : null;
    },
    close() { obs.close(); core.close(); },
  };
}

test("banned sessions cannot privately receive or publicly create any Program profile in any route language", async () => {
  const value = fixture();
  try {
    for (const prefix of ["", "/ja", "/en", "/es", "/pt-br"]) {
      for (const profile of ["event", "observation_event", "stamp_rally"] as const) for (const confirmPublication of [false, true]) {
        const response = await value.fetch("banned", { program: program("12345678", profile), confirmPublication }, `${prefix}/api/v1/programs/receive`);
        assert.equal(response.status, 403, `${prefix}/${profile}/${confirmPublication}`);
        assert.deepEqual(await response.json(), { error: "event_creation_unavailable" });
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.deepEqual(value.operations, { reads: 0, writes: 0, batches: 0 });
      }
    }
    assert.equal(value.obs.prepare("SELECT COUNT(*) AS n FROM observation_event_sessions").get()!.n, 0);
    assert.equal(value.obs.prepare("SELECT COUNT(*) AS n FROM observation_rally_courses").get()!.n, 0);
  } finally { value.close(); }
});

test("revoking an existing owner's session prevents private-to-public promotion and public replay without OBS access", async () => {
  const value = fixture();
  try {
    const privateProgram = program("22345678");
    const publicProgram = program("32345678");
    assert.equal((await value.fetch("active", { program: privateProgram })).status, 201);
    assert.equal((await value.fetch("active", { program: publicProgram, confirmPublication: true })).status, 201);
    value.core.exec("UPDATE auth_sessions SET banned=1 WHERE user_id='active'");
    for (const item of [privateProgram, publicProgram]) {
      const response = await value.fetch("active", { program: item, confirmPublication: true });
      assert.equal(response.status, 403);
      assert.deepEqual(value.operations, { reads: 0, writes: 0, batches: 0 });
    }
    assert.equal(value.config(privateProgram.requestId)!.public_listed, false);
    assert.equal(value.config(privateProgram.requestId)!.program_receiver_private, true);
    assert.equal(value.config(publicProgram.requestId)!.public_listed, true);
  } finally { value.close(); }
});

test("active actors retain private persistence, publication promotion, public creation and idempotent replay", async () => {
  const value = fixture();
  try {
    const item = program("42345678");
    const created = await value.fetch("active", { program: item });
    assert.equal(created.status, 201);
    assert.equal((await created.json() as { publicationState: string }).publicationState, "created_private");
    assert.equal(value.operations.writes, 1);
    const promoted = await value.fetch("active", { program: item, confirmPublication: true });
    assert.equal(promoted.status, 200);
    assert.equal((await promoted.json() as { publicationState: string }).publicationState, "public");
    assert.equal(value.operations.writes, 1);
    const replay = await value.fetch("active", { program: item, confirmPublication: true });
    assert.equal(replay.status, 200);
    assert.equal((await replay.json() as { replayed: boolean }).replayed, true);
    assert.equal(value.operations.writes, 0);
    assert.equal(value.operations.batches, 0);
    const conflict = await value.fetch("other", { program: item, confirmPublication: true });
    assert.equal(conflict.status, 409);
    assert.deepEqual(await conflict.json(), { error: "public_program_idempotency_conflict" });
    assert.equal(value.operations.writes, 0);
    assert.equal(value.operations.batches, 0);
    const direct = await value.fetch("active", { program: program("52345678"), confirmPublication: true });
    assert.equal(direct.status, 201);
    assert.equal(value.operations.writes, 1);
    assert.equal(value.obs.prepare("SELECT COUNT(*) AS n FROM observation_event_sessions").get()!.n, 2);
  } finally { value.close(); }
});

test("guest, expired, cross-origin and malformed payload boundaries remain explicit before any OBS operation", async () => {
  const value = fixture();
  try {
    for (const user of ["guest", "expired"]) {
      assert.equal((await value.fetch(user, { program: program(), confirmPublication: true })).status, 401);
      assert.deepEqual(value.operations, { reads: 0, writes: 0, batches: 0 });
    }
    assert.equal((await value.fetch("active", { program: program() }, undefined, "https://outside.invalid")).status, 403);
    assert.deepEqual(value.operations, { reads: 0, writes: 0, batches: 0 });
    for (const prefix of ["", "/ja", "/en", "/es", "/pt-br"]) {
      const rejected = await value.fetch("banned", "{broken", `${prefix}/api/v1/programs/receive`, undefined, true);
      assert.equal(rejected.status, 403);
      assert.deepEqual(await rejected.json(), { error: "event_creation_unavailable" });
      assert.deepEqual(value.operations, { reads: 0, writes: 0, batches: 0 });
    }
    assert.equal((await value.fetch("active", "{broken", undefined, undefined, true)).status, 400);
    assert.deepEqual(value.operations, { reads: 0, writes: 0, batches: 0 });
    assert.equal((await value.fetch("active", { program: { title: "incomplete" } })).status, 400);
    assert.deepEqual(value.operations, { reads: 0, writes: 0, batches: 0 });
  } finally { value.close(); }
});
