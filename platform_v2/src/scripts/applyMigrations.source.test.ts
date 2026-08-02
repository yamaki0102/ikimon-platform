import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./applyMigrations.ts", import.meta.url), "utf8");
const transactionSource = readFileSync(new URL("./applyMigration.ts", import.meta.url), "utf8");

test("migration CLI delegates each pending migration to the transactional runner", () => {
  assert.match(source, /applyMigrationTransaction\(client,\s*\{\s*filename,\s*checksum,\s*sql\s*\}\)/);
  assert.doesNotMatch(source, /skip owner-sensitive migration/);
  assert.doesNotMatch(source, /on conflict \(filename\) do nothing/);
  assert.match(transactionSource, /code === "42501"/);
  assert.match(transactionSource, /database role lacks object ownership or required privileges/);
  assert.match(transactionSource, /approved migration role/);
});

test("local extension compatibility is explicit and localhost-only", () => {
  assert.match(source, /localExtensionCompat/);
  assert.match(source, /--local-extension-compat/);
  assert.match(source, /allowed only for localhost scratch DATABASE_URL/);
  assert.match(source, /CREATE\\s\+EXTENSION\\s\+IF\\s\+NOT\\s\+EXISTS\\s\+vector/);
  assert.match(source, /create_hypertable/);
  assert.match(source, /USING\\s\+ivfflat/);
});
