import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { PUBLIC_PROGRAM_SCHEMA, type PublicProgram } from "../../src/services/publicProgram";
import { receivePublicProgram, type PublicProgramReceiverStatement } from "./publicProgramReceiver";

const first: PublicProgram = { schema: PUBLIC_PROGRAM_SCHEMA, requestId: "12345678-1234-4123-8123-123456789abc",
  profile: "event", title: "Local fixture", startsAt: "2026-10-21T01:00:00.000Z", endsAt: "",
  timezone: "Asia/Tokyo", placeLabel: "Local fixture", description: "", conditions: "", stations: [] };
const second: PublicProgram = { ...first, requestId: "12345678-1234-4123-8123-123456789abd" };
type Statement = PublicProgramReceiverStatement & { sql: string; values: SQLInputValue[] };

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  for (const migration of ["0019_observation_event_core.sql", "0020_observation_event_rally.sql"]) {
    sqlite.exec(readFileSync(new URL(`../migrations/observations/${migration}`, import.meta.url), "utf8"));
  }
  const counts = { batches: 0, sessionReads: 0, codeReads: 0 };
  let beforeBatch: ((statements: Statement[]) => void) | undefined;
  let failAfterStatement = 0;
  let wrapError: ((error: unknown) => Error) | undefined;
  const load = (column: "session_id" | "event_code", value: string) => {
    const row = sqlite.prepare(`SELECT session_id, organizer_user_id, config_json FROM observation_event_sessions WHERE ${column} = ?`).get(value);
    return row ? { sessionId: String(row.session_id), organizerUserId: String(row.organizer_user_id), config: JSON.parse(String(row.config_json)) } : null;
  };
  const database = {
    prepare(sql: string): Statement {
      return { sql, values: [], bind(...values) { return { ...this, values }; } };
    },
    async batch(statements: PublicProgramReceiverStatement[]) {
      counts.batches++;
      const bound = statements as Statement[];
      beforeBatch?.(bound);
      sqlite.exec("BEGIN");
      try {
        const result = bound.map((statement, index) => {
          const outcome = sqlite.prepare(statement.sql).run(...statement.values);
          if (failAfterStatement === index + 1) throw new Error("local fixture database unavailable");
          return outcome;
        });
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw wrapError ? wrapError(error) : error;
      }
    },
  };
  return {
    sqlite, counts,
    beforeBatch(value: typeof beforeBatch) { beforeBatch = value; },
    failAfterStatement(value: number) { failAfterStatement = value; },
    wrapError(value: typeof wrapError) { wrapError = value; },
    native(code: string, id = "native-" + code) {
      sqlite.prepare("INSERT INTO observation_event_sessions(session_id,event_code,organizer_user_id,started_at) VALUES (?,?,?,?)")
        .run(id, code, "other-native-organizer", first.startsAt);
    },
    rows() { return sqlite.prepare("SELECT session_id, event_code, organizer_user_id, config_json FROM observation_event_sessions ORDER BY session_id").all(); },
    receive(program = first, confirmed = true, actorUserId = "local-fixture-actor") {
      return receivePublicProgram({ actorUserId, body: { program, confirmPublication: confirmed }, database,
        async loadSession(id) { counts.sessionReads++; return load("session_id", id); },
        async loadSessionByEventCode(code) { counts.codeReads++; return load("event_code", code); },
        async loadRally(id) { return sqlite.prepare("SELECT * FROM observation_rally_courses WHERE session_id = ?").get(id); },
      });
    },
  };
}

