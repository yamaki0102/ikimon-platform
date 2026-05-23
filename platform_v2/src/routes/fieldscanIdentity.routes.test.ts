import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const fieldscanRoute = readFileSync(
  fileURLToPath(new URL("./fieldscanApi.ts", import.meta.url)),
  "utf8",
);

const walkRoute = readFileSync(
  fileURLToPath(new URL("./walkApi.ts", import.meta.url)),
  "utf8",
);

const mapRoute = readFileSync(
  fileURLToPath(new URL("./mapApi.ts", import.meta.url)),
  "utf8",
);

test("fieldscan audio submit does not trust body userId without an authenticated session", () => {
  assert.match(fieldscanRoute, /getSessionFromMobileAuth/);
  assert.match(fieldscanRoute, /resolveTrustedAudioUserId/);
  assert.match(fieldscanRoute, /forbidden_user_mismatch/);
  assert.doesNotMatch(fieldscanRoute, /body\.userId\s*\?\?\s*session\?\.userId/);
});

test("walk session routes reject session/body userId mismatches before writing", () => {
  assert.match(walkRoute, /getSessionFromMobileAuth/);
  assert.match(walkRoute, /resolveTrustedWalkUserId/);
  assert.match(walkRoute, /forbidden_user_mismatch/);
  assert.match(walkRoute, /assertPrivilegedWriteAccess/);
  assert.doesNotMatch(walkRoute, /session\?\.userId\s*\?\?\s*\(body\.userId as string \| undefined\)/);
});

test("internal map cache flush uses the shared privileged write guard", () => {
  assert.match(mapRoute, /assertPrivilegedWriteAccess/);
  assert.doesNotMatch(mapRoute, /got !== expected/);
});
