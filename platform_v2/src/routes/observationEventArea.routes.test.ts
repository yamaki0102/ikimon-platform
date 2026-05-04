import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("area suggestion API is login gated before LLM or DB planning work", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/observation-events/area-suggestions",
      payload: { center: { lat: 34.6984, lng: 137.7043 } },
    });
    assert.equal(response.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("field conflict API is login gated before conflict lookup", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/fields/conflicts",
      payload: { name: "そよら浜松西伊場", lat: 34.6984, lng: 137.7043 },
    });
    assert.equal(response.statusCode, 401);
  } finally {
    await app.close();
  }
});
