import assert from "node:assert/strict";
import test from "node:test";
import { MIGRATION_ADVISORY_LOCK_KEY, withMigrationLock, type MigrationLockClient } from "./migrationLock.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("serializes migration work across distinct PostgreSQL sessions and releases each once", async () => {
  const enteredFirst = deferred();
  const allowFirstToFinish = deferred();
  let held = false;
  let releaseNext!: () => void;
  const releases = new Map<number, number>();
  const statements: string[] = [];
  let nextId = 0;
  const pool = {
    async connect(): Promise<MigrationLockClient> {
      const id = ++nextId;
      return {
        async query(sql, values) {
          statements.push(sql);
          assert.deepEqual(values, [MIGRATION_ADVISORY_LOCK_KEY]);
          if (sql.includes("pg_advisory_lock")) {
            while (held) await new Promise<void>((resolve) => { releaseNext = resolve; });
            held = true;
          } else if (sql.includes("pg_advisory_unlock")) {
            held = false;
            releaseNext?.();
          }
          return { rows: [] };
        },
        release() { releases.set(id, (releases.get(id) ?? 0) + 1); },
      };
    },
  };
  let entered = 0;
  const first = withMigrationLock(pool, async () => {
    entered += 1;
    enteredFirst.resolve();
    await allowFirstToFinish.promise;
  });
  await enteredFirst.promise;
  let secondEntered = false;
  const second = withMigrationLock(pool, async () => { secondEntered = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(secondEntered, false, "second migration run must wait for the first session lock");
  allowFirstToFinish.resolve();
  await Promise.all([first, second]);
  assert.equal(entered, 1);
  assert.equal(secondEntered, true);
  assert.equal(nextId, 2, "each migration run must hold a distinct PostgreSQL session");
  assert.deepEqual([...releases.values()], [1, 1]);
  assert.equal(statements.filter((sql) => sql.includes("pg_advisory_lock")).length, 2);
  assert.equal(statements.filter((sql) => sql.includes("pg_advisory_unlock")).length, 2);
});

test("releases a session when lock acquisition fails without starting migration work", async () => {
  let released = 0;
  const pool = {
    async connect() {
      return {
        async query() { throw new Error("lock unavailable"); },
        release(error?: Error) { released += 1; assert.match(error?.message ?? "", /lock unavailable/); },
      };
    },
  };
  let ran = false;
  await assert.rejects(withMigrationLock(pool, async () => { ran = true; }), /lock unavailable/);
  assert.equal(ran, false);
  assert.equal(released, 1);
});

test("unlocks and releases after migration work fails", async () => {
  const statements: string[] = [];
  let released = 0;
  const pool = {
    async connect() {
      return {
        async query(sql: string) { statements.push(sql); return { rows: [] }; },
        release() { released += 1; },
      };
    },
  };
  await assert.rejects(
    withMigrationLock(pool, async () => { throw new Error("migration failed"); }),
    /migration failed/,
  );
  assert.equal(statements.some((sql) => sql.includes("pg_advisory_unlock")), true);
  assert.equal(released, 1);
});

test("destroys a session when unlock fails and still releases it", async () => {
  let releasedWithError: Error | undefined;
  const pool = {
    async connect() {
      return {
        async query(sql: string) {
          if (sql.includes("pg_advisory_unlock")) throw new Error("unlock unavailable");
          return { rows: [] };
        },
        release(error?: Error) { releasedWithError = error; },
      };
    },
  };
  await assert.rejects(withMigrationLock(pool, async () => {}), /unlock unavailable/);
  assert.match(releasedWithError?.message ?? "", /unlock unavailable/);
});
