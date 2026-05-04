import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerPassiveAudioIngestApiRoutes } from "./passiveAudioIngestApi.js";
import type { PassiveAudioBatchResult } from "../services/passiveAudioIngest.js";

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
): Promise<void> {
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

function fakeResult(events: unknown[]): PassiveAudioBatchResult {
  const seen = new Set<string>();
  let accepted = 0;
  let rejected = 0;
  let duplicates = 0;
  const results = events.map((event, index) => {
    if (!event || typeof event !== "object" || !("site_id" in event)) {
      rejected += 1;
      return { index, status: "rejected" as const, error: "site_id_required" };
    }
    const key = JSON.stringify(event);
    if (seen.has(key)) {
      duplicates += 1;
      return { index, status: "duplicate" as const, dedupeKey: `test:${index}` };
    }
    seen.add(key);
    accepted += 1;
    return {
      index,
      status: "accepted" as const,
      dedupeKey: `test:${index}`,
      visitId: `visit-${index}`,
      occurrenceId: `occ-${index}`,
      segmentId: `segment-${index}`,
      tier15Candidate: false,
    };
  });
  return { ok: rejected === 0, accepted, rejected, duplicates, results };
}

test("passive audio ingest endpoint requires privileged write key", async () => {
  await withEnv({ V2_PRIVILEGED_WRITE_API_KEY: "test-write-key" }, async () => {
    const app = Fastify();
    await registerPassiveAudioIngestApiRoutes(app, { ingestBatch: async (events) => fakeResult(events) });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ingest/audio-detections",
        payload: { site_id: "aikan-shizuoka-poc" },
      });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().error, "forbidden_privileged_write");
    } finally {
      await app.close();
    }
  });
});

test("passive audio ingest endpoint accepts single and batch bodies", async () => {
  await withEnv({ V2_PRIVILEGED_WRITE_API_KEY: "test-write-key" }, async () => {
    const app = Fastify();
    await registerPassiveAudioIngestApiRoutes(app, { ingestBatch: async (events) => fakeResult(events) });
    try {
      const single = await app.inject({
        method: "POST",
        url: "/api/v1/ingest/audio-detections",
        headers: { "x-ikimon-write-key": "test-write-key" },
        payload: { site_id: "aikan-shizuoka-poc" },
      });
      assert.equal(single.statusCode, 200);
      assert.equal(single.json().accepted, 1);

      const batch = await app.inject({
        method: "POST",
        url: "/api/v1/ingest/audio-detections",
        headers: { authorization: "Bearer test-write-key" },
        payload: {
          events: [
            { site_id: "aikan-shizuoka-poc", n: 1 },
            { site_id: "aikan-shizuoka-poc", n: 2 },
          ],
        },
      });
      assert.equal(batch.statusCode, 200);
      assert.equal(batch.json().accepted, 2);
    } finally {
      await app.close();
    }
  });
});

test("passive audio ingest endpoint reports duplicates and invalid rows", async () => {
  await withEnv({ V2_PRIVILEGED_WRITE_API_KEY: "test-write-key" }, async () => {
    const app = Fastify();
    await registerPassiveAudioIngestApiRoutes(app, { ingestBatch: async (events) => fakeResult(events) });
    try {
      const duplicate = { site_id: "aikan-shizuoka-poc", n: 1 };
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ingest/audio-detections",
        headers: { "x-ikimon-write-key": "test-write-key" },
        payload: { events: [duplicate, duplicate, { n: 3 }] },
      });
      assert.equal(response.statusCode, 207);
      assert.equal(response.json().accepted, 1);
      assert.equal(response.json().duplicates, 1);
      assert.equal(response.json().rejected, 1);
    } finally {
      await app.close();
    }
  });
});

test("passive audio ingest endpoint enforces batch limit", async () => {
  await withEnv({ V2_PRIVILEGED_WRITE_API_KEY: "test-write-key" }, async () => {
    const app = Fastify();
    await registerPassiveAudioIngestApiRoutes(app, { ingestBatch: async (events) => fakeResult(events) });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ingest/audio-detections",
        headers: { "x-ikimon-write-key": "test-write-key" },
        payload: { events: Array.from({ length: 101 }, (_, i) => ({ site_id: "aikan-shizuoka-poc", i })) },
      });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error, "batch_limit_exceeded");
    } finally {
      await app.close();
    }
  });
});
