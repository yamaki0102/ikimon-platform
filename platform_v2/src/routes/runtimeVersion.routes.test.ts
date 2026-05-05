import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("runtime version endpoint exposes monitoring package feature flags without requiring database", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/runtime/version",
      headers: { accept: "application/json" },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.schemaVersion, "monitoring_package/v1.1");
    assert.equal(body.featureFlags.monitoringPackageV11, true);
    assert.equal(body.featureFlags.waterRecordExtensionV0, true);
  } finally {
    await app.close();
  }
});
