import assert from "node:assert/strict";
import type { FastifyRequest } from "fastify";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { assertPrivilegedWriteAccess, assertSessionUser } from "./writeGuards.js";
import type { SessionSnapshot } from "./authSession.js";

async function withEnv(overrides: Record<string, string | undefined>, run: () => Promise<void> | void): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function requestWithHeaders(headers: Record<string, string>): FastifyRequest {
  return { headers } as FastifyRequest;
}

test("privileged write guard accepts standard and legacy FieldScan headers", async () => {
  await withEnv({ V2_PRIVILEGED_WRITE_API_KEY: "test-write-key" }, () => {
    assert.doesNotThrow(() => assertPrivilegedWriteAccess(requestWithHeaders({ "x-ikimon-write-key": "test-write-key" })));
    assert.doesNotThrow(() => assertPrivilegedWriteAccess(requestWithHeaders({ "x-v2-privileged-write-api-key": "test-write-key" })));
    assert.doesNotThrow(() => assertPrivilegedWriteAccess(requestWithHeaders({ "x-api-key": "test-write-key" })));
    assert.doesNotThrow(() => assertPrivilegedWriteAccess(requestWithHeaders({ authorization: "Bearer test-write-key" })));
  });
});

test("privileged write guard rejects missing and mismatched keys", async () => {
  await withEnv({ V2_PRIVILEGED_WRITE_API_KEY: "test-write-key" }, () => {
    assert.throws(() => assertPrivilegedWriteAccess(requestWithHeaders({})), /forbidden_privileged_write/);
    assert.throws(() => assertPrivilegedWriteAccess(requestWithHeaders({ "x-api-key": "wrong-key" })), /forbidden_privileged_write/);
  });
});

test("privileged write guard rejects ambiguous duplicate API-key headers", async () => {
  await withEnv({ V2_PRIVILEGED_WRITE_API_KEY: "test-write-key" }, () => {
    assert.throws(() => assertPrivilegedWriteAccess({
      headers: { "x-api-key": ["test-write-key", "attacker-key"] },
    } as unknown as FastifyRequest), /forbidden_privileged_write/);
  });
});

test("privileged write guard rejects ambiguous duplicate Authorization headers", async () => {
  await withEnv({ V2_PRIVILEGED_WRITE_API_KEY: "test-write-key" }, () => {
    assert.throws(() => assertPrivilegedWriteAccess({
      headers: { authorization: ["Bearer test-write-key", "Bearer attacker-key"] },
    } as unknown as FastifyRequest), /forbidden_privileged_write/);
  });
});

test("privileged write guard rejects joined duplicate credentials and never falls back from an ambiguous header", async () => {
  await withEnv({ V2_PRIVILEGED_WRITE_API_KEY: "test-write-key" }, () => {
    assert.throws(() => assertPrivilegedWriteAccess(requestWithHeaders({ "x-api-key": "test-write-key, attacker-key" })), /forbidden_privileged_write/);
    assert.throws(() => assertPrivilegedWriteAccess(requestWithHeaders({
      "x-ikimon-write-key": ["test-write-key", "attacker-key"],
      "x-api-key": "test-write-key",
    } as unknown as Record<string, string>)), /forbidden_privileged_write/);
  });
});

test("session write guard denies absent, disabled, and mismatched actors", () => {
  const session = {
    userId: "owner-1",
    banned: false,
  } as SessionSnapshot;
  assert.throws(() => assertSessionUser(null, "owner-1"), /session_required/);
  assert.throws(() => assertSessionUser({ ...session, banned: true }, "owner-1"), /account_disabled/);
  assert.throws(() => assertSessionUser(session, "owner-2"), /forbidden_user_mismatch/);
  assert.equal(assertSessionUser(session, "owner-1"), session);
});

test("observation ownership guard keeps owner check while allowing occurrence-to-visit fallback", () => {
  const pureGuardSource = readFileSync(path.join(process.cwd(), "src/services/writeGuards.ts"), "utf8");
  const source = readFileSync(path.join(process.cwd(), "src/services/writeGuardsPg.ts"), "utf8");

  assert.doesNotMatch(pureGuardSource, /getPool\(|pool\.query|observationOwnershipTargetIds|assertObservationOwnedByUser/);
  assert.match(source, /function observationOwnershipTargetIds\(observationId: string\): string\[\]/);
  assert.match(source, /\^occ:\(\[\^:\]\+\):\\d\+\$/);
  assert.match(source, /v\.visit_id = any\(\$1::text\[\]\)/);
  assert.match(source, /v\.legacy_observation_id = any\(\$1::text\[\]\)/);
  assert.match(source, /o\.occurrence_id = any\(\$1::text\[\]\)/);
  assert.match(source, /and v\.user_id = \$2/);
  assert.match(source, /\[targetIds, userId\]/);
});
