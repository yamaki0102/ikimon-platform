import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "./app.js";

test("app accepts photo upload JSON bodies up to the v2 photo preflight envelope", async () => {
  const app = buildApp();
  try {
    assert.equal(app.initialConfig.bodyLimit, 40 * 1024 * 1024);
  } finally {
    await app.close();
  }
});
