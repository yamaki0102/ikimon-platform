import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./applyMigrations.ts", import.meta.url), "utf8");

test("owner-sensitive privilege errors fail closed without recording false application", () => {
  assert.match(source, /OWNER_SENSITIVE_APPROVAL/);
  assert.match(source, /code === "42501"/);
  assert.match(source, /Owner-sensitive migration blocked/);
  assert.match(source, /migration was not recorded as applied/);
  assert.doesNotMatch(source, /skip owner-sensitive migration/);
  assert.doesNotMatch(source, /on conflict \(filename\) do nothing/);

  const ownerPrivilegeBranch = source.match(
    /if \(OWNER_SENSITIVE_APPROVAL\.test\(sql\) && isOwnerPrivilegeError\(error\)\) \{([\s\S]*?)\n\s*\}/,
  )?.[1];
  assert.ok(ownerPrivilegeBranch);
  assert.match(ownerPrivilegeBranch, /throw new Error/);
  assert.doesNotMatch(ownerPrivilegeBranch, /insert into schema_migrations/);
});

test("local extension compatibility is explicit and localhost-only", () => {
  assert.match(source, /localExtensionCompat/);
  assert.match(source, /--local-extension-compat/);
  assert.match(source, /allowed only for localhost scratch DATABASE_URL/);
  assert.match(source, /CREATE\\s\+EXTENSION\\s\+IF\\s\+NOT\\s\+EXISTS\\s\+vector/);
  assert.match(source, /create_hypertable/);
  assert.match(source, /USING\\s\+ivfflat/);
});
