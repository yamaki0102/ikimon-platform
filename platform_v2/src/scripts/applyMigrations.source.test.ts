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
