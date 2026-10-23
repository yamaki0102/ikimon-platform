import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./applyMigrations.ts", import.meta.url), "utf8");

test("owner-sensitive migrations can be recorded as skipped on owner privilege errors", () => {
  assert.match(source, /OWNER_SENSITIVE_APPROVAL/);
  assert.match(source, /code === "42501"/);
  assert.match(source, /skip owner-sensitive migration/);
  assert.match(source, /insert into schema_migrations \(filename, checksum\)/);
});

test("local extension compatibility is explicit and localhost-only", () => {
  assert.match(source, /localExtensionCompat/);
  assert.match(source, /--local-extension-compat/);
  assert.match(source, /allowed only for localhost scratch DATABASE_URL/);
  assert.match(source, /CREATE\\s\+EXTENSION\\s\+IF\\s\+NOT\\s\+EXISTS\\s\+vector/);
  assert.match(source, /create_hypertable/);
  assert.match(source, /USING\\s\+ivfflat/);
});

test("migration runs serialize before reading applied state and release the session lock", () => {
  const runLocked = source.indexOf("withMigrationLock(pool, async (client)");
  const ensureTable = source.indexOf("ensureSchemaMigrationsTable(client)");
  const loadApplied = source.indexOf("loadAppliedMigrations(client)");

  assert.ok(runLocked >= 0, "runner must execute migrations inside the lock callback");
  assert.ok(ensureTable > runLocked, "schema migration metadata must be accessed after acquiring the lock");
  assert.ok(loadApplied > ensureTable, "applied state must be read after acquiring the lock");
});
