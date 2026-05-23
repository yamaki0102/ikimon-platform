import assert from "node:assert/strict";
import type { FastifyRequest } from "fastify";
import test from "node:test";
import { assertPrivilegedWriteAccess } from "./writeGuards.js";

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
