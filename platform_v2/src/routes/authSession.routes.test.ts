import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("auth session endpoint keeps direct guest checks as 401", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/session",
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {
      ok: false,
      error: "session_not_found",
    });
  } finally {
    await app.close();
  }
});

test("auth session endpoint supports optional guest hydration without 401", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/session?optional=1",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      ok: false,
      error: "session_not_found",
      session: null,
    });
  } finally {
    await app.close();
  }
});