test("distinct UUIDs with the same seven-digit prefix both persist and keep their invite codes on replay", async () => {
  const f = fixture();
  try {
    assert.equal((await f.receive()).status, 201);
    assert.deepEqual(f.counts, { batches: 1, sessionReads: 2, codeReads: 0 }, "normal success adds no code lookup");
    assert.equal((await f.receive(second)).status, 201);
    const rows = f.rows();
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.event_code, "P1234567");
    assert.match(String(rows[1]!.event_code), /^P[A-Z0-9]{7}$/u);
    assert.notEqual(rows[0]!.event_code, rows[1]!.event_code);
    const batches = f.counts.batches;
    for (const value of [first, second]) {
      const replay = await f.receive(JSON.parse(JSON.stringify(value)));
      assert.equal(replay.status, 200);
      assert.equal(replay.body.replayed, true);
      assert.equal(replay.body.programId, value.requestId);
    }
    assert.equal(f.counts.batches, batches, "replay makes no write or code reassignment");
    assert.deepEqual(f.rows(), rows);
  } finally { f.sqlite.close(); }
});

test("a native event's existing short code is preserved and the receiver alternative is deterministic", async () => {
  const codes: string[] = [];
  for (let i = 0; i < 2; i++) {
    const f = fixture();
    try {
      f.native("P1234567");
      assert.equal((await f.receive()).status, 201);
      assert.equal(f.rows().find(row => row.session_id === "native-P1234567")!.event_code, "P1234567");
      codes.push(String(f.rows().find(row => row.session_id === first.requestId)!.event_code));
      assert.equal(f.counts.batches, 2);
    } finally { f.sqlite.close(); }
  }
  assert.equal(codes[0], codes[1]);
});

test("D1 message and legacy cause envelopes recover only the actual event-code unique failure", async () => {
  for (const wrap of [
    (error: unknown) => new Error("D1_ERROR: " + (error as Error).message + ": SQLITE_CONSTRAINT"),
    (error: unknown) => new Error("D1_ERROR", { cause: error }),
  ]) {
    const f = fixture();
    try {
      f.native("P1234567");
      f.wrapError(wrap);
      assert.equal((await f.receive()).status, 201);
      assert.equal(f.rows().length, 2);
      assert.equal(f.counts.batches, 2);
    } finally { f.sqlite.close(); }
  }
});

test("an occupied code cannot turn an unrelated database or unique failure into a code retry", async () => {
  for (const failure of ["unavailable", "other unique"]) {
    const f = fixture();
    try {
      f.native("P1234567");
      f.beforeBatch(() => {
        if (failure === "unavailable") throw new Error("D1_ERROR: database unavailable");
        // A real SQLite UNIQUE failure, but against a different unique identity.
        f.native("OTHER123", "native-P1234567");
      });
      const result = await f.receive();
      assert.equal(result.status, 500);
      assert.deepEqual(result.body, { error: "public_program_receive_failed" });
      assert.equal(f.rows().length, 1);
      assert.equal(f.counts.batches, 1);
      assert.equal(f.counts.codeReads, 0);
    } finally { f.sqlite.close(); }
  }
});

test("private-to-public promotion handles a short-code collision without changing a native invite", async () => {
  const f = fixture();
  try {
    assert.equal((await f.receive(first, false)).body.publicationState, "created_private");
    assert.equal(f.rows()[0]!.event_code, null);
    f.native("P1234567");
    const promoted = await f.receive();
    assert.equal(promoted.status, 200);
    assert.equal(promoted.body.publicationState, "public");
    assert.equal(f.rows().length, 2);
    const rows = f.rows();
    await f.receive();
    assert.deepEqual(f.rows(), rows);
  } finally { f.sqlite.close(); }
});

test("colliding rally programs persist separate courses and stations in their atomic batches", async () => {
  const f = fixture();
  try {
    for (const value of [first, second]) {
      const rally: PublicProgram = { ...value, profile: "stamp_rally", endsAt: "2026-10-22T01:00:00.000Z", stations: [{ id: "one", name: "Local stop" }] };
      assert.equal((await f.receive(rally)).status, 201);
      assert.equal((await f.receive(rally)).status, 200);
    }
    assert.equal(f.rows().length, 2);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS count FROM observation_rally_courses").get()!.count, 2);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS count FROM observation_rally_stations").get()!.count, 2);
  } finally { f.sqlite.close(); }
});

