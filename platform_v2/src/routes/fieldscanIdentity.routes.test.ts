import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { SessionSnapshot } from "../services/authSession.js";
import type { AudioSegmentSubmitInput } from "../services/fieldscanAudio.js";
import { __test__ as fieldscanTest } from "./fieldscanApi.js";
import { __test__ as walkTest } from "./walkApi.js";

function session(userId: string): SessionSnapshot {
  return {
    userId,
    displayName: "Test User",
    roleName: "Observer",
    rankLabel: null,
    banned: false,
    expiresAt: "2099-01-01T00:00:00.000Z",
    tokenHash: "test-token-hash",
  };
}

function audioInput(userId?: string | null): AudioSegmentSubmitInput {
  return {
    sessionId: "fieldscan-session",
    recordedAt: "2026-06-30T00:00:00.000Z",
    ...(userId === undefined ? {} : { userId }),
  };
}

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

test("fieldscan audio submit identity resolver trusts session identity over body userId", () => {
  assert.equal(fieldscanTest.resolveTrustedAudioUserId(audioInput("spoofed-user"), null), null);
  assert.equal(fieldscanTest.resolveTrustedAudioUserId(audioInput(), session("owner-user")), "owner-user");
  assert.equal(fieldscanTest.resolveTrustedAudioUserId(audioInput("owner-user"), session("owner-user")), "owner-user");
  assert.throws(
    () => fieldscanTest.resolveTrustedAudioUserId(audioInput("spoofed-user"), session("owner-user")),
    /forbidden_user_mismatch/,
  );
});

test("walk session identity resolver only accepts body userId for privileged writes", () => {
  assert.equal(walkTest.resolveTrustedWalkUserId({ userId: "owner-user" }, session("owner-user"), false), "owner-user");
  assert.equal(walkTest.resolveTrustedWalkUserId({ userId: "privileged-target" }, null, true), "privileged-target");
  assert.equal(walkTest.resolveTrustedWalkUserId({ userId: "spoofed-user" }, null, false), "anonymous");
  assert.throws(
    () => walkTest.resolveTrustedWalkUserId({ userId: "spoofed-user" }, session("owner-user"), true),
    /forbidden_user_mismatch/,
  );
});

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
