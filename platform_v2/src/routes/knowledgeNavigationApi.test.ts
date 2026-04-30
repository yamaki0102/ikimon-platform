import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("knowledge navigation latest version API is admin/analyst gated", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/internal/knowledge-navigation/versions/latest",
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.deepEqual(response.json(), { ok: false, error: "admin_or_analyst_required" });
  } finally {
    await app.close();
  }
});
