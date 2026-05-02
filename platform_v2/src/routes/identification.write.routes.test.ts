import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("public identification write requires a session", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/observations/occ-1/identifications",
      headers: { "content-type": "application/json" },
      payload: {
        proposedName: "Pieris rapae",
        proposedRank: "species",
        stance: "support",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "session_required");
  } finally {
    await app.close();
  }
});

test("public dispute write requires a session", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/observations/occ-1/disputes",
      headers: { "content-type": "application/json" },
      payload: {
        kind: "needs_more_evidence",
        reason: "Need a close-up photo.",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "session_required");
  } finally {
    await app.close();
  }
});

test("specialist dispute resolution requires a session before touching DB", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/specialist/disputes/dispute-1/resolve",
      headers: { "content-type": "application/json" },
      payload: {
        resolution: "reject_dispute",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "session_required");
  } finally {
    await app.close();
  }
});

