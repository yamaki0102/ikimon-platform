import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("plot monitoring routes reject anonymous reads before DB lookup", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sites/site-alpha/plots",
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "session_required");
  } finally {
    await app.close();
  }
});

test("plot report route rejects anonymous access", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sites/site-alpha/plot-report",
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "session_required");
  } finally {
    await app.close();
  }
});

test("plot monitoring routes reject anonymous writes before accepting payloads", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sites/site-alpha/plots",
      payload: { label: "north plot" },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "session_required");
  } finally {
    await app.close();
  }
});
