import assert from "node:assert/strict";
import test from "node:test";
import { resolveViewer } from "./viewerIdentity.js";

async function withQueryOverrideEnv<T>(value: string | undefined, run: () => T | Promise<T>): Promise<T> {
  const previous = process.env.ALLOW_QUERY_USER_ID;
  if (value === undefined) {
    delete process.env.ALLOW_QUERY_USER_ID;
  } else {
    process.env.ALLOW_QUERY_USER_ID = value;
  }
  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env.ALLOW_QUERY_USER_ID;
    } else {
      process.env.ALLOW_QUERY_USER_ID = previous;
    }
  }
}

test("resolveViewer ignores another user's query id unless staging override is enabled", async () => {
  await withQueryOverrideEnv(undefined, () => {
    const result = resolveViewer({ userId: "other-user" }, { userId: "session-user" });
    assert.equal(result.viewerUserId, "session-user");
    assert.equal(result.requestedUserId, "other-user");
    assert.equal(result.queryOverrideHonored, false);
  });
});

test("resolveViewer allows explicit self-identification", async () => {
  await withQueryOverrideEnv(undefined, () => {
    const result = resolveViewer({ userId: "session-user" }, { userId: "session-user" });
    assert.equal(result.viewerUserId, "session-user");
    assert.equal(result.queryOverrideHonored, true);
  });
});

test("resolveViewer only honors arbitrary query ids behind the staging opt-in", async () => {
  await withQueryOverrideEnv("1", () => {
    const result = resolveViewer({ userId: ["qa-user"] }, { userId: "session-user" });
    assert.equal(result.viewerUserId, "qa-user");
    assert.equal(result.requestedUserId, "qa-user");
    assert.equal(result.queryOverrideHonored, true);
  });
});

test("resolveViewer treats anonymous callers as anonymous when query override is disabled", async () => {
  await withQueryOverrideEnv(undefined, () => {
    const result = resolveViewer({ userId: "other-user" }, null);
    assert.equal(result.viewerUserId, null);
    assert.equal(result.queryOverrideHonored, false);
  });
});
