import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { buildApp } from "../app.js";
import { readCloudflareWorkerSourceSync } from "../cloudflareWorkerSource.testSupport.js";

test("observation event live endpoint is retired from Fastify", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/observation-events/00000000-0000-0000-0000-000000000000/live",
    });

    assert.equal(response.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("observation event live mode is Worker-native and does not hold a PostgreSQL listener", () => {
  const apiSource = readFileSync(path.join(process.cwd(), "src", "routes", "observationEventApi.ts"), "utf8");
  const workerSource = readCloudflareWorkerSourceSync();
  const liveSource = readFileSync(path.join(process.cwd(), "src", "services", "observationEventLive.ts"), "utf8");

  assert.doesNotMatch(apiSource, /X-Ikimon-Observation-Event-Live-Mode|writeSse|\/live/);
  assert.match(workerSource, /getObservationEventLiveSnapshot/);
  assert.match(workerSource, /action === "live"/);
  assert.doesNotMatch(workerSource, /subscribeToSession|setInterval|heartbeat|onClose/);
  assert.doesNotMatch(liveSource, /LISTEN|UNLISTEN|notification|obs_evt_|PoolClient/);
});
