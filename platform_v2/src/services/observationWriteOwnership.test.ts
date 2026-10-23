import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Pool } from "pg";
import { assertVisitUpsertOwner } from "./writeGuardsPg.js";
import { upsertObservation } from "./observationWrite.js";

const writeSource = readFileSync(new URL("./observationWrite.ts", import.meta.url), "utf8");

test("visit upsert ownership check locks the target and rejects an existing different owner", async () => {
  let statement = "";
  let values: unknown[] = [];
  const statements: string[] = [];
  await assert.rejects(
    assertVisitUpsertOwner("visit-a", "user-b", async (sql, params) => {
      statements.push(sql);
      statement = sql;
      values = params;
      return /select user_id from visits/i.test(sql) ? { rows: [{ user_id: "user-a" }] } : { rows: [] };
    }),
    /observation_not_owned/,
  );
  assert.match(statement, /where visit_id = \$1 for update/i);
  assert.deepEqual(values, ["visit-a"]);
  assert.match(statements[0] ?? "", /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/i);
  assert.equal(statements.length, 2, "serialize even if the visit row does not exist yet");
});

test("observation upsert checks ownership inside its transaction before inserting visit data", () => {
  const transactionStart = writeSource.indexOf('await client.query("begin")');
  const ownershipCheck = writeSource.indexOf("await assertVisitUpsertOwner(", transactionStart);
  const visitWrite = writeSource.indexOf("insert into visits (", ownershipCheck);
  assert.ok(transactionStart >= 0);
  assert.ok(ownershipCheck > transactionStart);
  assert.ok(visitWrite > ownershipCheck);
});

test("visit upsert ownership check permits new visits and the current owner", async () => {
  await assert.doesNotReject(assertVisitUpsertOwner("new-visit", "user-a", async () => ({ rows: [] })));
  await assert.doesNotReject(assertVisitUpsertOwner("visit-a", "user-a", async () => ({ rows: [{ user_id: "user-a" }] })));
});

test("concurrent first upserts serialize and the second owner is rejected", async () => {
  let locked = false;
  let owner: string | null = null;
  const waiters: Array<() => void> = [];
  let signalWaiting!: () => void;
  const waitingForSecond = new Promise<void>((resolve) => { signalWaiting = resolve; });
  const makeQuery = (userId: string) => async (sql: string) => {
    if (/pg_advisory_xact_lock/i.test(sql)) {
      if (locked) {
        if (userId === "user-b") signalWaiting();
        await new Promise<void>((resolve) => waiters.push(resolve));
      }
      locked = true;
      return { rows: [] };
    }
    return { rows: owner === null ? [] : [{ user_id: owner }] };
  };

  await assertVisitUpsertOwner("same-new-id", "user-a", makeQuery("user-a"));
  owner = "user-a"; // First transaction inserts its visit, then commits.
  let secondSettled = false;
  const second = assertVisitUpsertOwner("same-new-id", "user-b", makeQuery("user-b"))
    .then(() => { secondSettled = true; }, (error: unknown) => { secondSettled = true; throw error; });
  await waitingForSecond;
  assert.equal(secondSettled, false, "second transaction waits for the first transaction lock");
  locked = false;
  waiters.shift()?.();
  await assert.rejects(second, /observation_not_owned/);
});

test("upsert rejects a foreign-owned visit before writes, rolls back, and releases its client", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgres://unused:test@localhost/unused";
  const poolPrototype = Object.getPrototypeOf(Pool.prototype) as { connect: (...args: unknown[]) => unknown };
  const originalConnect = poolPrototype.connect;
  const statements: string[] = [];
  let released = false;
  poolPrototype.connect = async function () {
    return {
      async query(sql: string) {
        const normalized = sql.trim().toLowerCase();
        statements.push(normalized);
        if (normalized === "select pg_advisory_xact_lock(hashtextextended($1, 0))") return { rows: [] };
        if (normalized === "select user_id from visits where visit_id = $1 for update") return { rows: [{ user_id: "owner-a" }] };
        if (/select exists\(select 1 from users/.test(normalized)) return { rows: [{ exists: true }] };
        if (/insert into visits \(/.test(normalized)) throw new Error("unexpected_visit_write");
        return { rows: [] };
      },
      release() { released = true; },
    };
  };
  try {
    await assert.rejects(upsertObservation({
      observationId: "visit-a",
      userId: "owner-b",
      observedAt: "2026-10-20T10:00:00.000Z",
      latitude: null,
      longitude: null,
    }), /observation_not_owned/);
    assert.ok(statements.includes("begin"));
    assert.ok(statements.includes("rollback"));
    assert.ok(!statements.includes("commit"));
    assert.ok(!statements.some((sql) => sql.startsWith("insert into ")));
    assert.equal(released, true);
  } finally {
    poolPrototype.connect = originalConnect;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});