test("same request ID with a different body or actor remains a conflict without a write", async () => {
  const f = fixture();
  try {
    await f.receive(first, false);
    const rows = f.rows(), batches = f.counts.batches;
    for (const result of [await f.receive({ ...first, title: "Changed" }), await f.receive(first, true, "another-local-fixture-actor")]) {
      assert.equal(result.status, 409);
      assert.equal(result.body.error, "public_program_idempotency_conflict");
    }
    assert.deepEqual(f.rows(), rows);
    assert.equal(f.counts.batches, batches);
    assert.equal(f.counts.codeReads, 0);
  } finally { f.sqlite.close(); }
});

test("a concurrent same-request write reads back the existing receipt instead of allocating another code", async () => {
  const f = fixture();
  try {
    f.beforeBatch(statements => {
      f.beforeBatch(undefined);
      const statement = statements[0]!;
      f.sqlite.prepare(statement.sql).run(...statement.values);
    });
    const result = await f.receive();
    assert.equal(result.status, 200);
    assert.equal(result.body.replayed, true);
    assert.equal(f.rows().length, 1);
    assert.equal(f.counts.codeReads, 0);
    assert.equal(f.counts.batches, 1);
  } finally { f.sqlite.close(); }
});

test("an unavailable database rolls back event/rally inserts and never becomes a content conflict or an automatic retry", async () => {
  const f = fixture();
  try {
    const rally: PublicProgram = { ...first, profile: "stamp_rally", endsAt: "2026-10-22T01:00:00.000Z", stations: [{ id: "one", name: "Local stop" }] };
    f.failAfterStatement(2);
    const result = await f.receive(rally);
    assert.equal(result.status, 500);
    assert.equal(result.body.error, "public_program_receive_failed");
    assert.equal(f.counts.batches, 1);
    assert.equal(f.rows().length, 0);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS count FROM observation_rally_courses").get()!.count, 0);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS count FROM observation_rally_stations").get()!.count, 0);
    f.failAfterStatement(0);
    assert.equal((await f.receive(rally)).status, 201, "a later explicit retry saves the same request ID");
    assert.equal(f.rows().length, 1);
  } finally { f.sqlite.close(); }
});

test("failed promotion rolls back publication and code before a later explicit retry", async () => {
  const f = fixture();
  try {
    await f.receive(first, false);
    const rows = f.rows();
    f.failAfterStatement(1);
    const result = await f.receive();
    assert.equal(result.status, 500);
    assert.equal(result.body.error, "public_program_receive_failed");
    assert.deepEqual(f.rows(), rows);
    assert.equal(f.counts.batches, 2);
    f.failAfterStatement(0);
    assert.equal((await f.receive()).body.publicationState, "public");
  } finally { f.sqlite.close(); }
});

test("all eight occupied candidates stop with an unavailable error, retain other native records and retry deterministically", async () => {
  const f = fixture();
  try {
    const attempted: string[] = [];
    f.beforeBatch(statements => {
      const code = String(statements[0]!.values[2]);
      attempted.push(code);
      if (!f.rows().some(row => row.event_code === code)) f.native(code);
    });
    for (let i = 0; i < 2; i++) {
      const result = await f.receive();
      assert.equal(result.status, 500);
      assert.equal(result.body.error, "public_program_event_code_unavailable");
      assert.equal(f.counts.batches, (i + 1) * 8);
      assert.equal(f.rows().length, 8);
      assert.ok(f.rows().every(row => row.organizer_user_id === "other-native-organizer"));
    }
    assert.deepEqual(attempted.slice(0, 8), attempted.slice(8));
    assert.equal(new Set(attempted).size, 8);
    assert.ok(attempted.every(code => /^P[A-Z0-9]{7}$/u.test(code)));
  } finally { f.sqlite.close(); }
});
